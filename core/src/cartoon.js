"use strict";

// Cartoon (ribbon) representation.
//
// The mesh is plain triangles with per-vertex normals and colors, so it goes
// through the same color / normal / random-rotation depth passes as the atom
// imposters and receives exactly the same ambient occlusion, outlines and DOF.

var WATER = {HOH: 1, WAT: 1, DOD: 1, H2O: 1, TIP: 1, TIP3: 1, TIP4: 1, TIP5: 1, T3P: 1, T4P: 1, SPC: 1, SPCE: 1, SOL: 1};

var BACKBONE = {
    // protein
    N: 1, C: 1, O: 1, OXT: 1, H: 1, H1: 1, H2: 1, H3: 1, HA: 1, HA2: 1, HA3: 1,
    // nucleic acid phosphate
    P: 1, OP1: 1, OP2: 1, OP3: 1, O1P: 1, O2P: 1, O3P: 1, "O5'": 1, "C5'": 1, "O3'": 1
};

var SS_COLORS = {
    helix: [0.88, 0.33, 0.40],
    sheet: [0.98, 0.80, 0.32],
    coil: [0.82, 0.82, 0.82]
};

var CHAIN_COLORS = [
    [0.36, 0.55, 0.85],
    [0.95, 0.55, 0.30],
    [0.40, 0.75, 0.45],
    [0.86, 0.36, 0.42],
    [0.62, 0.47, 0.80],
    [0.95, 0.78, 0.30],
    [0.35, 0.75, 0.80],
    [0.90, 0.55, 0.75]
];

var RAINBOW = [
    [0.23, 0.30, 0.75],
    [0.25, 0.70, 0.85],
    [0.45, 0.80, 0.40],
    [0.97, 0.85, 0.30],
    [0.88, 0.30, 0.25]
];

// AlphaFold confidence bands: >90, 70-90, 50-70, <50.
var PLDDT_COLORS = [
    [0.000, 0.325, 0.839],
    [0.396, 0.796, 0.953],
    [1.000, 0.859, 0.075],
    [1.000, 0.490, 0.271]
];

var Select = require("./select");

var PROTEIN_GAP = 4.3;
var NUCLEIC_GAP = 8.0;
var ARROW_SCALE = 1.6;


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Small vector helpers on [x, y, z] arrays.

function pos(a) { return [a.x, a.y, a.z]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function len(a) { return Math.sqrt(dot(a, a)); }
function dist(a, b) { return len(sub(a, b)); }
function normalize(a) {
    var l = len(a);
    return l > 0 ? scale(a, 1 / l) : [0, 0, 0];
}
function mix(a, b, t) { return a + (b - a) * t; }
function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
function smoothstep(t) { return t * t * (3 - 2 * t); }

function anyPerpendicular(t) {
    var p = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return normalize(cross(t, p));
}


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Residues and secondary structure.

var getResidues = module.exports.getResidues = function(s) {
    if (s._residues !== undefined) {
        return s._residues;
    }
    var residues = [];
    var current = null;
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        if (a.name === undefined) {
            continue;
        }
        var key = a.chain + ":" + a.resSeq + ":" + a.iCode + ":" + a.resName;
        if (current === null || current.key !== key) {
            current = {
                key: key,
                chain: a.chain,
                resSeq: a.resSeq,
                resName: a.resName,
                entity: a.entity,
                atoms: {},
                list: [],
                ss: "C"
            };
            residues.push(current);
        }
        if (!(a.name in current.atoms)) {
            current.atoms[a.name] = a;
        }
        a.residue = current;
        current.list.push(a);
    }

    // HETATM residues are polymer only when bonded into the chain (modified
    // residues such as MSE or tRNA bases), not free ligands whose atom names
    // happen to look like a backbone (peptide-like drugs such as saquinavir).
    function bonded(a, b) {
        return a && b && dist(pos(a), pos(b)) < 2.0;
    }
    function linkedIntoChain(i) {
        var r = residues[i], prev = residues[i - 1], next = residues[i + 1];
        if (prev && prev.chain === r.chain &&
            (bonded(prev.atoms.C, r.atoms.N) || bonded(prev.atoms["O3'"], r.atoms.P))) return true;
        if (next && next.chain === r.chain &&
            (bonded(r.atoms.C, next.atoms.N) || bonded(r.atoms["O3'"], next.atoms.P))) return true;
        return false;
    }

    var polymer = [];
    for (var i = 0; i < residues.length; i++) {
        var r = residues[i];
        var ca = r.atoms.CA;
        // Standard residues count with only their trace atom too (CA- or
        // P-only models, common for older and very large structures).
        var standard = !r.list[0].hetero;
        if (ca && ca.symbol === "C" && ((r.atoms.C && r.atoms.N) || standard)) {
            r.type = "protein";
            r.trace = ca;
        } else if (r.atoms.P && (r.atoms["C4'"] || standard)) {
            r.type = "nucleic";
            r.trace = r.atoms.P;
        } else {
            continue;
        }
        if (r.list[0].hetero && !linkedIntoChain(i)) {
            r.type = undefined;
            r.trace = undefined;
            continue;
        }
        for (var j = 0; j < r.list.length; j++) {
            r.list[j].polymer = true;
        }
        polymer.push(r);
    }

    // Split into continuous segments.
    var segments = [];
    var seg = null;
    for (var i = 0; i < polymer.length; i++) {
        var r = polymer[i];
        var prev = seg ? seg[seg.length - 1] : null;
        var gap = r.type === "protein" ? PROTEIN_GAP : NUCLEIC_GAP;
        if (prev === null || prev.chain !== r.chain || prev.type !== r.type ||
            dist(pos(prev.trace), pos(r.trace)) > gap) {
            seg = [];
            segments.push(seg);
        }
        seg.push(r);
    }

    s._residues = {all: residues, polymer: polymer, segments: segments};
    assignSecondaryStructure(s, s._residues);
    return s._residues;
};


function assignSecondaryStructure(s, residues) {
    var helices = s.helices || [];
    var sheets = s.sheets || [];
    // Residues by chain, for the ranges given in the file.
    var byChain = {};
    for (var j = 0; j < residues.polymer.length; j++) {
        var r = residues.polymer[j];
        (byChain[r.chain] = byChain[r.chain] || []).push(r);
    }
    var covered = {};
    function mark(ranges, ss) {
        for (var i = 0; i < ranges.length; i++) {
            var g = ranges[i];
            var list = byChain[g.chain];
            if (!list) continue;
            covered[g.chain] = true;
            for (var k = 0; k < list.length; k++) {
                if (list[k].resSeq >= g.start && list[k].resSeq <= g.end) list[k].ss = ss;
            }
        }
    }
    mark(sheets, "E");
    mark(helices, "H");
    // Chains the file gives no secondary structure for (all of them for most
    // PDB-less inputs; in some assembly files the copies' chain names do not
    // match the HELIX / SHEET records) get it from backbone H-bonds.
    var rest = residues.segments.filter(function(seg) { return !covered[seg[0].chain]; });
    if (rest.length) computeSecondaryStructure(rest);
}


// Simplified DSSP (Kabsch & Sander 1983): backbone H-bond energies, alpha
// helices from consecutive i->i+4 turns, strands from bridge ladders.
function computeSecondaryStructure(segments) {
    var res = [];
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        if (seg[0].type !== "protein") {
            continue;
        }
        for (var j = 0; j < seg.length; j++) {
            var r = seg[j];
            if (!r.atoms.O) {
                continue;
            }
            var item = {
                r: r,
                N: pos(r.atoms.N),
                CA: pos(r.atoms.CA),
                C: pos(r.atoms.C),
                O: pos(r.atoms.O),
                H: null,
                seg: i,
                idx: j
            };
            res.push(item);
        }
    }
    var n = res.length;
    if (n === 0) {
        return;
    }

    // Amide hydrogens placed opposite the previous carbonyl.
    for (var i = 1; i < n; i++) {
        var a = res[i - 1], b = res[i];
        if (b.r.resName !== "PRO" && a.seg === b.seg && b.idx === a.idx + 1) {
            b.H = add(b.N, normalize(sub(a.C, a.O)));
        }
    }

    // Spatial grid on CA for neighbour search.
    var cell = 9.0;
    var grid = {};
    function cellKey(p) {
        return Math.floor(p[0] / cell) + "," + Math.floor(p[1] / cell) + "," + Math.floor(p[2] / cell);
    }
    for (var i = 0; i < n; i++) {
        var k = cellKey(res[i].CA);
        (grid[k] = grid[k] || []).push(i);
    }
    function neighbours(i) {
        var p = res[i].CA;
        var cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
        var out = [];
        for (var dx = -1; dx <= 1; dx++)
        for (var dy = -1; dy <= 1; dy++)
        for (var dz = -1; dz <= 1; dz++) {
            var list = grid[(cx + dx) + "," + (cy + dy) + "," + (cz + dz)];
            if (!list) continue;
            for (var m = 0; m < list.length; m++) {
                var j = list[m];
                if (j !== i && dist(p, res[j].CA) < cell) out.push(j);
            }
        }
        return out;
    }

    // hb[i][j] true when C=O of i accepts from N-H of j.
    var hb = [];
    for (var i = 0; i < n; i++) {
        hb.push({});
    }
    for (var j = 0; j < n; j++) {
        var d = res[j];
        if (d.H === null) continue;
        var nb = neighbours(j);
        for (var m = 0; m < nb.length; m++) {
            var i = nb[m];
            if (Math.abs(i - j) < 2) continue;
            var acc = res[i];
            var e = 27.888 * (1 / dist(acc.O, d.N) + 1 / dist(acc.C, d.H) -
                              1 / dist(acc.O, d.H) - 1 / dist(acc.C, d.N));
            if (e < -0.5) {
                hb[i][j] = true;
            }
        }
    }
    function bonded(i, j) {
        return i >= 0 && j >= 0 && i < n && j < n && hb[i][j] === true;
    }
    function linked(i, j) {
        // i and j are consecutive residues of the same segment
        return i >= 0 && j < n && res[i].seg === res[j].seg && res[j].idx === res[i].idx + 1;
    }

    var ss = [];
    for (var i = 0; i < n; i++) {
        ss.push("C");
    }

    // Beta bridges.
    var bridged = [];
    for (var i = 0; i < n; i++) {
        bridged.push(false);
    }
    for (var i = 1; i < n - 1; i++) {
        if (!linked(i - 1, i) || !linked(i, i + 1)) continue;
        var nb = neighbours(i);
        for (var m = 0; m < nb.length; m++) {
            var j = nb[m];
            if (Math.abs(i - j) < 3 || j < 1 || j >= n - 1) continue;
            if (!linked(j - 1, j) || !linked(j, j + 1)) continue;
            var parallel = (bonded(i - 1, j) && bonded(j, i + 1)) ||
                           (bonded(j - 1, i) && bonded(i, j + 1));
            var antiparallel = (bonded(i, j) && bonded(j, i)) ||
                               (bonded(i - 1, j + 1) && bonded(j - 1, i + 1));
            if (parallel || antiparallel) {
                bridged[i] = true;
                break;
            }
        }
    }
    for (var i = 0; i < n; i++) {
        if (bridged[i] && ((i > 0 && bridged[i - 1]) || (i < n - 1 && bridged[i + 1]))) {
            ss[i] = "E";
        }
    }

    // Alpha helices take precedence.
    for (var i = 1; i < n - 4; i++) {
        if (bonded(i - 1, i + 3) && bonded(i, i + 4) &&
            res[i + 4].seg === res[i - 1].seg && res[i + 4].idx === res[i - 1].idx + 5) {
            for (var k = i; k < i + 4; k++) {
                ss[k] = "H";
            }
        }
    }

    for (var i = 0; i < n; i++) {
        res[i].r.ss = ss[i];
    }
}


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Atom visibility when the cartoon is shown.

// Residues to draw as atoms over the cartoon: those of a highlight that
// picks out a site (at most SITE_RESIDUES residues, e.g. a pocket or a
// motif), not a whole chain.
var SITE_RESIDUES = 40;
function highlightedSite(s, view) {
    var sel = view.highlight;
    if (!sel || Object.keys(sel).length === 0) return null;
    var picked = new Set();
    var idx = require("./select").indices(s, sel);
    for (var k = 0; k < idx.length; k++) {
        var a = s.atoms[idx[k]];
        if (a.polymer && a.residue) {
            picked.add(a.residue);
            if (picked.size > SITE_RESIDUES) return null;
        }
    }
    return picked.size ? picked : null;
}

module.exports.applyVisibility = function(s, view) {
    var residues = getResidues(s);
    var mode = view.cartoonAtoms;
    var site = (view.cartoon || view.surface) && mode !== "all" ? highlightedSite(s, view) : null;
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        var hidden = false;
        if (a.name !== undefined && view.ligands === false && !a.polymer && !(a.resName in WATER)) {
            // Ligands switched off, in any representation.
            hidden = true;
        } else if (view.water === false && a.resName in WATER) {
            hidden = true;
        } else if ((view.cartoon || view.surface) && a.name !== undefined && mode !== "all") {
            if (a.resName in WATER) {
                hidden = true;
            } else if (a.polymer) {
                // Side chains of the whole structure, or of a highlighted site.
                var shown = mode === "sidechains" || (site !== null && site.has(a.residue));
                hidden = !(shown && !(a.name in BACKBONE));
            } else {
                hidden = mode === "none";
            }
        }
        a.hidden = hidden;
    }
    // Atoms colored by a residue scheme (view.atomColor: "chain", "entity",
    // "type", ...), e.g. for the Goodsell style; element colors otherwise.
    // Heteroatoms are a shade darker, so the chemistry still reads.
    // In the illustration style (outlineMode "molecules") colors stay flat, and
    // ligands get one accent color.
    var scheme = view.atomColor || "element";
    var colors = scheme !== "element" && residues ? schemeColors(residues, scheme, view) : null;
    var flat = view.outlineMode === "molecules";
    for (var j = 0; j < s.atoms.length; j++) {
        var b = s.atoms[j];
        var c = colors && b.polymer && b.residue ? colors.get(b.residue) : undefined;
        if (c) {
            var k = flat || b.symbol === "C" || b.symbol === "H" ? 1.0 : 0.82;
            b.schemeColor = [c[0] * k, c[1] * k, c[2] * k];
        } else if (colors && flat && b.name !== undefined && !b.polymer && !(b.resName in WATER)) {
            b.schemeColor = LIGAND_ACCENT;
        } else if (b.schemeColor) {
            delete b.schemeColor;
        }
    }
};


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Colors.

function parseHex(c) {
    var m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

function rainbow(t) {
    t = Math.min(1, Math.max(0, t)) * (RAINBOW.length - 1);
    var i = Math.min(RAINBOW.length - 2, Math.floor(t));
    return mix3(RAINBOW[i], RAINBOW[i + 1], t - i);
}

function plddt(value) {
    return value > 90 ? PLDDT_COLORS[0] : value > 70 ? PLDDT_COLORS[1] :
           value > 50 ? PLDDT_COLORS[2] : PLDDT_COLORS[3];
}

// Sets r.color on every polymer residue for the given scheme:
// 'ss', 'chain', 'rainbow', 'plddt' or a '#rrggbb' color.
// Chain / entity palettes (view.palette). "viridis" and "grays" are
// gradients spread over all chains; the others cycle.
var PALETTES = {
    default: CHAIN_COLORS,
    // Soft illustration colors (after David Goodsell's paintings).
    goodsell: [[0.97, 0.66, 0.57], [0.63, 0.64, 0.95], [0.98, 0.85, 0.55], [0.67, 0.86, 0.66],
               [0.84, 0.72, 0.93], [0.98, 0.74, 0.82], [0.62, 0.87, 0.86], [0.93, 0.80, 0.66],
               [0.78, 0.84, 0.62], [0.88, 0.66, 0.73]],
    pastel: [[0.68, 0.78, 0.93], [0.99, 0.80, 0.64], [0.72, 0.89, 0.72], [0.98, 0.71, 0.73],
             [0.82, 0.76, 0.93], [0.99, 0.93, 0.66], [0.66, 0.89, 0.91], [0.93, 0.74, 0.90],
             [0.82, 0.88, 0.70], [0.84, 0.84, 0.86]],
    // Okabe-Ito, distinguishable with color vision deficiencies.
    colorblind: [[0.00, 0.45, 0.70], [0.90, 0.62, 0.00], [0.00, 0.62, 0.45], [0.80, 0.47, 0.65],
                 [0.34, 0.71, 0.91], [0.84, 0.37, 0.00], [0.94, 0.89, 0.26], [0.60, 0.60, 0.60]],
    viridis: "gradient",
    grays: "gradient"
};
// Ligands in the illustration style.
var LIGAND_ACCENT = [0.30, 0.80, 0.30];

var VIRIDIS = [[0.267, 0.005, 0.329], [0.283, 0.141, 0.458], [0.254, 0.265, 0.530], [0.207, 0.372, 0.553],
               [0.164, 0.471, 0.558], [0.128, 0.567, 0.551], [0.135, 0.659, 0.518], [0.267, 0.749, 0.441],
               [0.478, 0.821, 0.318], [0.741, 0.873, 0.150], [0.993, 0.906, 0.144]];
module.exports.PALETTES = Object.keys(PALETTES);

// Color k of n in a palette.
function paletteColor(name, k, n) {
    var p = PALETTES[name] || CHAIN_COLORS;
    var t = n > 1 ? k / (n - 1) : 0.5;
    if (name === "viridis") {
        var x = t * (VIRIDIS.length - 1), i = Math.min(VIRIDIS.length - 2, Math.floor(x));
        return mix3(VIRIDIS[i], VIRIDIS[i + 1], x - i);
    }
    if (name === "grays") {
        var g = 0.35 + 0.55 * t;
        return [g, g, g];
    }
    return p[k % p.length];
}

// Color of every polymer residue for a scheme: "ss", "chain", "entity"
// (molecule type, so every copy of a protein matches), "type" (protein /
// nucleic acid), "rainbow", "plddt" or a color. Returns a Map residue -> color.
var schemeColors = module.exports.schemeColors = function(residues, scheme, view) {
    scheme = scheme || "ss";
    var ssColors = view.cartoonColors || SS_COLORS;
    var palette = view.palette || "default";
    var uniform = Array.isArray(scheme) ? scheme : parseHex(scheme);
    var chainIndex = {}, chainCount = {}, chainSeen = {}, nChains = 0;
    var entityIndex = {}, nEntities = 0;
    for (var i = 0; i < residues.polymer.length; i++) {
        var r = residues.polymer[i];
        var c = r.chain;
        if (!(c in chainIndex)) {
            chainIndex[c] = nChains++;
            chainCount[c] = 0;
            chainSeen[c] = 0;
        }
        chainCount[c]++;
        var e = r.entity || "chain " + c;
        if (!(e in entityIndex)) entityIndex[e] = nEntities++;
    }
    var out = new Map();
    for (var i = 0; i < residues.polymer.length; i++) {
        var r = residues.polymer[i], color;
        if (uniform) {
            color = uniform;
        } else if (scheme === "chain") {
            color = paletteColor(palette, chainIndex[r.chain], nChains);
        } else if (scheme === "entity") {
            color = paletteColor(palette, entityIndex[r.entity || "chain " + r.chain], nEntities);
        } else if (scheme === "type") {
            // Nucleic acids take the first color (warm in the Goodsell palette), proteins the second.
            color = paletteColor(palette, r.type === "nucleic" ? 0 : 1, 2);
        } else if (scheme === "rainbow") {
            color = rainbow(chainSeen[r.chain]++ / Math.max(1, chainCount[r.chain] - 1));
        } else if (scheme === "plddt") {
            color = plddt(r.trace.bfactor);
        } else {
            color = r.ss === "H" ? ssColors.helix : r.ss === "E" ? ssColors.sheet : ssColors.coil;
        }
        out.set(r, color);
    }
    return out;
};

var residueColors = module.exports.residueColors = function(residues, scheme, view) {
    var colors = schemeColors(residues, scheme, view);
    for (var i = 0; i < residues.polymer.length; i++) {
        var r = residues.polymer[i];
        r.color = colors.get(r);
        r.baseColor = r.color;
        r.color = Select.adjustColor(r.color, r.highlight, view);
    }
};

// Color of a single atom for surface coloring. Residue-based schemes fall back
// to the element color for atoms outside the polymer (ligands, XYZ input).
module.exports.atomColor = function(a, scheme, view) {
    var uniform = Array.isArray(scheme) ? scheme : parseHex(scheme);
    var c;
    if (uniform) {
        c = uniform;
    } else if (scheme === "plddt" && !isNaN(a.bfactor)) {
        c = plddt(a.bfactor);
    } else if (scheme !== "element" && a.polymer && a.residue.baseColor) {
        c = a.residue.baseColor;
    } else {
        c = view.elements[a.symbol].color;
    }
    return Select.adjustColor(c, a.highlight, view);
};


//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
// Geometry.

function profileFor(r, view) {
    var tube = view.cartoonTubeRadius;
    var thick = view.cartoonThickness / 2;
    if (r.ss === "H") {
        return {a: view.cartoonHelixWidth / 2, b: thick, n: 2};
    } else if (r.ss === "E") {
        return {a: view.cartoonSheetWidth / 2, b: thick, n: 6};
    }
    return {a: tube, b: tube, n: 2};
}

// Uniform Catmull-Rom point and derivative.
function catmullRom(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    var out = [], der = [];
    for (var k = 0; k < 3; k++) {
        var a = -p0[k] + p2[k];
        var b = 2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k];
        var c = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k];
        out.push(0.5 * (2 * p1[k] + a * t + b * t2 + c * t3));
        der.push(0.5 * (a + 2 * b * t + 3 * c * t2));
    }
    return {p: out, d: der};
}

// Build the rings (cross-section frames) along one segment.
function segmentRings(seg, view, samples) {
    var m = seg.length;
    var P = [];
    for (var i = 0; i < m; i++) {
        P.push(pos(seg[i].trace));
    }
    // Flatten the pleat of strands.
    var Q = P.slice();
    for (var i = 1; i < m - 1; i++) {
        if (seg[i].ss === "E" && seg[i - 1].ss === "E" && seg[i + 1].ss === "E") {
            Q[i] = scale(add(add(P[i - 1], scale(P[i], 2)), P[i + 1]), 0.25);
        }
    }
    P = Q;

    // Guide vectors from the peptide plane (protein) or none (nucleic).
    var sides = null;
    if (seg[0].type === "protein") {
        sides = [];
        for (var i = 0; i < m; i++) {
            var r = seg[i];
            var o = r.atoms.O ? pos(r.atoms.O) : null;
            var along = i < m - 1 ? sub(P[i + 1], P[i]) : sub(P[i], P[i - 1]);
            var side;
            if (o !== null) {
                var c = cross(along, sub(o, pos(r.trace)));
                side = normalize(cross(c, along));
            }
            if (!side || len(side) === 0) {
                side = i > 0 ? sides[i - 1] : anyPerpendicular(normalize(along));
            }
            if (i > 0 && dot(side, sides[i - 1]) < 0) {
                side = scale(side, -1);
            }
            sides.push(side);
        }
    }

    var ext0 = sub(scale(P[0], 2), P[1]);
    var extN = sub(scale(P[m - 1], 2), P[m - 2]);
    function ctrl(i) {
        return i < 0 ? ext0 : i >= m ? extN : P[i];
    }

    var profiles = seg.map(function(r) { return profileFor(r, view); });
    var tubeProfile = {a: view.cartoonTubeRadius, b: view.cartoonTubeRadius, n: 2};

    var rings = [];
    var lastSide = null;
    for (var i = 0; i < m - 1; i++) {
        var arrow = seg[i].ss === "E" && seg[i + 1].ss !== "E";
        var last = i === m - 2;
        var steps = last ? samples + 1 : samples;
        for (var j = 0; j < steps; j++) {
            var t = j / samples;
            var cr = catmullRom(ctrl(i - 1), ctrl(i), ctrl(i + 1), ctrl(i + 2), t);
            var T = normalize(cr.d);
            var S;
            if (sides) {
                S = mix3(sides[i], sides[i + 1], t);
            } else {
                S = lastSide || anyPerpendicular(T);
            }
            S = normalize(sub(S, scale(T, dot(S, T))));
            if (len(S) === 0) {
                S = anyPerpendicular(T);
            }
            lastSide = S;
            var U = cross(T, S);

            var pa, pb, pn, owner;
            if (arrow) {
                var end = seg[i + 1].ss === "H" ? profiles[i + 1] : tubeProfile;
                var head = {a: profiles[i].a * ARROW_SCALE, b: profiles[i].b, n: profiles[i].n};
                pa = mix(head.a, end.a, t);
                pb = mix(head.b, end.b, t);
                pn = profiles[i].n;
                owner = seg[i];
                if (j === 0) {
                    // Back face of the arrow head: a ring at strand width
                    // followed by a cap up to the arrow width.
                    rings.push({p: cr.p, T: T, S: S, U: U, a: profiles[i].a, b: profiles[i].b,
                                n: pn, color: owner.color});
                    rings.push({p: cr.p, T: T, S: S, U: U, a: pa, b: pb, n: pn,
                                color: owner.color, step: true});
                    continue;
                }
            } else {
                var u = smoothstep(t);
                var from = profiles[i];
                if (i > 0 && seg[i - 1].ss === "E" && seg[i].ss !== "E") {
                    // Previous span ended in an arrow tip.
                    from = seg[i].ss === "H" ? profiles[i] : tubeProfile;
                }
                pa = mix(from.a, profiles[i + 1].a, u);
                pb = mix(from.b, profiles[i + 1].b, u);
                pn = mix(from.n, profiles[i + 1].n, u);
                owner = t < 0.5 ? seg[i] : seg[i + 1];
            }
            rings.push({p: cr.p, T: T, S: S, U: U, a: pa, b: pb, n: pn, color: owner.color});
        }
    }
    return rings;
}

function ringVertices(ring, M) {
    var verts = [];
    for (var q = 0; q < M; q++) {
        var th = 2 * Math.PI * q / M;
        var c = Math.cos(th), s = Math.sin(th);
        var e = 2 / ring.n;
        var x = ring.a * Math.sign(c) * Math.pow(Math.abs(c), e);
        var y = ring.b * Math.sign(s) * Math.pow(Math.abs(s), e);
        var g = 2 - e;
        var nx = Math.sign(c) * Math.pow(Math.abs(c), g) / ring.a;
        var ny = Math.sign(s) * Math.pow(Math.abs(s), g) / ring.b;
        verts.push({
            p: add(ring.p, add(scale(ring.S, x), scale(ring.U, y))),
            n: normalize(add(scale(ring.S, nx), scale(ring.U, ny)))
        });
    }
    return verts;
}

var MAX_CARTOON_VERTICES = 6.5e6;  // keeps every gallery structure (up to GroEL) at full quality

module.exports.buildMesh = function(s, view) {
    var residues = getResidues(s);
    residueColors(residues, view.cartoonColor, view);
    var quality = Math.max(2, Math.round(view.cartoonQuality || 8));
    // About 12 quality^2 vertices per residue: huge structures (ribosomes,
    // capsids) get a coarser tube so the mesh stays near MAX_CARTOON_VERTICES
    // (GPU memory, and time per ambient-occlusion sample).
    var count = 0;
    for (var c = 0; c < residues.segments.length; c++) {
        if (residues.segments[c].length >= 2) count += residues.segments[c].length;
    }
    if (count > 0) {
        quality = Math.max(3, Math.min(quality, Math.floor(Math.sqrt(MAX_CARTOON_VERTICES / (12 * count)))));
    }
    var samples = quality;
    var M = 2 * quality;

    // Growable typed arrays (plain arrays of millions of numbers take far more
    // memory). Vertices are stored once and triangles index them: a ring's
    // vertices are shared by the tube sections on both sides.
    var size = 1 << 16, used = 0;
    var position = new Float32Array(size), normal = new Float32Array(size), color = new Float32Array(size);
    var isize = 1 << 16, iused = 0;
    var index = new Uint32Array(isize);
    function grow() {
        size *= 2;
        var p = new Float32Array(size), n = new Float32Array(size), k = new Float32Array(size);
        p.set(position); n.set(normal); k.set(color);
        position = p; normal = n; color = k;
    }
    // Adds a vertex and returns its index.
    function vertex(p, n, c) {
        if (used + 3 > size) grow();
        position[used] = p[0]; position[used + 1] = p[1]; position[used + 2] = p[2];
        normal[used] = n[0]; normal[used + 1] = n[1]; normal[used + 2] = n[2];
        color[used] = c[0]; color[used + 1] = c[1]; color[used + 2] = c[2];
        used += 3;
        return used / 3 - 1;
    }
    function tri(a, b, c) {
        if (iused + 3 > isize) {
            isize *= 2;
            var grown = new Uint32Array(isize);
            grown.set(index);
            index = grown;
        }
        index[iused] = a; index[iused + 1] = b; index[iused + 2] = c;
        iused += 3;
    }
    // The ring's vertices with the ring's normals and color.
    function ringIndices(verts, c) {
        var out = new Array(M);
        for (var q = 0; q < M; q++) out[q] = vertex(verts[q].p, verts[q].n, c);
        return out;
    }
    // Flat vertices (a cap or a step face) with normal n.
    function flatIndices(verts, n, c) {
        var out = new Array(M);
        for (var q = 0; q < M; q++) out[q] = vertex(verts[q].p, n, c);
        return out;
    }
    function cap(ring, verts, n) {
        var center = vertex(ring.p, n, ring.color);
        var edge = flatIndices(verts, n, ring.color);
        for (var q = 0; q < M; q++) tri(center, edge[q], edge[(q + 1) % M]);
    }

    for (var si = 0; si < residues.segments.length; si++) {
        var seg = residues.segments[si];
        if (seg.length < 2) {
            continue;
        }
        var rings = segmentRings(seg, view, samples);
        var prev = null, prevRing = null, prevIdx = null;
        for (var k = 0; k < rings.length; k++) {
            var ring = rings[k];
            var verts = ringVertices(ring, M);
            var idx = null;
            if (prev === null) {
                cap(ring, verts, scale(ring.T, -1));
            } else if (ring.step) {
                // A flat face between the two rings (e.g. an arrowhead's back).
                var n = scale(ring.T, -1);
                var a = flatIndices(prev, n, ring.color), b = flatIndices(verts, n, ring.color);
                for (var q = 0; q < M; q++) {
                    var q1 = (q + 1) % M;
                    tri(a[q], a[q1], b[q1]);
                    tri(a[q], b[q1], b[q]);
                }
            } else {
                // Smooth tube: the previous ring's own vertices are reused.
                var pa = prevIdx || ringIndices(prev, prevRing.color);
                idx = ringIndices(verts, ring.color);
                for (var q2 = 0; q2 < M; q2++) {
                    var q3 = (q2 + 1) % M;
                    tri(pa[q2], pa[q3], idx[q3]);
                    tri(pa[q2], idx[q3], idx[q2]);
                }
            }
            prev = verts;
            prevRing = ring;
            prevIdx = idx;
        }
        cap(prevRing, prev, prevRing.T);
    }

    return {
        position: position.subarray(0, used),
        normal: normal.subarray(0, used),
        color: color.subarray(0, used),
        index: index.subarray(0, iused),
        count: iused
    };
};
