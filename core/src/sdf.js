"use strict";

var elements = require("./elements");

// MDL Molfile / SDF reader (V2000 and V3000), with the bonds from the file.
// Records after the first ($$$$-separated) with the same atoms become frames,
// e.g. conformers.

function isSDF(data) {
    var lines = data.split("\n", 5);
    return lines.length >= 4 && /V[23]000\s*$/.test(lines[3]);
}

function symbolOf(token) {
    var sym = token.replace(/[^A-Za-z]/g, "");
    sym = sym.charAt(0).toUpperCase() + sym.substring(1, 2).toLowerCase();
    if (sym === "D" || sym === "T") sym = "H";
    return sym in elements ? sym : "Xx";
}

// One record: {symbols, coords, bonds}
function parseRecord(lines) {
    var counts = lines[3] || "";
    var symbols = [], coords = [], bonds = [];
    if (/V3000\s*$/.test(counts)) {
        var block = null;
        var join = "";
        for (var i = 4; i < lines.length; i++) {
            var line = lines[i];
            if (line.substring(0, 6) !== "M  V30") {
                if (line.substring(0, 6) === "M  END") break;
                continue;
            }
            var body = join + line.substring(7).trim();
            if (/-$/.test(body)) {         // continued on the next line
                join = body.substring(0, body.length - 1);
                continue;
            }
            join = "";
            if (/^BEGIN ATOM/.test(body)) block = "atom";
            else if (/^BEGIN BOND/.test(body)) block = "bond";
            else if (/^END /.test(body)) block = null;
            else if (block === "atom") {
                var t = body.split(/\s+/);
                symbols.push(symbolOf(t[1]));
                coords.push(parseFloat(t[2]), parseFloat(t[3]), parseFloat(t[4]));
            } else if (block === "bond") {
                var u = body.split(/\s+/);
                bonds.push([parseInt(u[2]) - 1, parseInt(u[3]) - 1]);
            }
        }
    } else {
        var natoms = parseInt(counts.substring(0, 3));
        var nbonds = parseInt(counts.substring(3, 6));
        for (var a = 0; a < natoms; a++) {
            var l = lines[4 + a] || "";
            coords.push(parseFloat(l.substring(0, 10)), parseFloat(l.substring(10, 20)), parseFloat(l.substring(20, 30)));
            symbols.push(symbolOf(l.substring(31, 34)));
        }
        for (var b = 0; b < nbonds; b++) {
            var m = lines[4 + natoms + b] || "";
            bonds.push([parseInt(m.substring(0, 3)) - 1, parseInt(m.substring(3, 6)) - 1]);
        }
    }
    return {symbols: symbols, coords: coords, bonds: bonds};
}

function parse(data) {
    var records = data.split(/^\$\$\$\$[ \t\r]*$/m);
    var first = null;
    var frames = [];
    for (var r = 0; r < records.length; r++) {
        // Each record after a $$$$ line starts with that line's newline.
        var text = r > 0 ? records[r].replace(/^\r?\n/, "") : records[r];
        var lines = text.split(/\r?\n/);
        if (lines.length < 4 || !/V[23]000\s*$/.test(lines[3] || "")) continue;
        var rec = parseRecord(lines);
        if (first === null) {
            first = rec;
            frames.push(new Float32Array(rec.coords));
        } else if (rec.symbols.join() === first.symbols.join()) {
            frames.push(new Float32Array(rec.coords));
        }
    }
    if (first === null) {
        return {atoms: [], bonds: [], frames: [], cell: null};
    }
    var atoms = [];
    for (var i = 0; i < first.symbols.length; i++) {
        atoms.push({symbol: first.symbols[i], x: first.coords[3 * i], y: first.coords[3 * i + 1], z: first.coords[3 * i + 2]});
    }
    var n = atoms.length;
    var bonds = first.bonds.filter(function(p) {
        return p[0] >= 0 && p[1] >= 0 && p[0] < n && p[1] < n && p[0] !== p[1];
    });
    return {atoms: atoms, bonds: bonds, frames: frames, cell: null};
}

module.exports.isSDF = isSDF;
module.exports.parse = parse;
