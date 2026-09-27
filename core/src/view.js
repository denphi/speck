"use strict";

var glm = require("./gl-matrix");
var elements = require("./elements");
var consts = require("./const");
var System = require("./system");

function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
}


var newView = module.exports.new = function() {
    return {
        aspect: 1.0,
        zoom: 0.125,
        translation: {
            x: 0.0,
            y: 0.0
        },
        atomScale: 0.6,
        relativeAtomScale: 1.0,
        bondScale: 0.5,
        rotation: glm.mat4.create(),
        ao: 0.75,
        aoRes: 256,
        brightness: 0.5,
        outline: 0.0,
        spf: 32,
        bonds: false,
        bondThreshold: 1.2,
        bondShade: 0.5,
        atomShade: 0.5,
        resolution: {x:768,y:768},
        dofStrength: 0.0,
        dofPosition: 0.5,
        fxaa: 1,
        ligands: true,
        aoSamples: 1024,
        unitCell: false,
        cellColor: "#666666",
        cellRadius: 0.12,
        frame: 0,
        highlight: {},
        highlightColor: "",
        highlightScale: 1.0,
        ghost: 0.0,
        cartoon: false,
        cartoonColor: "ss",
        cartoonAtoms: "ligands",
        cartoonHelixWidth: 2.6,
        cartoonSheetWidth: 2.4,
        cartoonThickness: 0.6,
        cartoonTubeRadius: 0.3,
        cartoonQuality: 8,
        cartoonShade: 0.2,
        surface: false,
        surfaceColor: "element",
        surfaceAtoms: "polymer",
        surfaceProbe: 1.4,
        surfaceResolution: 0.5,
        surfaceShade: 0.1,
        surfaceOpacity: 1.0,
        shadows: 0.0,
        shadowSoftness: 1.5,
        rim: 0.0,
        fog: 0.0,
        fogColor: "#ffffff",
        saturation: 1.0,
        tonemap: false,
        outlineWidth: 1.0,
        outlineColor: "#000000",
        specular: 0.0,
        gloss: 0.5,
        metallic: 0.0,
        metallicAtoms: "all",
        elements : JSON.parse(JSON.stringify(elements))
    };
};


var center = module.exports.center = function(v, system) {
    var maxX = -Infinity;
    var minX = Infinity;
    var maxY = -Infinity;
    var minY = Infinity;
    // Fit what is drawn: skip hidden waters and ligands, but keep hidden
    // polymer atoms, which the cartoon or surface represents.
    var anyShown = system.atoms.some(function(a) { return !a.hidden || a.polymer; });
    for(var i = 0; i < system.atoms.length; i++) {
        var a = system.atoms[i];
        if (anyShown && a.hidden && !a.polymer) continue;
        var r = v.elements[a.symbol].radius;
        r = 2.5 * v.atomScale * (1 + (r - 1) * v.relativeAtomScale);
        if (v.surface) {
            // The molecular surface reaches about a van der Waals radius out.
            r = Math.max(r, 2.0);
        }
        var p = glm.vec4.fromValues(a.x, a.y, a.z, 0);
        glm.vec4.transformMat4(p, p, v.rotation);
        maxX = Math.max(maxX, p[0] + r);
        minX = Math.min(minX, p[0] - r);
        maxY = Math.max(maxY, p[1] + r);
        minY = Math.min(minY, p[1] - r);
    }
    if (v.unitCell) {
        var corners = System.cellCorners(system);
        for (var c = 0; c < corners.length; c++) {
            var q = glm.vec4.fromValues(corners[c][0], corners[c][1], corners[c][2], 0);
            glm.vec4.transformMat4(q, q, v.rotation);
            maxX = Math.max(maxX, q[0] + 0.5);
            minX = Math.min(minX, q[0] - 0.5);
            maxY = Math.max(maxY, q[1] + 0.5);
            minY = Math.min(minY, q[1] - 0.5);
        }
    }
    var cx = minX + (maxX - minX) / 2.0;
    var cy = minY + (maxY - minY) / 2.0;
    let mres = Math.max(v.resolution.x,v.resolution.y)
    //cx += (maxX - minX) * (1-v.resolution.x/mres);
    //cy += (maxY - minY) * (1-v.resolution.y/mres);
    cx += (maxX - minX) * (mres/v.resolution.x - 1)/2;
    cy += (maxY - minY) * (mres/v.resolution.y - 1)/2;
    v.translation.x = cx;
    v.translation.y = cy;
    var scale = Math.max((maxX - minX)*(mres/v.resolution.x), (maxY - minY)*(mres/v.resolution.y));
    v.zoom = 1/(scale * 1.01);
};


var override = module.exports.override = function(v, data) {
    for (var key in data) {
        v[key] = data[key];
    }
    resolve(v);
};


var clone = module.exports.clone = function(v) {
    return deserialize(serialize(v));
};


var serialize = module.exports.serialize = function(v) {
    return JSON.stringify(v);
};


var deserialize = module.exports.deserialize = function(v) {
    v = JSON.parse(v);
    v.rotation = glm.mat4.clone(v.rotation);
    return v;
};


var resolve = module.exports.resolve = function(v) {
    v.dofStrength = clamp(0, 1, v.dofStrength);
    v.dofPosition = clamp(0, 1, v.dofPosition);
    v.zoom = clamp(0.001, 2.0, v.zoom);
    v.atomScale = clamp(0, 1, v.atomScale);
    v.relativeAtomScale = clamp(0, 1, v.relativeAtomScale);
    v.bondScale = clamp(0, 1, v.bondScale);
    v.bondShade = clamp(0, 1, v.bondShade);
    v.atomShade = clamp(0, 1, v.atomShade);
    v.ao = clamp(0, 1, v.ao);
    v.brightness = clamp(0, 1, v.brightness);
    v.outline = clamp(0, 1, v.outline);
    v.cartoonShade = clamp(0, 1, v.cartoonShade);
    v.surfaceOpacity = clamp(0, 1, v.surfaceOpacity);
    v.specular = clamp(0, 1, v.specular);
    v.gloss = clamp(0, 1, v.gloss);
    v.metallic = clamp(0, 1, v.metallic);
    v.shadows = clamp(0, 1, v.shadows);
    v.rim = clamp(0, 2, v.rim);
    v.fog = clamp(0, 1, v.fog);
    v.saturation = clamp(0, 3, v.saturation);
    v.outlineWidth = clamp(0.25, 8, v.outlineWidth);
};


var translate = module.exports.translate = function(v, dx, dy) {
    v.translation.x -= dx/(v.resolution.x * v.zoom);
    v.translation.y += dy/(v.resolution.y * v.zoom);
    resolve(v);
};


var rotate = module.exports.rotate = function(v, dx, dy) {
    var m = glm.mat4.create();
    glm.mat4.rotateY(m, m, dx * 0.005);
    glm.mat4.rotateX(m, m, dy * 0.005);
    glm.mat4.multiply(v.rotation, m, v.rotation);
    const ao = v.ao;
    v.ao = 0;
    resolve(v);
    v.ao = ao;
};

var rotateX = module.exports.rotateX = function(v, dx) {
    var m = glm.mat4.create();
    glm.mat4.rotateX(m, m, dx);
    v.rotation = m;
    //glm.mat4.multiply(v.rotation, m, v.rotation);
    const ao = v.ao;
    v.ao = 0;
    resolve(v);
    v.ao = ao;
};

var rotateY = module.exports.rotateY = function(v, dy) {
    var m = glm.mat4.create();
    glm.mat4.rotateY(m, m, dy);
    v.rotation = m;
    //glm.mat4.multiply(v.rotation, m, v.rotation);
    const ao = v.ao;
    v.ao = 0;
    resolve(v);
    v.ao = ao;
};

var rotateZ = module.exports.rotateZ = function(v, dz) {
    var m = glm.mat4.create();
    glm.mat4.rotateZ(m, m, dz);
    v.rotation = m;
    //glm.mat4.multiply(v.rotation, m, v.rotation);
    const ao = v.ao;
    v.ao = 0;
    resolve(v);
    v.ao = ao;
};


// Rotates the view by angle (radians) about the screen's vertical axis.
module.exports.turn = function(v, angle) {
    var m = glm.mat4.create();
    glm.mat4.rotateY(m, m, angle);
    v.rotation = glm.mat4.multiply(glm.mat4.create(), m, v.rotation);
};


var getRect = module.exports.getRect = function(v) {
    var width = 1.0/v.zoom;
    var height = width/v.aspect;
    var bottom = -height/2 + v.translation.y;
    var top = height/2 + v.translation.y;
    var left = -width/2 + v.translation.x;
    var right = width/2 + v.translation.x;
    return {
        bottom: bottom,
        top: top,
        left: left,
        right: right
    };
};


var getBondRadius = module.exports.getBondRadius = function(v) {
    return v.bondScale * v.atomScale *
        (1 + (consts.MIN_ATOM_RADIUS - 1) * v.relativeAtomScale);
};
