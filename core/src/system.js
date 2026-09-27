"use strict";

var glm = require("./gl-matrix")

var elements = require("./elements");
var consts = require("./const");

var newSystem = module.exports.new = function() {
    return {
        atoms: [],
        farAtom: undefined,
        bonds: []
    }
};

var calculateBonds = module.exports.calculateBonds = function(s, v) {
    var elems = elements;
    if (v != undefined)
        elems = v.elements;
    var bonds = [];
    var sorted = s.atoms.filter(function(a) {
        return !a.hidden;
    });
    sorted.sort(function(a, b) {
        return a.z - b.z;
    });
    for (var i = 0; i < sorted.length; i++) {
        var a = sorted[i];
        var j = i + 1;
        while(j < sorted.length && sorted[j].z < sorted[i].z + 2.5 * 2 * consts.MAX_ATOM_RADIUS) {
            var b = sorted[j];
            var l = glm.vec3.fromValues(a.x, a.y, a.z);
            var m = glm.vec3.fromValues(b.x, b.y, b.z);
            var d = glm.vec3.distance(l, m);
            var ea = elems[a.symbol];
            var eb = elems[b.symbol];
            if (d < 2.5*(ea.radius+eb.radius)) {
                bonds.push({
                    posA: {
                        x: a.x,
                        y: a.y,
                        z: a.z
                    },
                    posB: {
                        x: b.x,
                        y: b.y,
                        z: b.z
                    },
                    radA: ea.radius,
                    radB: eb.radius,
                    colA: {
                        r: (a.displayColor || ea.color)[0],
                        g: (a.displayColor || ea.color)[1],
                        b: (a.displayColor || ea.color)[2]
                    },
                    colB: {
                        r: (b.displayColor || eb.color)[0],
                        g: (b.displayColor || eb.color)[1],
                        b: (b.displayColor || eb.color)[2]
                    },
                    metA: consts.isMetal(a.symbol) ? 1 : 0,
                    metB: consts.isMetal(b.symbol) ? 1 : 0,
                    cutoff: d/(ea.radius+eb.radius)
                });
            }
            j++;
        }
    }
    bonds.sort(function(a, b) {
        return a.cutoff - b.cutoff;
    });
    s.bonds = bonds;
}


var addAtom = module.exports.addAtom = function(s, symbol, x, y, z, info) {
    var atom = {
        symbol: symbol,
        x: x,
        y: y,
        z: z,
    };
    // Optional residue information (name, resName, chain, resSeq, ...) from PDB.
    if (info !== undefined) {
        for (var key in info) {
            if (!(key in atom)) {
                atom[key] = info[key];
            }
        }
    }
    s.atoms.push(atom);
};

var getCentroid = module.exports.getCentroid = function(s) {
    var xsum = 0;
    var ysum = 0;
    var zsum = 0;
    for (var i = 0; i < s.atoms.length; i++) {
        xsum += s.atoms[i].x;
        ysum += s.atoms[i].y;
        zsum += s.atoms[i].z;
    }
    return {
        x: xsum/s.atoms.length,
        y: ysum/s.atoms.length,
        z: zsum/s.atoms.length
    };
};

var center = module.exports.center = function(s) {
    var shift = getCentroid(s);
    for (var i = 0; i < s.atoms.length; i++) {
        var atom = s.atoms[i];
        atom.x -= shift.x;
        atom.y -= shift.y;
        atom.z -= shift.z;
    }
    // Total shift from file coordinates, so frames and the cell stay aligned.
    var o = s.offset || {x: 0, y: 0, z: 0};
    s.offset = {x: o.x + shift.x, y: o.y + shift.y, z: o.z + shift.z};
    s.farAtom = undefined;
}

// Moves the atoms to frame k (coordinates as in the file) and marks derived
// geometry (bonds, cartoon, surface) as outdated.
module.exports.setFrame = function(s, k) {
    if (!s.frames || s.frames.length === 0) return;
    k = Math.max(0, Math.min(s.frames.length - 1, k | 0));
    var f = s.frames[k];
    var o = s.offset || {x: 0, y: 0, z: 0};
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        a.x = f[3 * i] - o.x;
        a.y = f[3 * i + 1] - o.y;
        a.z = f[3 * i + 2] - o.z;
    }
    s.frameIndex = k;
    s.version = (s.version || 0) + 1;
    s.farAtom = undefined;
};

// Corners of the unit cell in centered coordinates (empty without a cell).
var cellCorners = module.exports.cellCorners = function(s) {
    if (!s.cell) return [];
    var o = s.offset || {x: 0, y: 0, z: 0};
    var a = s.cell[0], b = s.cell[1], c = s.cell[2];
    var out = [];
    for (var n = 0; n < 8; n++) {
        var i = n & 1, j = (n >> 1) & 1, k = (n >> 2) & 1;
        out.push([i * a[0] + j * b[0] + k * c[0] - o.x,
                  i * a[1] + j * b[1] + k * c[1] - o.y,
                  i * a[2] + j * b[2] + k * c[2] - o.z]);
    }
    return out;
}

var getFarAtom = module.exports.getFarAtom = function(s, v) {
    if (s.farAtom !== undefined) {
        return s.farAtom;
    }
    var elems = elements;
    if (v != undefined)
        elems = v.elements;

    s.farAtom = s.atoms[0];
    var maxd = 0.0;
    for (var i = 0; i < s.atoms.length; i++) {
        var atom = s.atoms[i];
        var r = elems[atom.symbol].radius;
        var rd = Math.sqrt(r*r + r*r + r*r) * 2.5;
        var d = Math.sqrt(atom.x*atom.x + atom.y*atom.y + atom.z*atom.z) + rd;
        if (d > maxd) {
            maxd = d;
            s.farAtom = atom;
        }
    }
    return s.farAtom;
}

var getRadius = module.exports.getRadius = function(s, v) {
    var atom = getFarAtom(s, v);
    var r = consts.MAX_ATOM_RADIUS;
    var rd = Math.sqrt(r*r + r*r + r*r) * 2.5;
    var radius = Math.sqrt(atom.x*atom.x + atom.y*atom.y + atom.z*atom.z) + rd;
    var corners = cellCorners(s);
    for (var i = 0; i < corners.length; i++) {
        var p = corners[i];
        radius = Math.max(radius, Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]) + 1.0);
    }
    return radius;
}
