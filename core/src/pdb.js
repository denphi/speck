"use strict";

var elements = require("./elements");

// Minimal PDB reader: first MODEL only, first alternate location only.
// Returns atoms carrying residue information plus HELIX/SHEET ranges.

function isPDB(data) {
    return /^(ATOM  |HETATM)/m.test(data);
}

function elementSymbol(line, name) {
    var sym = line.substring(76, 78).trim();
    if (sym === "") {
        // Fall back to the atom name, dropping digits and hydrogen prefixes.
        sym = name.replace(/[^A-Za-z]/g, "").substring(0, 2);
        if (!(capitalize(sym) in elements)) {
            sym = sym.substring(0, 1);
        }
    }
    sym = capitalize(sym);
    return sym in elements ? sym : "Xx";
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
}

// Unit cell vectors from a CRYST1 record (a, b, c, alpha, beta, gamma).
function cellFromCryst1(line) {
    var a = parseFloat(line.substring(6, 15)), b = parseFloat(line.substring(15, 24));
    var c = parseFloat(line.substring(24, 33));
    var al = parseFloat(line.substring(33, 40)) * Math.PI / 180;
    var be = parseFloat(line.substring(40, 47)) * Math.PI / 180;
    var ga = parseFloat(line.substring(47, 54)) * Math.PI / 180;
    // Cryo-EM and NMR entries carry a placeholder 1 x 1 x 1 cell.
    if (!(a > 1.5 && b > 1.5 && c > 1.5) || [al, be, ga].some(isNaN)) return null;
    var cx = Math.cos(be);
    var cy = (Math.cos(al) - Math.cos(be) * Math.cos(ga)) / Math.sin(ga);
    var cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
    return [[a, 0, 0], [b * Math.cos(ga), b * Math.sin(ga), 0], [c * cx, c * cy, c * cz]];
}

function parse(data) {
    var lines = data.split("\n");
    var atoms = [];
    var helices = [];
    var sheets = [];
    var cell = null;
    // Coordinates of MODELs after the first; atoms must match the first model.
    var frames = [];
    var model = null;
    var models = 0;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var record = line.substring(0, 6);
        if (record === "ENDMDL") {
            models++;
            if (model !== null && model.length === 3 * atoms.length) {
                frames.push(new Float32Array(model));
            }
            model = [];
        } else if ((record === "ATOM  " || record === "HETATM") && models > 0) {
            var alt = line.charAt(16);
            if (model !== null && (alt === " " || alt === "A" || alt === "")) {
                model.push(parseFloat(line.substring(30, 38)), parseFloat(line.substring(38, 46)),
                           parseFloat(line.substring(46, 54)));
            }
        } else if (record === "CRYST1") {
            cell = cellFromCryst1(line);
        } else if (record === "ATOM  " || record === "HETATM") {
            var altLoc = line.charAt(16);
            if (altLoc !== " " && altLoc !== "A" && altLoc !== "") {
                continue;
            }
            var name = line.substring(12, 16).trim();
            atoms.push({
                symbol: elementSymbol(line, name),
                x: parseFloat(line.substring(30, 38)),
                y: parseFloat(line.substring(38, 46)),
                z: parseFloat(line.substring(46, 54)),
                name: name,
                resName: line.substring(17, 20).trim(),
                chain: line.charAt(21),
                resSeq: parseInt(line.substring(22, 26)),
                iCode: line.charAt(26),
                // B-factor; AlphaFold models store the pLDDT confidence here.
                bfactor: parseFloat(line.substring(60, 66)),
                hetero: record === "HETATM"
            });
        } else if (record === "HELIX ") {
            helices.push({
                chain: line.charAt(19),
                start: parseInt(line.substring(21, 25)),
                end: parseInt(line.substring(33, 37))
            });
        } else if (record === "SHEET ") {
            sheets.push({
                chain: line.charAt(21),
                start: parseInt(line.substring(22, 26)),
                end: parseInt(line.substring(33, 37))
            });
        }
    }
    // Frame 0 is the first model.
    var first = new Float32Array(3 * atoms.length);
    for (var k = 0; k < atoms.length; k++) {
        first[3 * k] = atoms[k].x;
        first[3 * k + 1] = atoms[k].y;
        first[3 * k + 2] = atoms[k].z;
    }
    return {
        atoms: atoms,
        helices: helices,
        sheets: sheets,
        cell: cell,
        frames: [first].concat(frames)
    };
}

module.exports.isPDB = isPDB;
module.exports.parse = parse;
