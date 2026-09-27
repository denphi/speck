"use strict";

var glm = require("./gl-matrix")

var elements = require("./elements");
var consts = require("./const");

var newSystem = module.exports.new = function() {
    return {
        atoms: [],
        farAtom: undefined,
        bonds: {a: new Int32Array(0), b: new Int32Array(0), count: 0}
    }
};

// Bonds between visible atoms closer than bondThreshold x (sum of radii),
// plus the bonds listed in the file (s.explicitBonds: CONECT, _struct_conn,
// Molfile bonds), which are drawn whatever the threshold. Stored as atom
// index pairs: s.bonds = {a: Int32Array, b: Int32Array, count}. Neighbors come
// from a uniform grid (a counting sort of the atoms into cells), so this is
// linear in the atom count.
var calculateBonds = module.exports.calculateBonds = function(s, v) {
    var elems = v != undefined ? v.elements : elements;
    var limit = v != undefined && v.bondThreshold > 0 ? Math.min(2.5, v.bondThreshold) : 2.5;
    var atoms = s.atoms, count = atoms.length;

    var visible = [], maxR = 0;
    var minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (var i = 0; i < count; i++) {
        var a = atoms[i];
        if (a.hidden) continue;
        visible.push(i);
        maxR = Math.max(maxR, elems[a.symbol].radius);
        if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
        if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
        if (a.z < minZ) minZ = a.z; if (a.z > maxZ) maxZ = a.z;
    }
    var n = visible.length;
    var outA = new Int32Array(Math.max(16, 2 * n)), outB = new Int32Array(outA.length), m = 0;
    function push(i, j) {
        if (m === outA.length) {
            var ga = new Int32Array(2 * m), gb = new Int32Array(2 * m);
            ga.set(outA); gb.set(outB);
            outA = ga; outB = gb;
        }
        outA[m] = i; outB[m] = j; m++;
    }

    if (n > 1) {
        // Cells at least as large as the longest possible bond; at most ~4M cells.
        var size = Math.max(0.5, 2 * maxR * limit);
        var ex = maxX - minX, ey = maxY - minY, ez = maxZ - minZ;
        while ((Math.floor(ex / size) + 1) * (Math.floor(ey / size) + 1) * (Math.floor(ez / size) + 1) > 4e6) size *= 1.5;
        var nx = Math.floor(ex / size) + 1, ny = Math.floor(ey / size) + 1, nz = Math.floor(ez / size) + 1;
        var X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), R = new Float64Array(n);
        var cellOf = new Int32Array(n), start = new Int32Array(nx * ny * nz + 1);
        for (var k = 0; k < n; k++) {
            var at = atoms[visible[k]];
            X[k] = at.x; Y[k] = at.y; Z[k] = at.z; R[k] = elems[at.symbol].radius;
            var c = (Math.floor((at.z - minZ) / size) * ny + Math.floor((at.y - minY) / size)) * nx + Math.floor((at.x - minX) / size);
            cellOf[k] = c;
            start[c + 1]++;
        }
        for (var c2 = 0; c2 < nx * ny * nz; c2++) start[c2 + 1] += start[c2];
        var order = new Int32Array(n), fill = start.slice(0, nx * ny * nz);
        for (var k2 = 0; k2 < n; k2++) order[fill[cellOf[k2]]++] = k2;

        // Each atom against its own cell (later atoms) and 13 of its 26
        // neighbor cells (the other 13 see it from their side).
        var OFFSETS = [];
        for (var dz = -1; dz <= 1; dz++) for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
            if (dz > 0 || (dz === 0 && (dy > 0 || (dy === 0 && dx > 0)))) OFFSETS.push([dx, dy, dz]);
        }
        for (var k3 = 0; k3 < n; k3++) {
            var ka = order[k3];
            var cell = cellOf[ka];
            var cx = cell % nx, cy = Math.floor(cell / nx) % ny, cz = Math.floor(cell / (nx * ny));
            var xa = X[ka], ya = Y[ka], za = Z[ka], ra = R[ka];
            for (var o = -1; o < OFFSETS.length; o++) {
                var from, to;
                if (o < 0) {
                    from = k3 + 1; to = start[cell + 1];            // same cell, later atoms
                } else {
                    var qx = cx + OFFSETS[o][0], qy = cy + OFFSETS[o][1], qz = cz + OFFSETS[o][2];
                    if (qx < 0 || qy < 0 || qz < 0 || qx >= nx || qy >= ny || qz >= nz) continue;
                    var q = (qz * ny + qy) * nx + qx;
                    from = start[q]; to = start[q + 1];
                }
                for (var t = from; t < to; t++) {
                    var kb = order[t];
                    var ddx = xa - X[kb], ddy = ya - Y[kb], ddz = za - Z[kb];
                    var reach = limit * (ra + R[kb]);
                    if (ddx * ddx + ddy * ddy + ddz * ddz < reach * reach) push(visible[ka], visible[kb]);
                }
            }
        }
    }

    // Bonds listed in the file are drawn whatever bondThreshold is, e.g. long
    // metal-ligand bonds.
    var extra = s.explicitBonds;
    if (extra && extra.length) {
        var seen = new Set();
        for (var e = 0; e < m; e++) seen.add(Math.min(outA[e], outB[e]) * count + Math.max(outA[e], outB[e]));
        for (var f = 0; f < extra.length; f++) {
            var i1 = extra[f][0], i2 = extra[f][1];
            var pa = atoms[i1], pb = atoms[i2];
            if (!pa || !pb || pa.hidden || pb.hidden || i1 === i2) continue;
            var key = Math.min(i1, i2) * count + Math.max(i1, i2);
            if (seen.has(key)) continue;
            var fx = pa.x - pb.x, fy = pa.y - pb.y, fz = pa.z - pb.z;
            // Guard against bonds across periodic images or bad records.
            if (fx * fx + fy * fy + fz * fz > 16) continue;
            seen.add(key);
            push(i1, i2);
        }
    }
    s.bonds = {a: outA.subarray(0, m), b: outB.subarray(0, m), count: m};
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
// geometry (bonds, cartoon, surface) as outdated. A fractional k (films)
// blends the two frames around it.
module.exports.setFrame = function(s, k) {
    if (!s.frames || s.frames.length === 0) return;
    k = Math.max(0, Math.min(s.frames.length - 1, +k || 0));
    var k0 = Math.floor(k), u = k - k0;
    var f = s.frames[k0], g = u > 1e-6 ? s.frames[Math.min(s.frames.length - 1, k0 + 1)] : null;
    var o = s.offset || {x: 0, y: 0, z: 0};
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        var x = f[3 * i], y = f[3 * i + 1], z = f[3 * i + 2];
        if (g) {
            x += (g[3 * i] - x) * u;
            y += (g[3 * i + 1] - y) * u;
            z += (g[3 * i + 2] - z) * u;
        }
        a.x = x - o.x;
        a.y = y - o.y;
        a.z = z - o.z;
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
