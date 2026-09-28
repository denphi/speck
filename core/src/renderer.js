"use strict";

var glm = require('./gl-matrix');
var webgl = require('./webgl.js');
var cube = require("./cube");
var elements = require("./elements");
var View = require("./view");
var System = require("./system");
var Cartoon = require("./cartoon");
var Surface = require("./surface");
var Cell = require("./cell");
var shaders = require("./shaders");
var consts = require("./const");

// Screen-aligned square for atom imposters (two triangles, facing the viewer).
var QUAD = [
    -1, -1, 0,   1, -1, 0,   1, 1, 0,
    -1, -1, 0,   1,  1, 0,  -1, 1, 0
];

// The same shapes as triangle strips, for instanced drawing: 4 instead of 6
// vertices per atom, 14 instead of 36 per bond. Both keep the outward-facing
// winding of the triangle lists, so back-face culling is unchanged.
var QUAD_STRIP = [-1, -1, 0,   1, -1, 0,   -1, 1, 0,   1, 1, 0];
var CUBE_STRIP = [1, 1, 1,  -1, 1, 1,   1, -1, 1,  -1, -1, 1,  -1, -1, -1,  -1, 1, 1,  -1, 1, -1,
                  1, 1, 1,   1, 1, -1,  1, -1, 1,   1, -1, -1, -1, -1, -1,   1, 1, -1, -1, 1, -1];

// Key light for specular highlights, in view space (upper left, towards viewer).
var LIGHT_DIR = glm.vec3.normalize(glm.vec3.create(), [-0.45, 0.6, 0.66]);
var SHADOW_RES = 2048;
// AO samples per frame are limited so one frame draws at most about this many
// vertices: huge structures (a ribosome as atoms) refine over more frames
// instead of stalling the GPU, which browsers treat as a lost context.
var VERTEX_BUDGET = 30e6;
var Select = require("./select");
var parseColor = Select.parseColor;

module.exports = function (canvas, resolution, aoResolution) {
        // The camera describes a square frame of side m_resolution; the canvas
        // shows its bottom-left rx x ry part, and the render targets cover
        // just that part (not the whole square).
        let m_resolution = Math.max(resolution.x, resolution.y)
        var rx = resolution.x, ry = resolution.y;
        var self = this;

        var range,
            samples,
            system;

        var gl,
            canvas;

        var rAtoms = null,
            rBonds = null,
            rCartoon = null,
            rSurface = null,
            rCell = null,
            rDispQuad = null,
            rAccumulator = null,
            rAO = null,
            rDOF = null,
            rShadow = null,
            rFXAA = null;

        var tSceneColor, tSceneNormal, tSceneDepth,
            tRandRotDepth, tRandRotColor,
            tFXAA, tFXAAOut,
            tDOF,
            tAO;
        // Ambient occlusion accumulates by ping-pong between two targets: each
        // sample reads `read` and writes `write`, then they swap (no copies).
        var acc = null, surfAcc = null;
        // Stands in for layers that are not allocated (surface, shadows).
        var tDummy = null;
        // Set once a converged picture is on screen; nothing changes until reset().
        var idleDisplayed = false;

        // Translucent surface layer. Its textures are bound to units 11-14 right
        // before each draw that samples them (units 0-10 hold the fixed textures).
        var tSurfColor = null, tSurfNormal, tSurfDepth, tRandRotDepthAll;
        var fbSurfColor, fbSurfNormal, fbRandRotAll;
        // Key-light shadows: depth map along the light and per-pixel visibility.
        var tShadowMapColor = null, tShadowMap, tShadow;
        var fbShadowMap, fbShadow;
        // 1x1 target for picking the depth under a point (focus by click).
        var tPickColor, tPickDepth, fbPick;
        var fogExtent = {near: 0, far: 1};
        // Focal depth for depth of field (from view.dofFocus when set).
        var dofDepth = 0.5;

        var fbSceneColor, fbSceneNormal,
            fbRandRot,
            fbFXAA, fbFXAA2,
            fbDOF,
            fbAO;

        var progAtoms,
            progBonds,
            progCartoon,
            progAccumulator,
            progAO,
            progFXAA,
            progDOF,
            progShadow,
            progDisplayQuad;

        var ext;
        var instancing = null;
        var elementIndexUint = null;
        var sceneVertices = 0;  // vertices drawn by one pass over the scene

        var sampleCount = 0,
            colorRendered = false,
            normalRendered = false,
            shadowRendered = false;

        // At most 1024 AO samples: the accumulator counts 255 per RGBA channel.
        function maxSamples(view) {
            return Math.max(1, Math.min(1024, Math.round(view.aoSamples || 1024)));
        }

        var lastView = null;
        // The studio floor line and molecule height (texture units), or null.
        self.getFloorLine = function(view) {
            return floorLine(view);
        }

        self.getSceneVertices = function() {
            return sceneVertices;
        }

        self.getAOProgress = function() {
            return lastView ? Math.min(1, sampleCount / maxSamples(lastView)) : 0;
        }

        self.initialize = function() {

            // Initialize canvas/gl.
            canvas.width = resolution.x;
            canvas.height = resolution.y;
            // All 3D drawing goes to textures; the canvas only receives the final
            // full-screen pass, so it needs no multisampling, depth or stencil.
            gl = canvas.getContext('webgl', {antialias: false, depth: false, stencil: false});
            webgl.setup(gl);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.clearColor(0,0,0,0);
            gl.clearDepth(1);
            gl.viewport(0, 0, rx, ry);
            // Indexed meshes with more than 65,536 vertices.
            elementIndexUint = gl.getExtension("OES_element_index_uint");

            ext = webgl.getExtensions(gl, [
                "EXT_frag_depth",
                "WEBGL_depth_texture",
            ]);
            // Optional: draws each atom / bond once instead of per vertex.
            instancing = gl.getExtension("ANGLE_instanced_arrays");

            self.createTextures();

            // Initialize shaders.
            progAtoms = loadProgram(gl, shaders.shaders['atom']);
            progBonds = loadProgram(gl, shaders.shaders['bond']);
            progCartoon = loadProgram(gl, shaders.shaders['cartoon']);
            progDisplayQuad = loadProgram(gl, shaders.shaders['textured-quad']);
            progAccumulator = loadProgram(gl, shaders.shaders['accumulator']);
            progAO = loadProgram(gl, shaders.shaders['ao']);
            progFXAA = loadProgram(gl, shaders.shaders['fxaa']);
            progDOF = loadProgram(gl, shaders.shaders['dof']);
            progShadow = loadProgram(gl, shaders.shaders['shadow']);

            var position = [
                -1, -1, 0,
                 1, -1, 0,
                 1,  1, 0,
                -1, -1, 0,
                 1,  1, 0,
                -1,  1, 0
            ];

            // Initialize geometry.
            var attribs = webgl.buildAttribs(gl, {aPosition: 3});
            attribs.aPosition.buffer.set(new Float32Array(position));
            var count = position.length / 9;

            rDispQuad = new webgl.Renderable(gl, progDisplayQuad, attribs, count);
            rAccumulator = new webgl.Renderable(gl, progAccumulator, attribs, count);
            rAO = new webgl.Renderable(gl, progAO, attribs, count);
            rFXAA = new webgl.Renderable(gl, progFXAA, attribs, count);
            rDOF = new webgl.Renderable(gl, progDOF, attribs, count);
            rShadow = new webgl.Renderable(gl, progShadow, attribs, count);

            samples = 0;

        }

        var depthOptions;

        // Targets for a color texture (and optional depth), rx x ry.
        function target(unit, withDepth) {
            var t = new webgl.Texture(gl, unit, null, rx, ry);
            return {t: t, fb: new webgl.Framebuffer(gl, [t], withDepth)};
        }

        function release(list) {
            list.forEach(function(o) { if (o) o.destroy(); });
        }

        function releaseSurfaceLayer() {
            if (!tSurfColor) return;
            release([tSurfColor, tSurfNormal, tSurfDepth, fbSurfColor, fbSurfNormal, tRandRotDepthAll, fbRandRotAll]);
            release([surfAcc.read.t, surfAcc.read.fb, surfAcc.write.t, surfAcc.write.fb]);
            tSurfColor = surfAcc = null;
        }

        function releaseShadowLayer() {
            if (!tShadowMapColor) return;
            release([tShadowMapColor, tShadowMap, fbShadowMap, tShadow, fbShadow]);
            tShadowMapColor = null;
        }

        self.createTextures = function() {
            // Free the previous set (resizes and exports call this again).
            [tRandRotColor, tRandRotDepth, fbRandRot, tSceneColor, tSceneNormal, tSceneDepth, fbSceneColor, fbSceneNormal, tAO, fbAO, tFXAA, tFXAAOut, fbFXAA, fbFXAA2, tDOF, fbDOF, tPickColor, tPickDepth, fbPick, tDummy].forEach(function(o) { if (o) o.destroy(); });
            if (acc) release([acc.read.t, acc.read.fb, acc.write.t, acc.write.fb]);
            releaseSurfaceLayer();
            releaseShadowLayer();
            depthOptions = {
                internalFormat: gl.DEPTH_COMPONENT,
                format: gl.DEPTH_COMPONENT,
                type: gl.UNSIGNED_SHORT
            };
            // fbRandRot: depth seen along an AO direction (the color is not used).
            tRandRotColor = new webgl.Texture(gl, 0, null, aoResolution, aoResolution);
            tRandRotDepth = new webgl.Texture(gl, 1, null, aoResolution, aoResolution, depthOptions);
            fbRandRot = new webgl.Framebuffer(gl, [tRandRotColor], tRandRotDepth);

            // fbScene
            tSceneColor = new webgl.Texture(gl, 2, null, rx, ry);
            tSceneNormal = new webgl.Texture(gl, 3, null, rx, ry);
            tSceneDepth = new webgl.Texture(gl, 4, null, rx, ry, depthOptions);
            fbSceneColor = new webgl.Framebuffer(gl, [tSceneColor], tSceneDepth);
            fbSceneNormal = new webgl.Framebuffer(gl, [tSceneNormal], tSceneDepth);

            // Accumulators (units 5 and 6)
            acc = {read: target(5), write: target(6)};

            // fbAO
            tAO = new webgl.Texture(gl, 7, null, rx, ry);
            fbAO = new webgl.Framebuffer(gl, [tAO]);

            // FXAA passes alternate between two targets.
            tFXAA = new webgl.Texture(gl, 8, null, rx, ry);
            tFXAAOut = new webgl.Texture(gl, 9, null, rx, ry);
            fbFXAA = new webgl.Framebuffer(gl, [tFXAAOut]);
            fbFXAA2 = new webgl.Framebuffer(gl, [tFXAA]);

            // fbDOF
            tDOF = new webgl.Texture(gl, 10, null, rx, ry);
            fbDOF = new webgl.Framebuffer(gl, [tDOF]);

            // Picking
            tPickColor = new webgl.Texture(gl, 11, null, 1, 1);
            tPickDepth = new webgl.Texture(gl, 11, null, 1, 1, depthOptions);
            fbPick = new webgl.Framebuffer(gl, [tPickColor], tPickDepth);

            tDummy = new webgl.Texture(gl, 11, new Uint8Array(4), 1, 1);
            clearAccumulators();
        }

        // Translucent surface layer (units 11 - 14 when drawn), made when first needed.
        function ensureSurfaceLayer() {
            if (tSurfColor) return;
            tSurfColor = new webgl.Texture(gl, 11, null, rx, ry);
            tSurfNormal = new webgl.Texture(gl, 11, null, rx, ry);
            tSurfDepth = new webgl.Texture(gl, 11, null, rx, ry, depthOptions);
            fbSurfColor = new webgl.Framebuffer(gl, [tSurfColor], tSurfDepth);
            fbSurfNormal = new webgl.Framebuffer(gl, [tSurfNormal], tSurfDepth);
            surfAcc = {read: target(11), write: target(11)};
            // Occluders for the surface's own AO include the surface itself.
            tRandRotDepthAll = new webgl.Texture(gl, 11, null, aoResolution, aoResolution, depthOptions);
            fbRandRotAll = new webgl.Framebuffer(gl, [tRandRotColor], tRandRotDepthAll);
            clearAccumulators();
        }

        // Key-light shadows, made when first needed.
        function ensureShadowLayer() {
            if (tShadowMapColor) return;
            tShadowMapColor = new webgl.Texture(gl, 11, null, SHADOW_RES, SHADOW_RES);
            tShadowMap = new webgl.Texture(gl, 11, null, SHADOW_RES, SHADOW_RES, depthOptions);
            fbShadowMap = new webgl.Framebuffer(gl, [tShadowMapColor], tShadowMap);
            tShadow = new webgl.Texture(gl, 11, null, rx, ry);
            fbShadow = new webgl.Framebuffer(gl, [tShadow]);
        }

        function clearAccumulators() {
            [acc, surfAcc].forEach(function(pair) {
                if (!pair) return;
                [pair.read, pair.write].forEach(function(x) {
                    x.fb.bind();
                    gl.clear(gl.COLOR_BUFFER_BIT);
                });
            });
        }

        // The part of the view's square frame that the canvas shows.
        function visibleRect(rect) {
            var w = rect.right - rect.left, h = rect.top - rect.bottom;
            return {left: rect.left, bottom: rect.bottom,
                    right: rect.left + w * rx / m_resolution, top: rect.bottom + h * ry / m_resolution};
        }

        // Texture coordinates per frame unit (see the ao shader's uFrame).
        function frameScale() {
            return [m_resolution / rx, m_resolution / ry];
        }

        function bindUnit(texture, unit) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            texture.bind();
            return unit;
        }

        function transparentSurface(view) {
            var on = view.surface && rSurface != null && view.surfaceOpacity < 1;
            if (on) ensureSurfaceLayer();
            return on;
        }

        self.setResolution = function(res, aoRes) {
            aoResolution = aoRes;
            resolution = res;
            m_resolution = Math.max(resolution.x, resolution.y);
            rx = resolution.x;
            ry = resolution.y;
            canvas.width = resolution.x;
            canvas.height = resolution.y;
            gl.viewport(0, 0, rx, ry);
            self.createTextures();
            idleDisplayed = false;
        }


        // A renderable drawing `shape` (aImposter vertices) once per instance,
        // with per-instance attributes {name: [size, Float32Array]}. Uses
        // instancing when available; otherwise expands the data per vertex.
        function instances(program, shape, strip, count, perInstance) {
            var verts = shape.length / 3;
            var attribs = {aImposter: {buffer: new webgl.GLBuffer(gl), size: 3, divisor: 0}};
            if (instancing) {
                attribs.aImposter.buffer.set(new Float32Array(strip));
                for (var name in perInstance) {
                    attribs[name] = {buffer: new webgl.GLBuffer(gl), size: perInstance[name][0], divisor: 1};
                    attribs[name].buffer.set(perInstance[name][1]);
                }
                var inst = new webgl.InstancedRenderable(gl, program, attribs, strip.length / 3, count, instancing,
                                                         gl.TRIANGLE_STRIP);
                inst.instances = count;
                inst.vertices = count * strip.length / 3;
                return inst;
            }
            var imposter = new Float32Array(shape.length * count);
            for (var i = 0; i < count; i++) imposter.set(shape, i * shape.length);
            attribs.aImposter.buffer.set(imposter);
            for (var name in perInstance) {
                var size = perInstance[name][0], data = perInstance[name][1];
                var out = new Float32Array(size * verts * count);
                for (var i = 0; i < count; i++) {
                    for (var v = 0; v < verts; v++) {
                        for (var c = 0; c < size; c++) out[(i * verts + v) * size + c] = data[i * size + c];
                    }
                }
                attribs[name] = {buffer: new webgl.GLBuffer(gl), size: size};
                attribs[name].buffer.set(out);
            }
            var expanded = new webgl.Renderable(gl, program, attribs, verts * count / 3);
            expanded.instances = count;
            expanded.vertices = count * verts;
            return expanded;
        }

        // AO samples that fit the per-frame vertex budget (at least one).
        function samplesPerFrame(wanted) {
            return Math.max(1, Math.min(wanted, Math.floor(VERTEX_BUDGET / Math.max(1, sceneVertices))));
        }

        self.setSystem = function(newSystem, view) {

            system = newSystem;

            // Release the previous geometry (large structures use a lot of GPU memory).
            [rAtoms, rBonds, rCartoon, rSurface, rCell].forEach(webgl.destroy);
            rAtoms = rBonds = rCartoon = rSurface = rCell = null;

            // Atoms: one screen-aligned quad per atom.
            var n = 0;
            for (var i = 0; i < system.atoms.length; i++) {
                if (!system.atoms[i].hidden) n++;
            }
            var aPosition = new Float32Array(3 * n), aRadius = new Float32Array(n), aColor = new Float32Array(3 * n),
                aMetal = new Float32Array(n), aScale = new Float32Array(n);
            var k = 0;
            for (var i = 0; i < system.atoms.length; i++) {
                var a = system.atoms[i];
                if (a.hidden) continue;
                var c = a.displayColor || view.elements[a.symbol].color;
                aPosition[3 * k] = a.x; aPosition[3 * k + 1] = a.y; aPosition[3 * k + 2] = a.z;
                aRadius[k] = view.elements[a.symbol].radius;
                aColor[3 * k] = c[0]; aColor[3 * k + 1] = c[1]; aColor[3 * k + 2] = c[2];
                aMetal[k] = consts.isMetal(a.symbol) ? 1 : 0;
                // Residues modeled by their trace atom only (CA- or P-only chains)
                // are drawn as one residue-sized sphere, so coarse models read
                // as solid molecules.
                var coarse = a.polymer && a.residue && a.residue.list.length === 1 ? 2.3 : 1;
                aScale[k] = (a.highlight ? view.highlightScale : 1) * coarse;
                k++;
            }
            rAtoms = instances(progAtoms, QUAD, QUAD_STRIP, n, {
                aPosition: [3, aPosition], aRadius: [1, aRadius], aColor: [3, aColor], aMetal: [1, aMetal], aScale: [1, aScale]
            });

            // Bonds: one box per bond, between atom index pairs.
            rBonds = null;
            var bonds = system.bonds;
            if (view.bonds && bonds && bonds.count > 0) {
                var m = bonds.count;
                var aPosA = new Float32Array(3 * m), aPosB = new Float32Array(3 * m), aRadA = new Float32Array(m),
                    aRadB = new Float32Array(m), aColA = new Float32Array(3 * m), aColB = new Float32Array(3 * m),
                    aMetA = new Float32Array(m), aMetB = new Float32Array(m);
                for (var i = 0; i < m; i++) {
                    var p = system.atoms[bonds.a[i]], q = system.atoms[bonds.b[i]];
                    var ep = view.elements[p.symbol], eq = view.elements[q.symbol];
                    var cp = p.displayColor || ep.color, cq = q.displayColor || eq.color;
                    aPosA[3 * i] = p.x; aPosA[3 * i + 1] = p.y; aPosA[3 * i + 2] = p.z;
                    aPosB[3 * i] = q.x; aPosB[3 * i + 1] = q.y; aPosB[3 * i + 2] = q.z;
                    aRadA[i] = ep.radius; aRadB[i] = eq.radius;
                    aColA[3 * i] = cp[0]; aColA[3 * i + 1] = cp[1]; aColA[3 * i + 2] = cp[2];
                    aColB[3 * i] = cq[0]; aColB[3 * i + 1] = cq[1]; aColB[3 * i + 2] = cq[2];
                    aMetA[i] = consts.isMetal(p.symbol) ? 1 : 0; aMetB[i] = consts.isMetal(q.symbol) ? 1 : 0;
                }
                rBonds = instances(progBonds, cube.position, CUBE_STRIP, m, {
                    aPosA: [3, aPosA], aPosB: [3, aPosB], aRadA: [1, aRadA], aRadB: [1, aRadB],
                    aColA: [3, aColA], aColB: [3, aColB], aMetA: [1, aMetA], aMetB: [1, aMetB]
                });
            }

            // Cartoon and molecular surface (triangle meshes)

            rCartoon = view.cartoon ? meshRenderable(Cartoon.buildMesh(system, view)) : null;
            rSurface = view.surface ? meshRenderable(Surface.buildMesh(system, view)) : null;
            rCell = view.unitCell && system.cell ? meshRenderable(Cell.buildMesh(system, view)) : null;
            sceneVertices = rAtoms.vertices + (rBonds ? rBonds.vertices : 0) +
                [rCartoon, rSurface, rCell].reduce(function(t, r) { return t + (r ? r.vertices : 0); }, 0);

        }

        // A triangle mesh {position, normal, color (floats, 3 per vertex),
        // index (optional, 3 per triangle), count (indices, or vertices)}.
        // Normals and colors go to the GPU as 4 bytes each (not 12), and
        // shared vertices are stored once when the mesh is indexed.
        function meshRenderable(mesh) {
            if (mesh.count === 0) {
                return null;
            }
            var index = mesh.index;
            if (index && !elementIndexUint && mesh.position.length / 3 > 65536) {
                mesh = unindex(mesh);
                index = null;
            }
            var n = mesh.position.length / 3;
            var normal = new Int8Array(4 * n), color = new Uint8Array(4 * n);
            for (var i = 0; i < n; i++) {
                for (var c = 0; c < 3; c++) {
                    normal[4 * i + c] = Math.round(Math.max(-1, Math.min(1, mesh.normal[3 * i + c])) * 127);
                    color[4 * i + c] = Math.round(Math.max(0, Math.min(1, mesh.color[3 * i + c])) * 255);
                }
            }
            var attribs = {
                aPosition: {buffer: new webgl.GLBuffer(gl), size: 3},
                aNormal: {buffer: new webgl.GLBuffer(gl), size: 4, type: gl.BYTE, normalized: true},
                aColor: {buffer: new webgl.GLBuffer(gl), size: 4, type: gl.UNSIGNED_BYTE, normalized: true}
            };
            attribs.aPosition.buffer.set(mesh.position);
            attribs.aNormal.buffer.set(normal);
            attribs.aColor.buffer.set(color);
            var r;
            if (index) {
                var small = n <= 65536;
                var buffer = new webgl.GLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER);
                buffer.set(small ? new Uint16Array(index) : (index instanceof Uint32Array ? index : new Uint32Array(index)));
                r = new webgl.Renderable(gl, progCartoon, attribs, index.length / 3,
                    {buffer: buffer, count: index.length, type: small ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT});
            } else {
                r = new webgl.Renderable(gl, progCartoon, attribs, mesh.count / 3);
            }
            r.vertices = mesh.count;
            return r;
        }

        // An indexed mesh as plain triangles (browsers without 32-bit indices).
        function unindex(mesh) {
            var idx = mesh.index, m = idx.length;
            var out = {position: new Float32Array(3 * m), normal: new Float32Array(3 * m), color: new Float32Array(3 * m), count: m};
            for (var i = 0; i < m; i++) {
                for (var c = 0; c < 3; c++) {
                    out.position[3 * i + c] = mesh.position[3 * idx[i] + c];
                    out.normal[3 * i + c] = mesh.normal[3 * idx[i] + c];
                    out.color[3 * i + c] = mesh.color[3 * idx[i] + c];
                }
            }
            return out;
        }

        function drawMesh(renderable, shade, projection, viewMat, model, mode) {
            // Meshes are closed, so culling is not needed and would depend on winding.
            gl.disable(gl.CULL_FACE);
            progCartoon.setUniform("uProjection", "Matrix4fv", false, projection);
            progCartoon.setUniform("uView", "Matrix4fv", false, viewMat);
            progCartoon.setUniform("uModel", "Matrix4fv", false, model);
            progCartoon.setUniform("uCartoonShade", "1f", shade);
            progCartoon.setUniform("uMode", "1i", mode);
            renderable.render();
            gl.enable(gl.CULL_FACE);
        }

        // layer: "opaque" (the translucent surface is left out), "surface" (only
        // the surface) or "all".
        function drawCartoon(view, projection, viewMat, model, mode, layer) {
            layer = layer || "opaque";
            if (view.cartoon && rCartoon != null && layer !== "surface") {
                drawMesh(rCartoon, view.cartoonShade, projection, viewMat, model, mode);
            }
            if (view.unitCell && rCell != null && layer !== "surface") {
                drawMesh(rCell, 0.0, projection, viewMat, model, mode);
            }
            if (view.surface && rSurface != null &&
                (layer !== "opaque" || !transparentSurface(view))) {
                drawMesh(rSurface, view.surfaceShade, projection, viewMat, model, mode);
            }
        }

        self.reset = function() {
            sampleCount = 0;
            colorRendered = false;
            normalRendered = false;
            shadowRendered = false;
            idleDisplayed = false;
            clearAccumulators();
        }

        // Whether every pass for the view is done (nothing left to refine).
        function converged(view) {
            return colorRendered && normalRendered && (shadowRendered || !(view.shadows > 0)) &&
                (view.ao <= 0 || sampleCount >= maxSamples(view));
        }

        // One step of progressive rendering, then the picture. Once the view has
        // converged and is on screen, nothing is drawn until reset() (the canvas
        // keeps its picture), unless `force`. Returns whether it drew.
        self.render = function(view, force) {
            if (system === undefined) {
                return false;
            }
            if (rAtoms == null) {
                return false;
            }
            if (idleDisplayed && !force && lastView === view && converged(view)) {
                return false;
            }

            range = System.getRadius(system) * 2.0;
            lastView = view;

            if (!colorRendered) {
                color(view);
            } else if (!normalRendered){
                normal(view);
            } else if (!shadowRendered && view.shadows > 0) {
                shadowRendered = true;
                shadow(view);
            } else {
                var spf = samplesPerFrame(view.spf);
                for (var i = 0; i < spf; i++) {
                    if (sampleCount >= maxSamples(view)) {
                        break;
                    }
                    sample(view);
                    sampleCount++;
                }
            }
            display(view);
            idleDisplayed = converged(view);
            return true;
        }

        // One complete frame for a moving view (auto-rotate): color, normals,
        // shadows and `samples` AO samples at once, instead of the progressive
        // passes, so a moving molecule keeps its shading. The sample directions
        // are fixed to the molecule rather than the screen, so every frame sees
        // the same occlusion maps and the AO does not flicker as it turns.
        self.renderMoving = function(view, samples) {
            if (system === undefined || rAtoms == null) {
                return;
            }
            self.reset();
            range = System.getRadius(system) * 2.0;
            lastView = view;
            color(view);
            normal(view);
            if (view.shadows > 0) {
                shadowRendered = true;
                shadow(view);
            }
            var n = Math.min(samplesPerFrame(samples), maxSamples(view));
            var toView = glm.mat4.invert(glm.mat4.create(), view.rotation);
            for (var i = 0; i < n; i++) {
                sample(view, glm.mat4.multiply(glm.mat4.create(), aoRotation(i, true), toView));
                sampleCount++;
            }
            display(view);
            idleDisplayed = false;
        }

        // Video frames: like renderMoving, with the sample directions fixed to
        // the molecule (so consecutive frames match), but refined over several
        // calls after reset() until `total` samples. Returns true when done.
        self.renderFixed = function(view, total) {
            if (system === undefined || rAtoms == null) {
                return true;
            }
            range = System.getRadius(system) * 2.0;
            lastView = view;
            if (!colorRendered) {
                color(view);
                normal(view);
                if (view.shadows > 0) {
                    shadowRendered = true;
                    shadow(view);
                }
            }
            var goal = view.ao > 0 ? Math.min(total, maxSamples(view)) : 0;
            var n = samplesPerFrame(view.spf);
            var toView = glm.mat4.invert(glm.mat4.create(), view.rotation);
            for (var i = 0; i < n && sampleCount < goal; i++) {
                sample(view, glm.mat4.multiply(glm.mat4.create(), aoRotation(sampleCount, true), toView));
                sampleCount++;
            }
            display(view);
            idleDisplayed = false;
            return sampleCount >= goal;
        }

        // Normalized depth of a selection seen with `view` (as the focus of
        // depth of field).
        self.selectionDepth = function(view, selection) {
            if (system === undefined) return view.dofPosition;
            range = System.getRadius(system) * 2.0;
            var saved = view.dofFocus;
            view.dofFocus = selection;
            var d = focusDepth(view);
            view.dofFocus = saved;
            return d;
        }

        // Draws atoms, bonds and meshes framed on rect into the bound
        // framebuffer (res x res pixels). mode 0: color, 1: normals, 2: packed
        // depth (picking). Returns the matrices for extra mesh passes.
        function drawScene(view, rect, res, mode, layer) {
            var projection = glm.mat4.create();
            glm.mat4.ortho(projection, rect.left, rect.right, rect.bottom, rect.top, 0, range);
            var viewMat = glm.mat4.create();
            glm.mat4.lookAt(viewMat, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
            var model = glm.mat4.create();
            glm.mat4.translate(model, model, [0, 0, -range/2]);
            glm.mat4.multiply(model, model, view.rotation);
            setClip(view, view.rotation);
            progAtoms.setUniform("uProjection", "Matrix4fv", false, projection);
            progAtoms.setUniform("uView", "Matrix4fv", false, viewMat);
            progAtoms.setUniform("uModel", "Matrix4fv", false, model);
            progAtoms.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
            progAtoms.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
            progAtoms.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
            progAtoms.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
            progAtoms.setUniform("uRes", "2fv", res);
            progAtoms.setUniform("uDepth", "1f", range);
            progAtoms.setUniform("uMode", "1i", mode);
            progAtoms.setUniform("uAtomShade", "1f", view.atomShade);
            rAtoms.render();

            if (view.bonds && rBonds != null) {
                progBonds.setUniform("uProjection", "Matrix4fv", false, projection);
                progBonds.setUniform("uView", "Matrix4fv", false, viewMat);
                progBonds.setUniform("uModel", "Matrix4fv", false, model);
                progBonds.setUniform("uRotation", "Matrix4fv", false, view.rotation);
                progBonds.setUniform("uDepth", "1f", range);
                progBonds.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
                progBonds.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
                progBonds.setUniform("uRes", "2fv", res);
                progBonds.setUniform("uBondRadius", "1f", 2.5 * View.getBondRadius(view));
                progBonds.setUniform("uBondShade", "1f", view.bondShade);
                progBonds.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
                progBonds.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
                progBonds.setUniform("uMode", "1i", mode);
                rBonds.render();
            }

            drawCartoon(view, projection, viewMat, model, mode, layer);
            return {projection: projection, viewMat: viewMat, model: model};
        }

        function color(view) {
            colorRendered = true;
            fogExtent = depthExtent(view);
            dofDepth = focusDepth(view);
            gl.viewport(0, 0, rx, ry);
            fbSceneColor.bind();
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            var pass = drawScene(view, visibleRect(View.getRect(view)), [rx, ry], 0, "opaque");
            if (transparentSurface(view)) {
                fbSurfColor.bind();
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                drawCartoon(view, pass.projection, pass.viewMat, pass.model, 0, "surface");
            }
        }

        function normal(view) {
            normalRendered = true;
            gl.viewport(0, 0, rx, ry);
            fbSceneNormal.bind();
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            var pass = drawScene(view, visibleRect(View.getRect(view)), [rx, ry], 1, "opaque");
            if (transparentSurface(view)) {
                fbSurfNormal.bind();
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                drawCartoon(view, pass.projection, pass.viewMat, pass.model, 1, "surface");
            }
        }

        // Normalized scene depth [0, 1] at a point of the canvas (fx, fy in
        // [0, 1] from the bottom-left), or null over the background. Renders
        // just that pixel into a 1x1 buffer; a translucent surface is skipped
        // so the focus lands on what is seen through it.
        self.pickDepth = function(view, fx, fy) {
            if (system === undefined || rAtoms == null) {
                return null;
            }
            range = System.getRadius(system) * 2.0;
            var rect = View.getRect(view);
            var w = rect.right - rect.left;
            // The canvas shows the bottom-left part of a square frame of side m_resolution.
            var x = rect.left + fx * w * resolution.x / m_resolution;
            var y = rect.bottom + fy * w * resolution.y / m_resolution;
            var half = w / m_resolution / 2;
            fbPick.bind();
            gl.viewport(0, 0, 1, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            drawScene(view, {left: x - half, right: x + half, bottom: y - half, top: y + half}, [1, 1], 2, "opaque");
            var px = new Uint8Array(4);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            if (px[0] === 0 && px[1] === 0 && px[2] === 0 && px[3] === 0) {
                return null;
            }
            return px[0] / 255 + px[1] / 65025 + px[2] / 16581375 + px[3] / 4228250625;
        };

        // Renders the scene's depth seen along rot (applied on top of the view
        // rotation), framed on the whole bounding sphere, into the bound
        // framebuffer. Used for the AO samples and the key-light shadow map.
        function renderRotated(view, rot, res, layer) {
            gl.viewport(0, 0, res, res);
            // Only depth is used: no color writes.
            gl.colorMask(false, false, false, false);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            // The camera of this pass (not a copy of the whole view).
            var v = {zoom: 1 / range, aspect: view.aspect, translation: {x: 0, y: 0}, atomScale: view.atomScale,
                     rotation: glm.mat4.multiply(glm.mat4.create(), rot, view.rotation)};
            var rect = View.getRect(v);
            var projection = glm.mat4.create();
            glm.mat4.ortho(projection, rect.left, rect.right, rect.bottom, rect.top, 0, range);
            var viewMat = glm.mat4.create();
            glm.mat4.lookAt(viewMat, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
            var model = glm.mat4.create();
            glm.mat4.translate(model, model, [0, 0, -range/2]);
            glm.mat4.multiply(model, model, v.rotation);
            setClip(view, v.rotation);
            progAtoms.setUniform("uProjection", "Matrix4fv", false, projection);
            progAtoms.setUniform("uView", "Matrix4fv", false, viewMat);
            progAtoms.setUniform("uModel", "Matrix4fv", false, model);
            progAtoms.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
            progAtoms.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
            progAtoms.setUniform("uAtomScale", "1f", 2.5 * v.atomScale);
            progAtoms.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
            progAtoms.setUniform("uRes", "2fv", [res, res]);
            progAtoms.setUniform("uDepth", "1f", range);
            progAtoms.setUniform("uMode", "1i", 3);
            progAtoms.setUniform("uAtomShade", "1f", view.atomShade);
            rAtoms.render();

            if (view.bonds && rBonds != null) {
                progBonds.setUniform("uProjection", "Matrix4fv", false, projection);
                progBonds.setUniform("uView", "Matrix4fv", false, viewMat);
                progBonds.setUniform("uModel", "Matrix4fv", false, model);
                progBonds.setUniform("uRotation", "Matrix4fv", false, v.rotation);
                progBonds.setUniform("uDepth", "1f", range);
                progBonds.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
                progBonds.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
                progBonds.setUniform("uRes", "2fv", [res, res]);
                progBonds.setUniform("uBondRadius", "1f", 2.5 * View.getBondRadius(view));
                progBonds.setUniform("uBondShade", "1f", view.bondShade);
                progBonds.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
                progBonds.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
                progBonds.setUniform("uMode", "1i", 3);
                rBonds.render();
            }

            drawCartoon(view, projection, viewMat, model, 3, layer);
            gl.colorMask(true, true, true, true);
            return {v: v, projection: projection, viewMat: viewMat, model: model};
        }

        function sample(view, rot) {
            rot = rot || aoRotation(sampleCount);
            fbRandRot.bind();
            var pass = renderRotated(view, rot, aoResolution, "opaque");
            var v = pass.v, projection = pass.projection, viewMat = pass.viewMat, model = pass.model;

            var sceneRect = visibleRect(View.getRect(view));
            var rotRect = View.getRect(v);
            var invRot = glm.mat4.invert(glm.mat4.create(), rot);

            gl.viewport(0, 0, rx, ry);
            acc.write.fb.bind();
            accumulate(tSceneDepth.index, tSceneNormal.index, tRandRotDepth.index, bindUnit(acc.read.t, 5),
                       sceneRect, rotRect, rot, invRot);
            var swap = acc.read; acc.read = acc.write; acc.write = swap;

            if (transparentSurface(view)) {
                // Same random direction, with the surface added as an occluder.
                // Atom and bond uniforms are still set from the pass above.
                gl.viewport(0, 0, aoResolution, aoResolution);
                fbRandRotAll.bind();
                gl.colorMask(false, false, false, false);
                gl.clear(gl.DEPTH_BUFFER_BIT);
                rAtoms.render();
                if (view.bonds && rBonds != null) {
                    rBonds.render();
                }
                drawCartoon(view, projection, viewMat, model, 3, "all");
                gl.colorMask(true, true, true, true);

                gl.viewport(0, 0, rx, ry);
                surfAcc.write.fb.bind();
                accumulate(bindUnit(tSurfDepth, 11), bindUnit(tSurfNormal, 12),
                           bindUnit(tRandRotDepthAll, 13), bindUnit(surfAcc.read.t, 14),
                           sceneRect, rotRect, rot, invRot);
                var s2 = surfAcc.read; surfAcc.read = surfAcc.write; surfAcc.write = s2;
            }
        }

        // Rotation whose inverse maps the view axis onto the i-th direction of an
        // R2 low-discrepancy sequence on the sphere, so every prefix of samples
        // covers all directions evenly. A random roll jitters the shadow-map grid.
        function aoRotation(i, fixedRoll) {
            var u = (0.5 + i * 0.7548776662466927) % 1;
            var w = (0.5 + i * 0.5698402909980532) % 1;
            var z = 1 - 2 * u;
            var rxy = Math.sqrt(Math.max(0, 1 - z * z));
            var phi = 2 * Math.PI * w;
            var d = glm.vec3.fromValues(rxy * Math.cos(phi), rxy * Math.sin(phi), z);
            var q = glm.quat.rotationTo(glm.quat.create(), d, glm.vec3.fromValues(0, 0, 1));
            var roll = glm.quat.setAxisAngle(glm.quat.create(), [0, 0, 1],
                (fixedRoll ? (i * 2.399963) % 1 : Math.random()) * 2 * Math.PI);
            glm.quat.multiply(q, roll, q);
            return glm.mat4.fromQuat(glm.mat4.create(), q);
        }

        // Key-light visibility for every scene pixel (computed once per view).
        function shadow(view) {
            var rot = glm.mat4.fromQuat(glm.mat4.create(),
                glm.quat.rotationTo(glm.quat.create(), LIGHT_DIR, glm.vec3.fromValues(0, 0, 1)));
            ensureShadowLayer();
            fbShadowMap.bind();
            var pass = renderRotated(view, rot, SHADOW_RES, "opaque");
            var sceneRect = visibleRect(View.getRect(view));
            var rotRect = View.getRect(pass.v);
            gl.viewport(0, 0, rx, ry);
            fbShadow.bind();
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            progShadow.setUniform("uSceneDepth", "1i", tSceneDepth.index);
            progShadow.setUniform("uSceneNormal", "1i", tSceneNormal.index);
            progShadow.setUniform("uShadowMap", "1i", bindUnit(tShadowMap, 11));
            progShadow.setUniform("uSceneBottomLeft", "2fv", [sceneRect.left, sceneRect.bottom]);
            progShadow.setUniform("uSceneTopRight", "2fv", [sceneRect.right, sceneRect.top]);
            progShadow.setUniform("uRotBottomLeft", "2fv", [rotRect.left, rotRect.bottom]);
            progShadow.setUniform("uRotTopRight", "2fv", [rotRect.right, rotRect.top]);
            progShadow.setUniform("uRes", "2fv", [rx, ry]);
            progShadow.setUniform("uDepth", "1f", range);
            progShadow.setUniform("uShadowRes", "1f", SHADOW_RES);
            progShadow.setUniform("uSoftness", "1f", view.shadowSoftness);
            progShadow.setUniform("uRot", "Matrix4fv", false, rot);
            progShadow.setUniform("uInvRot", "Matrix4fv", false, glm.mat4.invert(glm.mat4.create(), rot));
            rShadow.render();
        }

        // Normalized depth of the dofFocus selection's center, or dofPosition.
        function focusDepth(view) {
            var sel = view.dofFocus;
            if (!sel || Object.keys(sel).length === 0) {
                return view.dofPosition;
            }
            var key = JSON.stringify(sel);
            if (!system._dofFocus || system._dofFocus.key !== key) {
                system._dofFocus = {key: key, indices: Select.indices(system, sel)};
            }
            var idx = system._dofFocus.indices;
            if (idx.length === 0) {
                return view.dofPosition;
            }
            var m = view.rotation, z = 0, front = -Infinity;
            for (var i = 0; i < idx.length; i++) {
                var a = system.atoms[idx[i]];
                var zi = m[2] * a.x + m[6] * a.y + m[10] * a.z;
                z += zi;
                front = Math.max(front, zi);
            }
            z /= idx.length;
            // Focus toward the nearest part of the subject, as a photographer would.
            z += 0.4 * (front - z);
            return Math.min(1, Math.max(0, 0.5 - z / range));
        }

        // Front and back of the drawn structure in normalized depth, for fog.
        // Cutaway plane for a pass whose rotation is `rotation`: facing the main
        // camera (view.rotation), so the front of the structure is removed down
        // to view.cutaway (0: nothing, 0.5: through the center, 1: everything).
        // The cut plane's normal in model space: the camera axis, or a fixed
        // axis of the molecule (so rotating shows the cut from the side).
        function clipNormal(view) {
            var axis = view.cutawayAxis;
            if (axis === "x") return [1, 0, 0];
            if (axis === "y") return [0, 1, 0];
            if (axis === "z") return [0, 0, 1];
            var m = view.rotation;
            return [m[2], m[6], m[10]];                    // camera axis in model space
        }

        function setClip(view, rotation) {
            var on = view.cutaway > 0 ? 1.0 : 0.0;
            var n = clipNormal(view);
            var r = rotation;
            var nr = [r[0] * n[0] + r[4] * n[1] + r[8] * n[2],
                      r[1] * n[0] + r[5] * n[1] + r[9] * n[2],
                      r[2] * n[0] + r[6] * n[1] + r[10] * n[2]];
            var radius = range / 2;
            var plane = [nr[0], nr[1], nr[2], radius * (1 - 2 * Math.min(1, Math.max(0, view.cutaway || 0)))];
            [progAtoms, progBonds, progCartoon].forEach(function(p) {
                p.setUniform("uClip", "4fv", plane);
                p.setUniform("uClipOn", "1f", on);
            });
            progCartoon.setUniform("uClipOffset", "1f", range / 2);
        }

        // Where the studio floor meets the molecule: the lowest point of what is
        // drawn, in the frame's texture coordinates, plus the molecule's height.
        // Recomputed only when the view or the structure changes.
        var floorCache = {key: null, value: null};
        function floorLine(view) {
            if (!(view.floor > 0) || !system) return null;
            var m = view.rotation;
            var key = [Array.prototype.join.call(m), view.zoom, view.translation.x, view.translation.y,
                       view.atomScale, view.relativeAtomScale, view.cartoon, view.surface, view.surfaceProbe,
                       system.version || 0, system.atoms.length, rAtoms ? rAtoms.instances : 0].join();
            if (floorCache.key === key) return floorCache.value;
            var lo = Infinity, hi = -Infinity, left = Infinity, right = -Infinity;
            var pad = view.surface ? (view.surfaceProbe || 1.4) + 1.9 : view.cartoon ? 1.4 : 0;
            for (var i = 0; i < system.atoms.length; i++) {
                var a = system.atoms[i];
                // Drawn atoms; for cartoons the backbone trace; for surfaces the
                // atoms they wrap.
                var traced = view.cartoon && a.polymer && (a.name === "CA" || a.name === "P");
                var wrapped = view.surface && (a.polymer || view.surfaceAtoms === "all");
                if (a.hidden && !traced && !wrapped) continue;
                var r = a.hidden ? 0 : 2.5 * view.atomScale * (1 + (view.elements[a.symbol].radius - 1) * view.relativeAtomScale);
                var y = m[1] * a.x + m[5] * a.y + m[9] * a.z;
                var x = m[0] * a.x + m[4] * a.y + m[8] * a.z;
                var extent = a.hidden ? pad : Math.max(r, view.surface ? pad : 0);
                if (y - extent < lo) lo = y - extent;
                if (y + extent > hi) hi = y + extent;
                if (x - extent < left) left = x - extent;
                if (x + extent > right) right = x + extent;
            }
            var rect = View.getRect(view);
            var span = rect.top - rect.bottom;
            var wspan = rect.right - rect.left;
            floorCache = {key: key, value: lo < Infinity ?
                {y: (lo - rect.bottom) / span, height: (hi - lo) / span,
                 x: ((left + right) / 2 - rect.left) / wspan, width: (right - left) / wspan} : null};
            return floorCache.value;
        }

        function depthExtent(view) {
            var m = view.rotation;
            var zmin = Infinity, zmax = -Infinity;
            for (var i = 0; i < system.atoms.length; i++) {
                var a = system.atoms[i];
                if (a.hidden && !a.polymer) continue;
                var z = m[2] * a.x + m[6] * a.y + m[10] * a.z;
                zmin = Math.min(zmin, z);
                zmax = Math.max(zmax, z);
            }
            if (zmin > zmax) {
                return {near: 0, far: 1};
            }
            // Depth grows away from the viewer: depth = 0.5 - z / range.
            return {near: 0.5 - (zmax + 1.5) / range, far: 0.5 - (zmin - 1.5) / range};
        }

        function accumulate(depthUnit, normalUnit, rotDepthUnit, accUnit, sceneRect, rotRect, rot, invRot) {
            progAccumulator.setUniform("uSceneDepth", "1i", depthUnit);
            progAccumulator.setUniform("uSceneNormal", "1i", normalUnit);
            progAccumulator.setUniform("uRandRotDepth", "1i", rotDepthUnit);
            progAccumulator.setUniform("uAccumulator", "1i", accUnit);
            progAccumulator.setUniform("uSceneBottomLeft", "2fv", [sceneRect.left, sceneRect.bottom]);
            progAccumulator.setUniform("uSceneTopRight", "2fv", [sceneRect.right, sceneRect.top]);
            progAccumulator.setUniform("uRotBottomLeft", "2fv", [rotRect.left, rotRect.bottom]);
            progAccumulator.setUniform("uRotTopRight", "2fv", [rotRect.right, rotRect.top]);
            progAccumulator.setUniform("uRes", "2fv", [rx, ry]);
            progAccumulator.setUniform("uDepth", "1f", range);
            progAccumulator.setUniform("uAORes", "1f", aoResolution);
            progAccumulator.setUniform("uRot", "Matrix4fv", false, rot);
            progAccumulator.setUniform("uInvRot", "Matrix4fv", false, invRot);
            progAccumulator.setUniform("uSampleCount", "1i", sampleCount);
            rAccumulator.render();
        }

        function display(view) {
            gl.viewport(0, 0, rx, ry);
            if (view.fxaa > 0 || view.dofStrength > 0) {
                fbAO.bind();
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
            gl.clear(gl.COLOR_BUFFER_BIT);
            progAO.setUniform("uSceneColor", "1i", tSceneColor.index);
            progAO.setUniform("uSceneDepth", "1i", tSceneDepth.index);
            progAO.setUniform("uAccumulatorOut", "1i", bindUnit(acc.read.t, 5));
            progAO.setUniform("uRes", "2fv", [rx, ry]);
            progAO.setUniform("uFrame", "2fv", frameScale());
            // The shader scale assumes 1024 samples; normalize by the samples taken
            // so far, so AO shows at full strength at once and then refines.
            progAO.setUniform("uAO", "1f", 2.0 * view.ao * 1024 / Math.max(1, Math.min(sampleCount, maxSamples(view))));
            progAO.setUniform("uBrightness", "1f", 2.0 * view.brightness);
            progAO.setUniform("uOutlineStrength", "1f", view.outline);
            progAO.setUniform("uDepth", "1f", range);
            progAO.setUniform("uSceneNormal", "1i", tSceneNormal.index);
            progAO.setUniform("uSpecular", "1f", view.specular);
            progAO.setUniform("uGloss", "1f", view.gloss);
            progAO.setUniform("uMetallic", "1f", view.metallic);
            progAO.setUniform("uMetalAll", "1f", view.metallicAtoms === "metals" ? 0 : 1);
            progAO.setUniform("uLightDir", "3fv", LIGHT_DIR);
            // Layers that are not allocated are stood in for by a 1 x 1 texture.
            var surf = transparentSurface(view);
            progAO.setUniform("uSurfaceColor", "1i", bindUnit(surf ? tSurfColor : tDummy, 11));
            progAO.setUniform("uSurfaceDepth", "1i", bindUnit(surf ? tSurfDepth : tDummy, 12));
            progAO.setUniform("uSurfaceNormal", "1i", bindUnit(surf ? tSurfNormal : tDummy, 13));
            progAO.setUniform("uSurfaceAccumulator", "1i", bindUnit(surf ? surfAcc.read.t : tDummy, 14));
            progAO.setUniform("uSurfaceOpacity", "1f", surf ? view.surfaceOpacity : 1.0);
            progAO.setUniform("uShadow", "1i", bindUnit(tShadowMapColor && shadowRendered ? tShadow : tDummy, 15));
            progAO.setUniform("uShadows", "1f", shadowRendered ? view.shadows : 0.0);
            progAO.setUniform("uRim", "1f", view.rim);
            progAO.setUniform("uFog", "1f", view.fog);
            progAO.setUniform("uFogColor", "3fv", parseColor(view.fogColor, [1, 1, 1]));
            progAO.setUniform("uFogNear", "1f", fogExtent.near);
            progAO.setUniform("uFogFar", "1f", fogExtent.far);
            progAO.setUniform("uSaturation", "1f", view.saturation);
            progAO.setUniform("uTonemap", "1f", view.tonemap ? 1 : 0);
            progAO.setUniform("uOutlineWidth", "1f", view.outlineWidth);
            progAO.setUniform("uOutlineColor", "3fv", parseColor(view.outlineColor, [0, 0, 0]));
            progAO.setUniform("uOutlineEdges", "1f", view.outlineMode === "molecules" ? 1.0 : 0.0);
            // Cutaway fill light: the plane in the main view's centered frame.
            var cn = clipNormal(view), R = view.rotation;
            var cr = [R[0] * cn[0] + R[4] * cn[1] + R[8] * cn[2], R[1] * cn[0] + R[5] * cn[1] + R[9] * cn[2],
                      R[2] * cn[0] + R[6] * cn[1] + R[10] * cn[2]];
            var crect = View.getRect(view);
            progAO.setUniform("uCut", "4fv", [cr[0], cr[1], cr[2], (range / 2) * (1 - 2 * Math.min(1, Math.max(0, view.cutaway || 0)))]);
            progAO.setUniform("uCutLight", "1f", view.cutaway > 0 ? (view.cutawayLight === undefined ? 0.5 : view.cutawayLight) : 0.0);
            progAO.setUniform("uRect", "4fv", [crect.left, crect.bottom, crect.right, crect.top]);
            var fl = floorLine(view);
            progAO.setUniform("uFloor", "1f", fl ? view.floor : 0.0);
            progAO.setUniform("uFloorReflect", "1f", fl ? (view.floorReflection || 0) : 0.0);
            progAO.setUniform("uFloorY", "1f", fl ? fl.y : 0.0);
            progAO.setUniform("uFloorHeight", "1f", fl ? fl.height : 0.0);
            progAO.setUniform("uFloorX", "1f", fl ? fl.x : 0.5);
            progAO.setUniform("uFloorWidth", "1f", fl ? fl.width : 1.0);
            rAO.render();

            // FXAA passes alternate between two targets; the last one goes to
            // the canvas unless depth of field follows.
            var last = tAO;
            if (view.fxaa > 0) {
                var outs = [{fb: fbFXAA, t: tFXAAOut}, {fb: fbFXAA2, t: tFXAA}];
                for (var i = 0; i < view.fxaa; i++) {
                    var toCanvas = i === view.fxaa - 1 && !(view.dofStrength > 0);
                    if (toCanvas) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    else outs[i % 2].fb.bind();
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    progFXAA.setUniform("uTexture", "1i", bindUnit(last, 8));
                    progFXAA.setUniform("uRes", "2fv", [rx, ry]);
                    rFXAA.render();
                    if (!toCanvas) last = outs[i % 2].t;
                }
            }

            if (view.dofStrength > 0) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clear(gl.COLOR_BUFFER_BIT);
                progDOF.setUniform("uColor", "1i", bindUnit(last, 8));
                progDOF.setUniform("uDepth", "1i", tSceneDepth.index);
                progDOF.setUniform("uDOFPosition", "1f", dofDepth);
                progDOF.setUniform("uRange", "1f", range);
                progDOF.setUniform("uZoom", "1f", view.zoom);
                progDOF.setUniform("uDOFStrength", "1f", view.dofStrength);
                progDOF.setUniform("uRes", "2fv", [rx, ry]);
                progDOF.setUniform("uFrame", "2fv", frameScale());
                rDOF.render();
            }


            // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // progDisplayQuad.setUniform("uTexture", "1i", tSceneColor.index);
            // progDisplayQuad.setUniform("uRes", "1f", m_resolution);
            // rDispQuad.render();
        }

        self.initialize();
}


function loadProgram(gl, src) {
    src = src.split('// __split__');
    return new webgl.Program(gl, src[0], src[1]);
}
