"use strict";

// Atom selections for highlighting.
//
// A selection is an object whose keys are ANDed; each value may be a single
// value or a list (ORed):
//   index    0-based atom index in file order
//   chain    chain identifier
//   resName  residue name, e.g. "HEM"
//   resSeq   residue number, or a "start-end" range string
//   name     atom name, e.g. "CA"
//   element  element symbol, e.g. "Fe"
//   ligands  true for non-polymer, non-water residues
// An empty or missing selection highlights nothing.

var WATER = {HOH: 1, WAT: 1, DOD: 1, H2O: 1, TIP: 1, TIP3: 1, SOL: 1};

// '#rrggbb' (or an [r, g, b] array) to normalized RGB.
var parseColor = module.exports.parseColor = function(c, fallback) {
    if (Array.isArray(c)) return c;
    var m = /^#?([0-9a-f]{6})$/i.exec(c || "");
    if (!m) return fallback;
    var v = parseInt(m[1], 16);
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
};

function asList(v) {
    return Array.isArray(v) ? v : [v];
}

function matchesResSeq(value, spec) {
    var list = asList(spec);
    for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (typeof item === "string" && item.indexOf("-") > 0) {
            var parts = item.split("-");
            if (value >= parseInt(parts[0]) && value <= parseInt(parts[1])) return true;
        } else if (value === parseInt(item)) {
            return true;
        }
    }
    return false;
}

function matches(a, index, sel) {
    if ("index" in sel && asList(sel.index).indexOf(index) < 0) return false;
    if ("chain" in sel && asList(sel.chain).indexOf(a.chain) < 0) return false;
    if ("resName" in sel && asList(sel.resName).indexOf(a.resName) < 0) return false;
    if ("name" in sel && asList(sel.name).indexOf(a.name) < 0) return false;
    if ("element" in sel && asList(sel.element).indexOf(a.symbol) < 0) return false;
    if ("resSeq" in sel && (a.resSeq === undefined || !matchesResSeq(a.resSeq, sel.resSeq))) return false;
    if ("ligands" in sel && !!sel.ligands !== (a.name !== undefined && !a.polymer && !(a.resName in WATER))) {
        return false;
    }
    return true;
}

function isEmpty(sel) {
    if (!sel) return true;
    for (var key in sel) {
        return false;
    }
    return true;
}

// Blend toward a pale neutral so the highlighted part stands out.
var ghostColor = module.exports.ghostColor = function(c, ghost) {
    var t = 0.85 * ghost;
    return [c[0] + (0.93 - c[0]) * t, c[1] + (0.93 - c[1]) * t, c[2] + (0.93 - c[2]) * t];
};

// Color of a highlighted / other atom or residue given its scheme color.
var adjustColor = module.exports.adjustColor = function(color, highlighted, view) {
    if (!view._highlightActive) {
        return color;
    }
    if (highlighted) {
        return view._highlightColor || color;
    }
    return view.ghost > 0 ? ghostColor(color, view.ghost) : color;
};

// Flags atoms (a.highlight) and residues (r.highlight) and sets a.displayColor
// for atoms and bonds. Residues must already be perceived (Cartoon.getResidues).
module.exports.apply = function(s, view) {
    var sel = view.highlight;
    var active = !isEmpty(sel);
    view._highlightActive = active;
    view._highlightColor = parseColor(view.highlightColor, null);
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        a.highlight = active && matches(a, i, sel);
        if (a.residue) a.residue.highlight = false;
    }
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        if (a.highlight && a.residue) a.residue.highlight = true;
        var base = view.elements[a.symbol].color;
        var c = adjustColor(base, a.highlight, view);
        a.displayColor = c === base ? undefined : c;
    }
};
