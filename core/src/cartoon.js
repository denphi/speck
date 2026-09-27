"use strict";

// Cartoon (ribbon) representation.
//
// The mesh is plain triangles with per-vertex normals and colors, so it goes
// through the same color / normal / random-rotation depth passes as the atom
// imposters and receives exactly the same ambient occlusion, outlines and DOF.

var WATER = {HOH: 1, WAT: 1, DOD: 1, H2O: 1, TIP: 1, TIP3: 1, SOL: 1};

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
        if (ca && ca.symbol === "C" && r.atoms.C && r.atoms.N) {
            r.type = "protein";
            r.trace = ca;
        } else if (r.atoms.P && r.atoms["C4'"]) {
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
    if (helices.length === 0 && sheets.length === 0) {
        computeSecondaryStructure(residues.segments);
        return;
    }
    function mark(ranges, ss) {
        for (var i = 0; i < ranges.length; i++) {
            var g = ranges[i];
            for (var j = 0; j < residues.polymer.length; j++) {
                var r = residues.polymer[j];
                if (r.chain === g.chain && r.resSeq >= g.start && r.resSeq <= g.end) {
                    r.ss = ss;
                }
            }
        }
    }
    mark(sheets, "E");
    mark(helices, "H");
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

module.exports.applyVisibility = function(s, view) {
    getResidues(s);
    var mode = view.cartoonAtoms;
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        var hidden = false;
        if (a.name !== undefined && view.ligands === false && !a.polymer && !(a.resName in WATER)) {
            // Ligands switched off, in any representation.
            hidden = true;
        } else if ((view.cartoon || view.surface) && a.name !== undefined && mode !== "all") {
            if (a.resName in WATER) {
                hidden = true;
            } else if (a.polymer) {
                hidden = !(mode === "sidechains" && !(a.name in BACKBONE));
            } else {
                hidden = mode === "none";
            }
        }
        a.hidden = hidden;
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
var residueColors = module.exports.residueColors = function(residues, scheme, view) {
    scheme = scheme || "ss";
    var ssColors = view.cartoonColors || SS_COLORS;
    var uniform = Array.isArray(scheme) ? scheme : parseHex(scheme);
    var chainIndex = {};
    var chainCount = {};
    var chainSeen = {};
    var nChains = 0;
    for (var i = 0; i < residues.polymer.length; i++) {
        var c = residues.polymer[i].chain;
        if (!(c in chainIndex)) {
            chainIndex[c] = nChains++;
            chainCount[c] = 0;
            chainSeen[c] = 0;
        }
        chainCount[c]++;
    }
    for (var i = 0; i < residues.polymer.length; i++) {
        var r = residues.polymer[i];
        if (uniform) {
            r.color = uniform;
        } else if (scheme === "chain") {
            r.color = CHAIN_COLORS[chainIndex[r.chain] % CHAIN_COLORS.length];
        } else if (scheme === "rainbow") {
            r.color = rainbow(chainSeen[r.chain]++ / Math.max(1, chainCount[r.chain] - 1));
        } else if (scheme === "plddt") {
            r.color = plddt(r.trace.bfactor);
        } else {
            r.color = r.ss === "H" ? ssColors.helix : r.ss === "E" ? ssColors.sheet : ssColors.coil;
        }
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

module.exports.buildMesh = function(s, view) {
    var residues = getResidues(s);
    residueColors(residues, view.cartoonColor, view);
    var quality = Math.max(2, Math.round(view.cartoonQuality || 8));
    var samples = quality;
    var M = 2 * quality;

    var position = [];
    var normal = [];
    var color = [];
    function vertex(p, n, c) {
        position.push(p[0], p[1], p[2]);
        normal.push(n[0], n[1], n[2]);
        color.push(c[0], c[1], c[2]);
    }
    function cap(ring, verts, n) {
        for (var q = 0; q < M; q++) {
            vertex(ring.p, n, ring.color);
            vertex(verts[q].p, n, ring.color);
            vertex(verts[(q + 1) % M].p, n, ring.color);
        }
    }

    for (var si = 0; si < residues.segments.length; si++) {
        var seg = residues.segments[si];
        if (seg.length < 2) {
            continue;
        }
        var rings = segmentRings(seg, view, samples);
        var prev = null, prevRing = null;
        for (var k = 0; k < rings.length; k++) {
            var ring = rings[k];
            var verts = ringVertices(ring, M);
            if (prev === null) {
                cap(ring, verts, scale(ring.T, -1));
            } else if (ring.step) {
                var n = scale(ring.T, -1);
                for (var q = 0; q < M; q++) {
                    var q1 = (q + 1) % M;
                    vertex(prev[q].p, n, ring.color);
                    vertex(prev[q1].p, n, ring.color);
                    vertex(verts[q1].p, n, ring.color);
                    vertex(prev[q].p, n, ring.color);
                    vertex(verts[q1].p, n, ring.color);
                    vertex(verts[q].p, n, ring.color);
                }
            } else {
                for (var q = 0; q < M; q++) {
                    var q1 = (q + 1) % M;
                    vertex(prev[q].p, prev[q].n, prevRing.color);
                    vertex(prev[q1].p, prev[q1].n, prevRing.color);
                    vertex(verts[q1].p, verts[q1].n, ring.color);
                    vertex(prev[q].p, prev[q].n, prevRing.color);
                    vertex(verts[q1].p, verts[q1].n, ring.color);
                    vertex(verts[q].p, verts[q].n, ring.color);
                }
            }
            prev = verts;
            prevRing = ring;
        }
        cap(prevRing, prev, prevRing.T);
    }

    return {
        position: new Float32Array(position),
        normal: new Float32Array(normal),
        color: new Float32Array(color),
        count: position.length / 3
    };
};
