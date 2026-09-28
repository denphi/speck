"use strict";

var pdb = require("./pdb.js");
var cif = require("./cif.js");
var sdf = require("./sdf.js");
var xyz = require("./xyz.js");

// Structure text in any supported format -> {format, atoms, helices, sheets,
// cell, bonds, frames, residues}. Detected from the content: mmCIF, PDB,
// MDL Molfile / SDF, else XYZ / extended XYZ. `residues` is true when atoms
// carry residue information (chain, resName, resSeq, ...), which cartoons,
// surfaces and selections use. `bonds` lists explicit bonds from the file
// as atom index pairs.
function detect(text) {
    if (cif.isCIF(text)) return "mmcif";
    if (pdb.isPDB(text)) return "pdb";
    if (sdf.isSDF(text)) return "sdf";
    return "xyz";
}

// onProgress(fraction), optional: reading progress for mmCIF and PDB text.
function parse(text, onProgress) {
    var format = detect(text);
    var parsed = format === "mmcif" ? cif.parse(text, onProgress) : format === "pdb" ? pdb.parse(text, onProgress) :
                 format === "sdf" ? sdf.parse(text) : xyz.parse(text);
    parsed.format = format;
    parsed.residues = format === "mmcif" || format === "pdb";
    parsed.bonds = parsed.bonds || [];
    dropUnreadable(parsed);
    return parsed;
}

function finite(a) {
    return isFinite(a.x) && isFinite(a.y) && isFinite(a.z);
}

// Leaves out atoms without three readable coordinates (a damaged line, or
// the last line of an interrupted download), with the bonds that use them,
// and frames with unreadable coordinates (e.g. a truncated last model): one
// NaN would otherwise spread through centering and hide the whole
// structure. Sets parsed.skipped and parsed.skippedFrames (counts).
function dropUnreadable(parsed) {
    var atoms = parsed.atoms, n = atoms.length, kept = 0;
    var index = new Int32Array(n);
    for (var i = 0; i < n; i++) index[i] = finite(atoms[i]) ? kept++ : -1;
    parsed.skipped = n - kept;
    var frames = parsed.frames || [];
    if (parsed.skipped) {
        parsed.atoms = atoms.filter(function(a, k) { return index[k] >= 0; });
        parsed.bonds = parsed.bonds.filter(function(b) { return index[b[0]] >= 0 && index[b[1]] >= 0; })
            .map(function(b) { return [index[b[0]], index[b[1]]]; });
        frames = frames.map(function(f) {
            if (f.length !== 3 * n) return f;
            var g = new Float32Array(3 * kept);
            for (var k = 0; k < n; k++) {
                var j = index[k];
                if (j >= 0) {
                    g[3 * j] = f[3 * k]; g[3 * j + 1] = f[3 * k + 1]; g[3 * j + 2] = f[3 * k + 2];
                }
            }
            return g;
        });
    }
    var size = 3 * kept;
    var good = frames.filter(function(f, k) {
        if (k === 0) return true;
        if (f.length !== size) return false;
        for (var c = 0; c < f.length; c++) if (!isFinite(f[c])) return false;
        return true;
    });
    parsed.skippedFrames = frames.length - good.length;
    parsed.frames = good;
}

// Parsed structures cross to and from a Web Worker as columns of typed
// arrays (transferred, not copied) plus string tables, which is much faster
// than cloning one object per atom.
var FIELDS = ["name", "resName", "chain", "iCode", "entity"];

function pack(parsed) {
    var atoms = parsed.atoms, n = atoms.length;
    var xyz = new Float64Array(3 * n);
    var strings = [], index = {};
    function id(value) {
        var v = value === undefined ? "" : value;
        var k = index[v];
        if (k === undefined) {
            k = index[v] = strings.length;
            strings.push(v);
        }
        return k;
    }
    var symbol = new Uint32Array(n);
    var cols = {};
    if (parsed.residues) {
        FIELDS.forEach(function(f) { cols[f] = new Uint32Array(n); });
        cols.resSeq = new Int32Array(n);
        cols.bfactor = new Float32Array(n);
        cols.hetero = new Uint8Array(n);
    }
    for (var i = 0; i < n; i++) {
        var a = atoms[i];
        xyz[3 * i] = a.x; xyz[3 * i + 1] = a.y; xyz[3 * i + 2] = a.z;
        symbol[i] = id(a.symbol);
        if (parsed.residues) {
            for (var f = 0; f < FIELDS.length; f++) cols[FIELDS[f]][i] = id(a[FIELDS[f]]);
            cols.resSeq[i] = a.resSeq;
            cols.bfactor[i] = a.bfactor;
            cols.hetero[i] = a.hetero ? 1 : 0;
        }
    }
    var bonds = new Int32Array(2 * parsed.bonds.length);
    for (var b = 0; b < parsed.bonds.length; b++) {
        bonds[2 * b] = parsed.bonds[b][0];
        bonds[2 * b + 1] = parsed.bonds[b][1];
    }
    var packed = {
        format: parsed.format, residues: parsed.residues, count: n, strings: strings, xyz: xyz, symbol: symbol,
        cols: cols, bonds: bonds, helices: parsed.helices || [], sheets: parsed.sheets || [], cell: parsed.cell || null,
        frames: parsed.frames, skipped: parsed.skipped || 0, skippedFrames: parsed.skippedFrames || 0
    };
    var transfer = [xyz.buffer, symbol.buffer, bonds.buffer];
    for (var c in cols) transfer.push(cols[c].buffer);
    parsed.frames.forEach(function(f) { if (transfer.indexOf(f.buffer) < 0) transfer.push(f.buffer); });
    return {packed: packed, transfer: transfer};
}

function unpack(p) {
    var atoms = new Array(p.count), S = p.strings, xyz = p.xyz, cols = p.cols;
    for (var i = 0; i < p.count; i++) {
        var a = {symbol: S[p.symbol[i]], x: xyz[3 * i], y: xyz[3 * i + 1], z: xyz[3 * i + 2]};
        if (p.residues) {
            a.name = S[cols.name[i]];
            a.resName = S[cols.resName[i]];
            a.chain = S[cols.chain[i]];
            a.resSeq = cols.resSeq[i];
            a.iCode = S[cols.iCode[i]];
            if (S[cols.entity[i]]) a.entity = S[cols.entity[i]];
            a.bfactor = cols.bfactor[i];
            a.hetero = cols.hetero[i] === 1;
        }
        atoms[i] = a;
    }
    var bonds = [];
    for (var b = 0; b < p.bonds.length; b += 2) bonds.push([p.bonds[b], p.bonds[b + 1]]);
    return {format: p.format, residues: p.residues, atoms: atoms, bonds: bonds, helices: p.helices, sheets: p.sheets,
            cell: p.cell, frames: p.frames, skipped: p.skipped || 0, skippedFrames: p.skippedFrames || 0};
}

module.exports.detect = detect;
module.exports.parse = parse;
module.exports.pack = pack;
module.exports.unpack = unpack;
