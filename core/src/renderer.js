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

// Key light for specular highlights, in view space (upper left, towards viewer).
var LIGHT_DIR = glm.vec3.normalize(glm.vec3.create(), [-0.45, 0.6, 0.66]);
var SHADOW_RES = 2048;
var Select = require("./select");
var parseColor = Select.parseColor;

module.exports = function (canvas, resolution, aoResolution) {
        let m_resolution = Math.max(resolution.x, resolution.y)
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
            tAccumulator, tAccumulatorOut,
            tFXAA, tFXAAOut,
            tDOF,
            tAO;

        // Translucent surface layer. Its textures are bound to units 11-14 right
        // before each draw that samples them (units 0-10 hold the fixed textures).
        var tSurfColor, tSurfNormal, tSurfDepth, tSurfAcc, tSurfAccOut, tRandRotDepthAll;
        var fbSurfColor, fbSurfNormal, fbSurfAccumulator, fbRandRotAll;
        // Key-light shadows: depth map along the light and per-pixel visibility.
        var tShadowMapColor, tShadowMap, tShadow;
        var fbShadowMap, fbShadow;
        var fogExtent = {near: 0, far: 1};
        // Focal depth for depth of field (from view.dofFocus when set).
        var dofDepth = 0.5;

        var fbSceneColor, fbSceneNormal,
            fbRandRot,
            fbAccumulator,
            fbFXAA,
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

        var sampleCount = 0,
            colorRendered = false,
            normalRendered = false,
            shadowRendered = false;

        // At most 1024 AO samples: the accumulator counts 255 per RGBA channel.
        function maxSamples(view) {
            return Math.max(1, Math.min(1024, Math.round(view.aoSamples || 1024)));
        }

        var lastView = null;
        self.getAOProgress = function() {
            return lastView ? Math.min(1, sampleCount / maxSamples(lastView)) : 0;
        }

        self.initialize = function() {

            // Initialize canvas/gl.
            canvas.width = resolution.x;
            canvas.height = resolution.y;
            gl = canvas.getContext('webgl');
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.clearColor(0,0,0,0);
            gl.clearDepth(1);
            gl.viewport(0,0,m_resolution,m_resolution);

            window.gl = gl; //debug

            ext = webgl.getExtensions(gl, [
                "EXT_frag_depth",
                "WEBGL_depth_texture",
            ]);

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

        self.createTextures = function() {
            // fbRandRot
            tRandRotColor = new webgl.Texture(gl, 0, null, aoResolution, aoResolution);

            tRandRotDepth = new webgl.Texture(gl, 1, null, aoResolution, aoResolution, {
                internalFormat: gl.DEPTH_COMPONENT,
                format: gl.DEPTH_COMPONENT,
                type: gl.UNSIGNED_SHORT
            });

            fbRandRot = new webgl.Framebuffer(gl, [tRandRotColor], tRandRotDepth);

            // fbScene
            tSceneColor = new webgl.Texture(gl, 2, null, m_resolution, m_resolution);

            tSceneNormal = new webgl.Texture(gl, 3, null, m_resolution, m_resolution);

            tSceneDepth = new webgl.Texture(gl, 4, null, m_resolution, m_resolution, {
                internalFormat: gl.DEPTH_COMPONENT,
                format: gl.DEPTH_COMPONENT,
                type: gl.UNSIGNED_SHORT
            });

            fbSceneColor = new webgl.Framebuffer(gl, [tSceneColor], tSceneDepth);

            fbSceneNormal = new webgl.Framebuffer(gl, [tSceneNormal], tSceneDepth);

            // fbAccumulator
            tAccumulator = new webgl.Texture(gl, 5, null, m_resolution, m_resolution);
            tAccumulatorOut = new webgl.Texture(gl, 6, null, m_resolution, m_resolution);
            fbAccumulator = new webgl.Framebuffer(gl, [tAccumulatorOut]);

            // fbAO
            tAO = new webgl.Texture(gl, 7, null, m_resolution, m_resolution);
            fbAO = new webgl.Framebuffer(gl, [tAO]);

            // fbFXAA
            tFXAA = new webgl.Texture(gl, 8, null, m_resolution, m_resolution);
            tFXAAOut = new webgl.Texture(gl, 9, null, m_resolution, m_resolution);
            fbFXAA = new webgl.Framebuffer(gl, [tFXAAOut]);

            // fbDOF
            tDOF = new webgl.Texture(gl, 10, null, m_resolution, m_resolution);
            fbDOF = new webgl.Framebuffer(gl, [tDOF]);

            // Translucent surface layer
            var depthOptions = {
                internalFormat: gl.DEPTH_COMPONENT,
                format: gl.DEPTH_COMPONENT,
                type: gl.UNSIGNED_SHORT
            };
            tSurfColor = new webgl.Texture(gl, 11, null, m_resolution, m_resolution);
            tSurfNormal = new webgl.Texture(gl, 11, null, m_resolution, m_resolution);
            tSurfDepth = new webgl.Texture(gl, 11, null, m_resolution, m_resolution, depthOptions);
            fbSurfColor = new webgl.Framebuffer(gl, [tSurfColor], tSurfDepth);
            fbSurfNormal = new webgl.Framebuffer(gl, [tSurfNormal], tSurfDepth);
            tSurfAcc = new webgl.Texture(gl, 11, null, m_resolution, m_resolution);
            tSurfAccOut = new webgl.Texture(gl, 11, null, m_resolution, m_resolution);
            fbSurfAccumulator = new webgl.Framebuffer(gl, [tSurfAccOut]);
            // Occluders for the surface's own AO include the surface itself.
            tRandRotDepthAll = new webgl.Texture(gl, 11, null, aoResolution, aoResolution, depthOptions);
            fbRandRotAll = new webgl.Framebuffer(gl, [tRandRotColor], tRandRotDepthAll);

            // Shadows
            tShadowMapColor = new webgl.Texture(gl, 11, null, SHADOW_RES, SHADOW_RES);
            tShadowMap = new webgl.Texture(gl, 11, null, SHADOW_RES, SHADOW_RES, depthOptions);
            fbShadowMap = new webgl.Framebuffer(gl, [tShadowMapColor], tShadowMap);
            tShadow = new webgl.Texture(gl, 11, null, m_resolution, m_resolution);
            fbShadow = new webgl.Framebuffer(gl, [tShadow]);
        }

        function bindUnit(texture, unit) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            texture.bind();
            return unit;
        }

        function transparentSurface(view) {
            return view.surface && rSurface != null && view.surfaceOpacity < 1;
        }

        self.setResolution = function(res, aoRes) {
            aoResolution = aoRes;
            resolution = res;
            m_resolution = Math.max(resolution.x, resolution.y);
            canvas.width = resolution.x;
            canvas.height = resolution.y;
            gl.viewport(0,0,m_resolution,m_resolution);
            self.createTextures();
        }


        self.setSystem = function(newSystem, view) {

            system = newSystem;

            function make6(arr) {
                var out = [];
                for (var i = 0; i < 6; i++) {
                    out.push.apply(out, arr);
                }
                return out;
            }

            function make36(arr) {
                var out = [];
                for (var i = 0; i < 36; i++) {
                    out.push.apply(out, arr);
                }
                return out;
            }

            // Atoms
            var attribs = webgl.buildAttribs(gl, {
                aImposter: 3, aPosition: 3, aRadius: 1, aColor: 3, aMetal: 1, aScale: 1
            });

            var imposter = [];
            var position = [];
            var radius = [];
            var color = [];
            var metal = [];
            var scale = [];

            for (var i = 0; i < system.atoms.length; i++) {
                var a = system.atoms[i];
                if (a.hidden) continue;
                imposter.push.apply(imposter, QUAD);
                position.push.apply(position, make6([a.x, a.y, a.z]));
                radius.push.apply(radius, make6([view.elements[a.symbol].radius]));
                var c = a.displayColor || view.elements[a.symbol].color;
                color.push.apply(color, make6([c[0], c[1], c[2]]));
                metal.push.apply(metal, make6([consts.isMetal(a.symbol) ? 1 : 0]));
                scale.push.apply(scale, make6([a.highlight ? view.highlightScale : 1]));
            }

            attribs.aImposter.buffer.set(new Float32Array(imposter));
            attribs.aPosition.buffer.set(new Float32Array(position));
            attribs.aRadius.buffer.set(new Float32Array(radius));
            attribs.aColor.buffer.set(new Float32Array(color));
            attribs.aMetal.buffer.set(new Float32Array(metal));
            attribs.aScale.buffer.set(new Float32Array(scale));

            var count = imposter.length / 9;

            rAtoms = new webgl.Renderable(gl, progAtoms, attribs, count);

            // Bonds

            if (view.bonds) {

                rBonds = null;

                if (system.bonds.length > 0) {

                    var attribs = webgl.buildAttribs(gl, {
                        aImposter: 3,
                        aPosA: 3,
                        aPosB: 3,
                        aRadA: 1,
                        aRadB: 1,
                        aColA: 3,
                        aColB: 3,
                        aMetA: 1,
                        aMetB: 1
                    })

                    var imposter = [];
                    var posa = [];
                    var posb = [];
                    var rada = [];
                    var radb = [];
                    var cola = [];
                    var colb = [];
                    var meta = [];
                    var metb = [];

                    for (var i = 0; i < system.bonds.length; i++) {
                        var b = system.bonds[i];
                        if (b.cutoff > view.bondThreshold) break;
                        imposter.push.apply(imposter, cube.position);
                        posa.push.apply(posa, make36([b.posA.x, b.posA.y, b.posA.z]));
                        posb.push.apply(posb, make36([b.posB.x, b.posB.y, b.posB.z]));
                        rada.push.apply(rada, make36([b.radA]));
                        radb.push.apply(radb, make36([b.radB]));
                        cola.push.apply(cola, make36([b.colA.r, b.colA.g, b.colA.b]));
                        colb.push.apply(colb, make36([b.colB.r, b.colB.g, b.colB.b]));
                        meta.push.apply(meta, make36([b.metA]));
                        metb.push.apply(metb, make36([b.metB]));
                    }

                    attribs.aImposter.buffer.set(new Float32Array(imposter));
                    attribs.aPosA.buffer.set(new Float32Array(posa));
                    attribs.aPosB.buffer.set(new Float32Array(posb));
                    attribs.aRadA.buffer.set(new Float32Array(rada));
                    attribs.aRadB.buffer.set(new Float32Array(radb));
                    attribs.aColA.buffer.set(new Float32Array(cola));
                    attribs.aColB.buffer.set(new Float32Array(colb));
                    attribs.aMetA.buffer.set(new Float32Array(meta));
                    attribs.aMetB.buffer.set(new Float32Array(metb));

                    var count = imposter.length / 9;

                    rBonds = new webgl.Renderable(gl, progBonds, attribs, count);

                }

            }

            // Cartoon and molecular surface (triangle meshes)

            rCartoon = view.cartoon ? meshRenderable(Cartoon.buildMesh(system, view)) : null;
            rSurface = view.surface ? meshRenderable(Surface.buildMesh(system, view)) : null;
            rCell = view.unitCell && system.cell ? meshRenderable(Cell.buildMesh(system, view)) : null;

        }

        function meshRenderable(mesh) {
            if (mesh.count === 0) {
                return null;
            }
            var attribs = webgl.buildAttribs(gl, {
                aPosition: 3, aNormal: 3, aColor: 3
            });
            attribs.aPosition.buffer.set(mesh.position);
            attribs.aNormal.buffer.set(mesh.normal);
            attribs.aColor.buffer.set(mesh.color);
            return new webgl.Renderable(gl, progCartoon, attribs, mesh.count / 3);
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
            tAccumulator.reset();
            tAccumulatorOut.reset();
            tSurfAcc.reset();
            tSurfAccOut.reset();
        }

        self.render = function(view) {
            if (system === undefined) {
                return;
            }
            if (rAtoms == null) {
                return;
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
                for (var i = 0; i < view.spf; i++) {
                    if (sampleCount >= maxSamples(view)) {
                        break;
                    }
                    sample(view);
                    sampleCount++;
                }
            }
            display(view);
        }

        function color(view) {
            colorRendered = true;
            fogExtent = depthExtent(view);
            dofDepth = focusDepth(view);
            gl.viewport(0, 0, m_resolution, m_resolution);
            fbSceneColor.bind();
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            var rect = View.getRect(view);
            var projection = glm.mat4.create();
            glm.mat4.ortho(projection, rect.left, rect.right, rect.bottom, rect.top, 0, range);
            var viewMat = glm.mat4.create();
            glm.mat4.lookAt(viewMat, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
            var model = glm.mat4.create();
            glm.mat4.translate(model, model, [0, 0, -range/2]);
            glm.mat4.multiply(model, model, view.rotation);
            progAtoms.setUniform("uProjection", "Matrix4fv", false, projection);
            progAtoms.setUniform("uView", "Matrix4fv", false, viewMat);
            progAtoms.setUniform("uModel", "Matrix4fv", false, model);
            progAtoms.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
            progAtoms.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
            progAtoms.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
            progAtoms.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
            progAtoms.setUniform("uRes", "1f", m_resolution);
            progAtoms.setUniform("uDepth", "1f", range);
            progAtoms.setUniform("uMode", "1i", 0);
            progAtoms.setUniform("uAtomShade", "1f", view.atomShade);
            rAtoms.render();

            if (view.bonds && rBonds != null) {
                fbSceneColor.bind();
                progBonds.setUniform("uProjection", "Matrix4fv", false, projection);
                progBonds.setUniform("uView", "Matrix4fv", false, viewMat);
                progBonds.setUniform("uModel", "Matrix4fv", false, model);
                progBonds.setUniform("uRotation", "Matrix4fv", false, view.rotation);
                progBonds.setUniform("uDepth", "1f", range);
                progBonds.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
                progBonds.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
                progBonds.setUniform("uRes", "1f", m_resolution);
                progBonds.setUniform("uBondRadius", "1f", 2.5 * View.getBondRadius(view));
                progBonds.setUniform("uBondShade", "1f", view.bondShade);
                progBonds.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
                progBonds.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
                progBonds.setUniform("uMode", "1i", 0);
                rBonds.render();
            }

            drawCartoon(view, projection, viewMat, model, 0);

            if (transparentSurface(view)) {
                fbSurfColor.bind();
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                drawCartoon(view, projection, viewMat, model, 0, "surface");
            }
        }


        function normal(view) {
            normalRendered = true;
            gl.viewport(0, 0, m_resolution, m_resolution);
            fbSceneNormal.bind();
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            var rect = View.getRect(view);
            var projection = glm.mat4.create();
            glm.mat4.ortho(projection, rect.left, rect.right, rect.bottom, rect.top, 0, range);
            var viewMat = glm.mat4.create();
            glm.mat4.lookAt(viewMat, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
            var model = glm.mat4.create();
            glm.mat4.translate(model, model, [0, 0, -range/2]);
            glm.mat4.multiply(model, model, view.rotation);
            progAtoms.setUniform("uProjection", "Matrix4fv", false, projection);
            progAtoms.setUniform("uView", "Matrix4fv", false, viewMat);
            progAtoms.setUniform("uModel", "Matrix4fv", false, model);
            progAtoms.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
            progAtoms.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
            progAtoms.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
            progAtoms.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
            progAtoms.setUniform("uRes", "1f", m_resolution);
            progAtoms.setUniform("uDepth", "1f", range);
            progAtoms.setUniform("uMode", "1i", 1);
            progAtoms.setUniform("uAtomShade", "1f", view.atomShade);
            rAtoms.render();

            if (view.bonds && rBonds != null) {
                fbSceneNormal.bind();
                progBonds.setUniform("uProjection", "Matrix4fv", false, projection);
                progBonds.setUniform("uView", "Matrix4fv", false, viewMat);
                progBonds.setUniform("uModel", "Matrix4fv", false, model);
                progBonds.setUniform("uRotation", "Matrix4fv", false, view.rotation);
                progBonds.setUniform("uDepth", "1f", range);
                progBonds.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
                progBonds.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
                progBonds.setUniform("uRes", "1f", m_resolution);
                progBonds.setUniform("uBondRadius", "1f", 2.5 * View.getBondRadius(view));
                progBonds.setUniform("uBondShade", "1f", view.bondShade);
                progBonds.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
                progBonds.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
                progBonds.setUniform("uMode", "1i", 1);
                rBonds.render();
            }

            drawCartoon(view, projection, viewMat, model, 1);

            if (transparentSurface(view)) {
                fbSurfNormal.bind();
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                drawCartoon(view, projection, viewMat, model, 1, "surface");
            }
        }


        // Renders the scene's depth seen along rot (applied on top of the view
        // rotation), framed on the whole bounding sphere, into the bound
        // framebuffer. Used for the AO samples and the key-light shadow map.
        function renderRotated(view, rot, res, layer) {
            gl.viewport(0, 0, res, res);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            var v = View.clone(view);
            v.zoom = 1/range;
            v.translation.x = 0;
            v.translation.y = 0;
            v.rotation = glm.mat4.multiply(glm.mat4.create(), rot, v.rotation);
            var rect = View.getRect(v);
            var projection = glm.mat4.create();
            glm.mat4.ortho(projection, rect.left, rect.right, rect.bottom, rect.top, 0, range);
            var viewMat = glm.mat4.create();
            glm.mat4.lookAt(viewMat, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
            var model = glm.mat4.create();
            glm.mat4.translate(model, model, [0, 0, -range/2]);
            glm.mat4.multiply(model, model, v.rotation);
            progAtoms.setUniform("uProjection", "Matrix4fv", false, projection);
            progAtoms.setUniform("uView", "Matrix4fv", false, viewMat);
            progAtoms.setUniform("uModel", "Matrix4fv", false, model);
            progAtoms.setUniform("uBottomLeft", "2fv", [rect.left, rect.bottom]);
            progAtoms.setUniform("uTopRight", "2fv", [rect.right, rect.top]);
            progAtoms.setUniform("uAtomScale", "1f", 2.5 * v.atomScale);
            progAtoms.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
            progAtoms.setUniform("uRes", "1f", res);
            progAtoms.setUniform("uDepth", "1f", range);
            progAtoms.setUniform("uMode", "1i", 0);
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
                progBonds.setUniform("uRes", "1f", res);
                progBonds.setUniform("uBondRadius", "1f", 2.5 * View.getBondRadius(view));
                progBonds.setUniform("uBondShade", "1f", view.bondShade);
                progBonds.setUniform("uAtomScale", "1f", 2.5 * view.atomScale);
                progBonds.setUniform("uRelativeAtomScale", "1f", view.relativeAtomScale);
                progBonds.setUniform("uMode", "1i", 0);
                rBonds.render();
            }

            drawCartoon(view, projection, viewMat, model, 0, layer);
            return {v: v, projection: projection, viewMat: viewMat, model: model};
        }

        function sample(view) {
            var rot = aoRotation(sampleCount);
            fbRandRot.bind();
            var pass = renderRotated(view, rot, aoResolution, "opaque");
            var v = pass.v, projection = pass.projection, viewMat = pass.viewMat, model = pass.model;

            var sceneRect = View.getRect(view);
            var rotRect = View.getRect(v);
            var invRot = glm.mat4.invert(glm.mat4.create(), rot);

            gl.viewport(0, 0, m_resolution, m_resolution);
            fbAccumulator.bind();
            accumulate(tSceneDepth.index, tSceneNormal.index, tRandRotDepth.index, tAccumulator.index,
                       sceneRect, rotRect, rot, invRot);
            tAccumulator.activate();
            tAccumulator.bind();
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, m_resolution, m_resolution, 0);

            if (transparentSurface(view)) {
                // Same random direction, with the surface added as an occluder.
                // Atom and bond uniforms are still set from the pass above.
                gl.viewport(0, 0, aoResolution, aoResolution);
                fbRandRotAll.bind();
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                rAtoms.render();
                if (view.bonds && rBonds != null) {
                    rBonds.render();
                }
                drawCartoon(view, projection, viewMat, model, 0, "all");

                gl.viewport(0, 0, m_resolution, m_resolution);
                fbSurfAccumulator.bind();
                accumulate(bindUnit(tSurfDepth, 11), bindUnit(tSurfNormal, 12),
                           bindUnit(tRandRotDepthAll, 13), bindUnit(tSurfAcc, 14),
                           sceneRect, rotRect, rot, invRot);
                bindUnit(tSurfAcc, 14);
                gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, m_resolution, m_resolution, 0);
            }
        }

        // Rotation whose inverse maps the view axis onto the i-th direction of an
        // R2 low-discrepancy sequence on the sphere, so every prefix of samples
        // covers all directions evenly. A random roll jitters the shadow-map grid.
        function aoRotation(i) {
            var u = (0.5 + i * 0.7548776662466927) % 1;
            var w = (0.5 + i * 0.5698402909980532) % 1;
            var z = 1 - 2 * u;
            var rxy = Math.sqrt(Math.max(0, 1 - z * z));
            var phi = 2 * Math.PI * w;
            var d = glm.vec3.fromValues(rxy * Math.cos(phi), rxy * Math.sin(phi), z);
            var q = glm.quat.rotationTo(glm.quat.create(), d, glm.vec3.fromValues(0, 0, 1));
            var roll = glm.quat.setAxisAngle(glm.quat.create(), [0, 0, 1], Math.random() * 2 * Math.PI);
            glm.quat.multiply(q, roll, q);
            return glm.mat4.fromQuat(glm.mat4.create(), q);
        }

        // Key-light visibility for every scene pixel (computed once per view).
        function shadow(view) {
            var rot = glm.mat4.fromQuat(glm.mat4.create(),
                glm.quat.rotationTo(glm.quat.create(), LIGHT_DIR, glm.vec3.fromValues(0, 0, 1)));
            fbShadowMap.bind();
            var pass = renderRotated(view, rot, SHADOW_RES, "opaque");
            var sceneRect = View.getRect(view);
            var rotRect = View.getRect(pass.v);
            gl.viewport(0, 0, m_resolution, m_resolution);
            fbShadow.bind();
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            progShadow.setUniform("uSceneDepth", "1i", tSceneDepth.index);
            progShadow.setUniform("uSceneNormal", "1i", tSceneNormal.index);
            progShadow.setUniform("uShadowMap", "1i", bindUnit(tShadowMap, 11));
            progShadow.setUniform("uSceneBottomLeft", "2fv", [sceneRect.left, sceneRect.bottom]);
            progShadow.setUniform("uSceneTopRight", "2fv", [sceneRect.right, sceneRect.top]);
            progShadow.setUniform("uRotBottomLeft", "2fv", [rotRect.left, rotRect.bottom]);
            progShadow.setUniform("uRotTopRight", "2fv", [rotRect.right, rotRect.top]);
            progShadow.setUniform("uRes", "1f", m_resolution);
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
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            progAccumulator.setUniform("uSceneDepth", "1i", depthUnit);
            progAccumulator.setUniform("uSceneNormal", "1i", normalUnit);
            progAccumulator.setUniform("uRandRotDepth", "1i", rotDepthUnit);
            progAccumulator.setUniform("uAccumulator", "1i", accUnit);
            progAccumulator.setUniform("uSceneBottomLeft", "2fv", [sceneRect.left, sceneRect.bottom]);
            progAccumulator.setUniform("uSceneTopRight", "2fv", [sceneRect.right, sceneRect.top]);
            progAccumulator.setUniform("uRotBottomLeft", "2fv", [rotRect.left, rotRect.bottom]);
            progAccumulator.setUniform("uRotTopRight", "2fv", [rotRect.right, rotRect.top]);
            progAccumulator.setUniform("uRes", "1f", m_resolution);
            progAccumulator.setUniform("uDepth", "1f", range);
            progAccumulator.setUniform("uAORes", "1f", aoResolution);
            progAccumulator.setUniform("uRot", "Matrix4fv", false, rot);
            progAccumulator.setUniform("uInvRot", "Matrix4fv", false, invRot);
            progAccumulator.setUniform("uSampleCount", "1i", sampleCount);
            rAccumulator.render();
        }

        function display(view) {
            gl.viewport(0, 0, m_resolution, m_resolution);
            if (view.fxaa > 0 || view.dofStrength > 0) {
                fbAO.bind();
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            progAO.setUniform("uSceneColor", "1i", tSceneColor.index);
            progAO.setUniform("uSceneDepth", "1i", tSceneDepth.index);
            progAO.setUniform("uAccumulatorOut", "1i", tAccumulatorOut.index);
            progAO.setUniform("uRes", "1f", m_resolution);
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
            progAO.setUniform("uSurfaceColor", "1i", bindUnit(tSurfColor, 11));
            progAO.setUniform("uSurfaceDepth", "1i", bindUnit(tSurfDepth, 12));
            progAO.setUniform("uSurfaceNormal", "1i", bindUnit(tSurfNormal, 13));
            progAO.setUniform("uSurfaceAccumulator", "1i", bindUnit(tSurfAccOut, 14));
            progAO.setUniform("uSurfaceOpacity", "1f", transparentSurface(view) ? view.surfaceOpacity : 1.0);
            progAO.setUniform("uShadow", "1i", bindUnit(tShadow, 15));
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
            rAO.render();

            if (view.fxaa > 0) {
                if (view.dofStrength > 0) {
                    fbFXAA.bind();
                } else {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                }
                for (var i = 0; i < view.fxaa; i++) {
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    if (i == 0) {
                        progFXAA.setUniform("uTexture", "1i", tAO.index);
                    } else {
                        progFXAA.setUniform("uTexture", "1i", tFXAA.index);
                    }
                    progFXAA.setUniform("uRes", "1f", m_resolution);
                    rFXAA.render();
                    tFXAA.activate();
                    tFXAA.bind();
                    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, m_resolution, m_resolution, 0);
                }
            }

            if (view.dofStrength > 0) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                if (view.fxaa > 0) {
                    progDOF.setUniform("uColor", "1i", tFXAA.index);
                } else {
                    progDOF.setUniform("uColor", "1i", tAO.index);
                }
                progDOF.setUniform("uDepth", "1i", tSceneDepth.index);
                progDOF.setUniform("uDOFPosition", "1f", dofDepth);
                progDOF.setUniform("uRange", "1f", range);
                progDOF.setUniform("uZoom", "1f", view.zoom);
                progDOF.setUniform("uDOFStrength", "1f", view.dofStrength);
                progDOF.setUniform("uRes", "1f", m_resolution);
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
