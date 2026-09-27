"use strict";

var elements = require("./elements");

// XYZ / extended XYZ reader. Every frame must have the same atoms. The cell
// comes from an extended-XYZ comment line: Lattice="ax ay az bx by bz cx cy cz".

function symbolOf(token) {
    if (/^\d+$/.test(token)) {
        var e = elements[parseInt(token)];
        return e ? e.symbol : "Xx";
    }
    var sym = token.replace(/[^A-Za-z]/g, "");
    sym = sym.charAt(0).toUpperCase() + sym.substring(1, 2).toLowerCase();
    if (!(sym in elements)) {
        sym = sym.charAt(0);
    }
    return sym in elements ? sym : "Xx";
}

function parseLattice(comment) {
    var m = /Lattice\s*=\s*"([^"]+)"/i.exec(comment || "");
    if (!m) return null;
    var v = m[1].trim().split(/\s+/).map(parseFloat);
    if (v.length !== 9 || v.some(isNaN)) return null;
    return [[v[0], v[1], v[2]], [v[3], v[4], v[5]], [v[6], v[7], v[8]]];
}

module.exports.parse = function(data) {
    var lines = data.split("\n");
    var atoms = [];
    var frames = [];
    var cell = null;
    var at = 0;
    while (at < lines.length) {
        var natoms = parseInt(lines[at]);
        if (isNaN(natoms) || natoms <= 0 || at + natoms + 2 > lines.length) break;
        if (frames.length === 0) {
            cell = parseLattice(lines[at + 1]);
        } else if (natoms !== atoms.length) {
            break;
        }
        var coords = new Float32Array(3 * natoms);
        for (var j = 0; j < natoms; j++) {
            var tokens = lines[at + 2 + j].trim().split(/\s+/);
            var x = parseFloat(tokens[1]), y = parseFloat(tokens[2]), z = parseFloat(tokens[3]);
            coords[3 * j] = x;
            coords[3 * j + 1] = y;
            coords[3 * j + 2] = z;
            if (frames.length === 0) {
                atoms.push({symbol: symbolOf(tokens[0]), x: x, y: y, z: z});
            }
        }
        frames.push(coords);
        at += natoms + 2;
    }
    return {atoms: atoms, frames: frames, cell: cell};
};
