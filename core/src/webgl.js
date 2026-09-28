"use strict";

// Thin wrappers over WebGL 1: buffers, textures, framebuffers, programs and
// renderables. Programs switch only when needed and skip scalar uniforms that
// did not change; renderables keep their attribute setup in a vertex array
// object (OES_vertex_array_object) when the browser has one.

// Per-context state shared by the wrappers (call once after creating the context).
function setup(gl) {
    gl.__vao = gl.getExtension("OES_vertex_array_object");
    gl.__program = null;
}

module.exports.setup = setup;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Attribute buffers for a layout {name: size} (floats).
function buildAttribs(gl, layout) {
    var attribs = {};
    for (var key in layout) {
        attribs[key] = {
            buffer: new GLBuffer(gl),
            size: layout[key]
        };
    }
    return attribs;
}

module.exports.buildAttribs = buildAttribs;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function getExtensions(gl, extArray) {
    var ext = {};
    for (var i = 0; i < extArray.length; i++) {
        var e = gl.getExtension(extArray[i]);
        if (e === null) {
            throw "Extension " + extArray[i] + " not available.";
        }
        ext[extArray[i]] = e;
    }
    return ext;
}

module.exports.getExtensions = getExtensions;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function Framebuffer(gl, color, depth, ext) {

    var self = this;

    self.initialize = function() {
        self.fb = gl.createFramebuffer();
        self.bind();
        if (color.length > 1) {
            var drawBuffers = [];
            for (var i = 0; i < color.length; i++) {
                drawBuffers.push(ext["COLOR_ATTACHMENT" + i + "_WEBGL"]);
            }
            ext.drawBuffersWEBGL(drawBuffers);
            for (var j = 0; j < color.length; j++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, ext["COLOR_ATTACHMENT" + j + "_WEBGL"],
                    gl.TEXTURE_2D, color[j].texture, 0);
            }
        } else {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color[0].texture, 0);
        }
        if (depth !== undefined) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth.texture, 0);
        }
    };

    self.bind = function() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.fb);
    };

    self.destroy = function() {
        gl.deleteFramebuffer(self.fb);
    };

    self.initialize();
}

module.exports.Framebuffer = Framebuffer;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function Texture(gl, index, data, width, height, options) {
    options = options || {};
    options.target = options.target || gl.TEXTURE_2D;
    options.mag = options.mag || gl.NEAREST;
    options.min = options.min || gl.NEAREST;
    options.wraps = options.wraps || gl.CLAMP_TO_EDGE;
    options.wrapt = options.wrapt || gl.CLAMP_TO_EDGE;
    options.internalFormat = options.internalFormat || gl.RGBA;
    options.format = options.format || gl.RGBA;
    options.type = options.type || gl.UNSIGNED_BYTE;

    var self = this;
    self.width = width;
    self.height = height;

    self.initialize = function() {
        self.index = index;
        self.activate();
        self.texture = gl.createTexture();
        self.bind();
        gl.texParameteri(options.target, gl.TEXTURE_MAG_FILTER, options.mag);
        gl.texParameteri(options.target, gl.TEXTURE_MIN_FILTER, options.min);
        gl.texParameteri(options.target, gl.TEXTURE_WRAP_S, options.wraps);
        gl.texParameteri(options.target, gl.TEXTURE_WRAP_T, options.wrapt);
        gl.texImage2D(options.target, 0, options.internalFormat, width, height,
            0, options.format, options.type, data);
    };

    self.bind = function() {
        gl.bindTexture(options.target, self.texture);
    };

    self.activate = function() {
        gl.activeTexture(gl.TEXTURE0 + self.index);
    };

    self.destroy = function() {
        gl.deleteTexture(self.texture);
    };

    self.initialize();
}

module.exports.Texture = Texture;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// A GPU buffer; `target` is ARRAY_BUFFER (default) or ELEMENT_ARRAY_BUFFER.
function GLBuffer(gl, target) {

    var self = this;
    target = target || gl.ARRAY_BUFFER;

    self.buffer = gl.createBuffer();

    self.bind = function() {
        gl.bindBuffer(target, self.buffer);
    };

    self.set = function(data) {
        self.bind();
        gl.bufferData(target, data, gl.STATIC_DRAW);
    };

    self.destroy = function() {
        gl.deleteBuffer(self.buffer);
    };
}

module.exports.GLBuffer = GLBuffer;


// Points the program's attributes at the buffers. buffers: {name: {buffer,
// size, type (default FLOAT), normalized, divisor}}. Returns the locations.
function bindAttributes(gl, program, buffers, instancedExt) {
    var used = [];
    for (var name in buffers) {
        var attrib = program.attribs[name];
        if (!attrib) continue;   // not used by this program
        var b = buffers[name];
        b.buffer.bind();
        gl.enableVertexAttribArray(attrib.location);
        gl.vertexAttribPointer(attrib.location, b.size, b.type || gl.FLOAT, !!b.normalized, 0, 0);
        if (instancedExt) instancedExt.vertexAttribDivisorANGLE(attrib.location, b.divisor || 0);
        used.push(attrib.location);
    }
    return used;
}

// Draws with the renderable's vertex array object (made on first use), or
// sets up the attributes around the draw without one.
function drawWith(gl, self, program, buffers, instancedExt, draw) {
    program.use();
    var vao = gl.__vao;
    if (vao) {
        if (!self.vao) {
            self.vao = vao.createVertexArrayOES();
            vao.bindVertexArrayOES(self.vao);
            bindAttributes(gl, program, buffers, instancedExt);
            if (self.index) self.index.buffer.bind();
        } else {
            vao.bindVertexArrayOES(self.vao);
        }
        draw();
        vao.bindVertexArrayOES(null);
        return;
    }
    var used = bindAttributes(gl, program, buffers, instancedExt);
    if (self.index) self.index.buffer.bind();
    draw();
    // Divisors are global attribute state without a vertex array object.
    for (var k = 0; k < used.length; k++) {
        if (instancedExt) instancedExt.vertexAttribDivisorANGLE(used[k], 0);
        gl.disableVertexAttribArray(used[k]);
    }
}


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Triangles: `primitiveCount` of them from the buffers, or with
// index = {buffer (ELEMENT_ARRAY_BUFFER GLBuffer), count, type} indexed.
function Renderable(gl, program, buffers, primitiveCount, index) {

    var self = this;
    self.gl = gl;
    self.buffers = buffers;
    self.index = index || null;
    self.primitiveCount = primitiveCount;

    self.render = function() {
        drawWith(gl, self, program, buffers, null, function() {
            if (self.index) gl.drawElements(gl.TRIANGLES, self.index.count, self.index.type, 0);
            else gl.drawArrays(gl.TRIANGLES, 0, 3 * primitiveCount);
        });
    };
}

module.exports.Renderable = Renderable;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// One shape (e.g. an imposter quad or box, `vertexCount` vertices) drawn
// `instanceCount` times with ANGLE_instanced_arrays. Buffers with divisor 1
// hold one value per instance, the rest one per vertex of the shape, so each
// atom or bond is stored once instead of once per vertex.
function InstancedRenderable(gl, program, buffers, vertexCount, instanceCount, instancedExt, mode) {

    var self = this;
    self.gl = gl;
    self.buffers = buffers;

    self.render = function() {
        drawWith(gl, self, program, buffers, instancedExt, function() {
            instancedExt.drawArraysInstancedANGLE(mode === undefined ? gl.TRIANGLES : mode, 0, vertexCount, instanceCount);
        });
    };
}

module.exports.InstancedRenderable = InstancedRenderable;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
function Program(gl, vertexSource, fragmentSource) {

    var self = this;

    self.initialize = function() {
        self.program = self.compileProgram(vertexSource, fragmentSource);
        self.attribs = self.gatherAttribs();
        self.uniforms = self.gatherUniforms();
    };

    self.use = function() {
        if (gl.__program !== self.program) {
            gl.useProgram(self.program);
            gl.__program = self.program;
        }
    };

    self.compileProgram = function(vertexSource, fragmentSource) {
        var vertexShader = self.compileShader(vertexSource, gl.VERTEX_SHADER);
        var fragmentShader = self.compileShader(fragmentSource, gl.FRAGMENT_SHADER);
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.log(gl.getProgramInfoLog(program));
            throw "Failed to compile program.";
        }
        return program;
    };

    self.compileShader = function(source, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            var err = gl.getShaderInfoLog(shader);
            var lineno = parseInt(err.split(':')[2]);
            var split = source.split("\n");
            for (var i = 0; i < split.length; i++) {
                console.log(i + "  " + split[i]);
                if (i === lineno - 1) {
                    console.warn(err);
                }
            }
            var typeString = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
            throw "Failed to compile " + typeString + " shader.";
        }
        return shader;
    };

    // setUniform(name, "1f" | "1i" | "2fv" | "3fv" | "4fv", value) or
    // setUniform(name, "Matrix4fv", transpose, value). Uniforms the compiler
    // removed are ignored; unchanged scalars are not sent again.
    self.setUniform = function(name, type, a, b) {
        self.use();
        var u = self.uniforms[name];
        if (u === undefined) return;
        if (type === "1f" || type === "1i") {
            if (u.value === a) return;
            u.value = a;
            if (type === "1f") gl.uniform1f(u.location, a);
            else gl.uniform1i(u.location, a);
        } else if (type === "Matrix4fv") {
            gl.uniformMatrix4fv(u.location, a, b);
        } else if (type === "2fv") {
            gl.uniform2fv(u.location, a);
        } else if (type === "3fv") {
            gl.uniform3fv(u.location, a);
        } else if (type === "4fv") {
            gl.uniform4fv(u.location, a);
        } else {
            gl["uniform" + type](u.location, a);
        }
    };

    self.gatherUniforms = function() {
        var uniforms = {};
        var nUniforms = gl.getProgramParameter(self.program, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < nUniforms; i++) {
            var uniform = gl.getActiveUniform(self.program, i);
            uniforms[uniform.name] = {
                name: uniform.name,
                location: gl.getUniformLocation(self.program, uniform.name),
                type: uniform.type,
                size: uniform.size
            };
        }
        return uniforms;
    };

    self.gatherAttribs = function() {
        var attribs = {};
        var nAttribs = gl.getProgramParameter(self.program, gl.ACTIVE_ATTRIBUTES);
        for (var i = 0; i < nAttribs; i++) {
            var attrib = gl.getActiveAttrib(self.program, i);
            attribs[attrib.name] = {
                name: attrib.name,
                location: gl.getAttribLocation(self.program, attrib.name),
                type: attrib.type,
                size: attrib.size
            };
        }
        return attribs;
    };

    self.initialize();
}

module.exports.Program = Program;

// Frees the GPU buffers (and vertex array object) of a Renderable or
// InstancedRenderable (or null).
module.exports.destroy = function(renderable) {
    if (!renderable) return;
    for (var name in renderable.buffers) {
        renderable.buffers[name].buffer.destroy();
    }
    if (renderable.index) renderable.index.buffer.destroy();
    if (renderable.vao && renderable.gl && renderable.gl.__vao) renderable.gl.__vao.deleteVertexArrayOES(renderable.vao);
};
