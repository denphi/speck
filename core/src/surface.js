"use strict";

// Solvent-excluded (molecular) surface.
//
// 1. Voxels inside any atom sphere grown by the probe radius form the
//    solvent-accessible volume.
// 2. A Euclidean distance transform gives each voxel its distance to the
//    solvent; voxels deeper than the probe radius are inside the molecular
//    surface (the probe rolled back inward, as in EDTSurf).
// 3. The zero level of (distance - probe) is meshed with surface nets and
//    colored by the nearest atom.
//
// The mesh goes through the same passes as the cartoon, so it receives the
// same ambient occlusion, outlines and materials.

var Cartoon = require("./cartoon");

// Bondi van der Waals radii (Angstrom).
var VDW = {
    H: 1.10, C: 1.70, N: 1.55, O: 1.52, F: 1.47, P: 1.80, S: 1.80, Cl: 1.75,
    Br: 1.85, I: 1.98, Se: 1.90, Si: 2.10, Na: 2.27, K: 2.75, Mg: 1.73,
    Zn: 1.39, Cu: 1.40, Fe: 1.60, Ca: 1.97, Au: 1.66, Ag: 1.72, Pt: 1.75
};
var DEFAULT_VDW = 1.80;

var WATER = {HOH: 1, WAT: 1, DOD: 1, H2O: 1, TIP: 1, TIP3: 1, SOL: 1};

var MAX_VOXELS = 16e6;
var INF = 1e20;


function surfaceAtoms(s, view) {
    Cartoon.getResidues(s);
    var mode = view.surfaceAtoms || "polymer";
    var out = [];
    for (var i = 0; i < s.atoms.length; i++) {
        var a = s.atoms[i];
        var fromPDB = a.name !== undefined;
        if (fromPDB) {
            // Structure files: united-atom surface without hydrogens and waters.
            if (a.symbol === "H" || a.resName in WATER) continue;
            if (mode !== "all" && !a.polymer) continue;
        }
        out.push(a);
    }
    return out;
}


// Squared 1D distance transform (Felzenszwalb & Huttenlocher) in place.
function edt1d(f, offset, stride, n, g, v, z) {
    for (var q = 0; q < n; q++) {
        g[q] = f[offset + q * stride];
    }
    var k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (var q = 1; q < n; q++) {
        var s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
            k--;
            s = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }
    k = 0;
    for (var q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        var d = q - v[k];
        f[offset + q * stride] = d * d + g[v[k]];
    }
}


// Neighbour lists (CSR) from the quad edges.
function buildAdjacency(quads, nverts) {
    var degree = new Int32Array(nverts + 1);
    for (var q = 0; q < quads.length; q += 4) {
        for (var e = 0; e < 4; e++) {
            degree[quads[q + e] + 1]++;
            degree[quads[q + (e + 1) % 4] + 1]++;
        }
    }
    for (var i = 0; i < nverts; i++) {
        degree[i + 1] += degree[i];
    }
    var fill = degree.slice(0, nverts);
    var list = new Int32Array(degree[nverts]);
    for (var q = 0; q < quads.length; q += 4) {
        for (var e = 0; e < 4; e++) {
            var a = quads[q + e], b = quads[q + (e + 1) % 4];
            list[fill[a]++] = b;
            list[fill[b]++] = a;
        }
    }
    // Each edge is shared by two quads; duplicates only weight the average.
    return {start: degree, list: list};
}

// One Laplacian step: move each value a fraction toward its neighbours' mean.
function smooth(values, adjacency, width, lambda) {
    var out = new Float32Array(values.length);
    var n = values.length / width;
    for (var i = 0; i < n; i++) {
        var s0 = adjacency.start[i], s1 = adjacency.start[i + 1];
        for (var c = 0; c < width; c++) {
            var v = values[width * i + c];
            if (s1 > s0) {
                var sum = 0;
                for (var m = s0; m < s1; m++) {
                    sum += values[width * adjacency.list[m] + c];
                }
                v += lambda * (sum / (s1 - s0) - v);
            }
            out[width * i + c] = v;
        }
    }
    return out;
}


function buildGeometry(atoms, probe, resolution) {
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    var radii = new Float32Array(atoms.length);
    var maxR = 0;
    for (var i = 0; i < atoms.length; i++) {
        var a = atoms[i];
        radii[i] = VDW[a.symbol] || DEFAULT_VDW;
        maxR = Math.max(maxR, radii[i]);
        minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
        minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
        minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
    }

    var h = resolution;
    var pad = maxR + probe + 3 * h;
    var nx, ny, nz;
    for (;;) {
        pad = maxR + probe + 3 * h;
        nx = Math.ceil((maxX - minX + 2 * pad) / h) + 1;
        ny = Math.ceil((maxY - minY + 2 * pad) / h) + 1;
        nz = Math.ceil((maxZ - minZ + 2 * pad) / h) + 1;
        if (nx * ny * nz <= MAX_VOXELS) break;
        h *= 1.1;
    }
    var ox = minX - pad, oy = minY - pad, oz = minZ - pad;
    var nxy = nx * ny;
    var N = nxy * nz;

    // 1. Solvent-accessible volume: 0 outside (solvent), INF inside.
    var f = new Float32Array(N);
    for (var i = 0; i < atoms.length; i++) {
        var a = atoms[i];
        var R = radii[i] + probe;
        var R2 = R * R;
        var i0 = Math.max(0, Math.floor((a.x - R - ox) / h)), i1 = Math.min(nx - 1, Math.ceil((a.x + R - ox) / h));
        var j0 = Math.max(0, Math.floor((a.y - R - oy) / h)), j1 = Math.min(ny - 1, Math.ceil((a.y + R - oy) / h));
        var k0 = Math.max(0, Math.floor((a.z - R - oz) / h)), k1 = Math.min(nz - 1, Math.ceil((a.z + R - oz) / h));
        for (var k = k0; k <= k1; k++) {
            var dz = oz + k * h - a.z;
            for (var j = j0; j <= j1; j++) {
                var dy = oy + j * h - a.y;
                var dyz = dy * dy + dz * dz;
                if (dyz > R2) continue;
                var base = j * nx + k * nxy;
                for (var ii = i0; ii <= i1; ii++) {
                    var dx = ox + ii * h - a.x;
                    if (dx * dx + dyz <= R2) f[base + ii] = INF;
                }
            }
        }
    }

    // 2. Squared distance to the solvent, separably along x, y and z.
    var nmax = Math.max(nx, ny, nz);
    var g = new Float64Array(nmax), z = new Float64Array(nmax + 1), v = new Int32Array(nmax);
    for (var k = 0; k < nz; k++)
        for (var j = 0; j < ny; j++)
            edt1d(f, j * nx + k * nxy, 1, nx, g, v, z);
    for (var k = 0; k < nz; k++)
        for (var i = 0; i < nx; i++)
            edt1d(f, i + k * nxy, nx, ny, g, v, z);
    for (var j = 0; j < ny; j++)
        for (var i = 0; i < nx; i++)
            edt1d(f, i + j * nx, nxy, nz, g, v, z);

    // Field: positive inside the molecular surface. Seeds are voxel centres
    // just outside the accessible volume, so shift by half a voxel.
    for (var n = 0; n < N; n++) {
        f[n] = Math.sqrt(f[n]) * h - 0.5 * h - probe;
    }

    // Light separable [1 2 1] smoothing removes voxel steps.
    var tmp = new Float32Array(N);
    var strides = [1, nx, nxy], dims = [nx, ny, nz];
    for (var axis = 0; axis < 3; axis++) {
        var st = strides[axis];
        for (var n = 0; n < N; n++) {
            var c = axis === 0 ? n % nx : axis === 1 ? Math.floor(n / nx) % ny : Math.floor(n / nxy);
            var lo = c > 0 ? f[n - st] : f[n];
            var hi = c < dims[axis] - 1 ? f[n + st] : f[n];
            tmp[n] = 0.25 * lo + 0.5 * f[n] + 0.25 * hi;
        }
        var swap = f; f = tmp; tmp = swap;
    }
    tmp = null;

    // 3. Surface nets: one vertex per cube crossing the zero level.
    var cx = nx - 1, cy = ny - 1, cz = nz - 1;
    var cubeVertex = new Int32Array(cx * cy * cz).fill(-1);
    var vp = [], vn = [];
    var corner = new Float32Array(8);
    var EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (var k = 0; k < cz; k++) {
        for (var j = 0; j < cy; j++) {
            for (var i = 0; i < cx; i++) {
                var n0 = i + j * nx + k * nxy;
                var mask = 0;
                for (var c = 0; c < 8; c++) {
                    var val = f[n0 + (c & 1) + ((c >> 1) & 1) * nx + ((c >> 2) & 1) * nxy];
                    corner[c] = val;
                    if (val > 0) mask |= 1 << c;
                }
                if (mask === 0 || mask === 255) continue;
                var px = 0, py = 0, pz = 0, count = 0;
                for (var e = 0; e < 12; e++) {
                    var e0 = EDGES[e][0], e1 = EDGES[e][1];
                    var a0 = corner[e0], a1 = corner[e1];
                    if ((a0 > 0) === (a1 > 0)) continue;
                    var t = a0 / (a0 - a1);
                    px += (e0 & 1) + t * ((e1 & 1) - (e0 & 1));
                    py += ((e0 >> 1) & 1) + t * (((e1 >> 1) & 1) - ((e0 >> 1) & 1));
                    pz += ((e0 >> 2) & 1) + t * (((e1 >> 2) & 1) - ((e0 >> 2) & 1));
                    count++;
                }
                var gx = (corner[1] - corner[0]) + (corner[3] - corner[2]) + (corner[5] - corner[4]) + (corner[7] - corner[6]);
                var gy = (corner[2] - corner[0]) + (corner[3] - corner[1]) + (corner[6] - corner[4]) + (corner[7] - corner[5]);
                var gz = (corner[4] - corner[0]) + (corner[5] - corner[1]) + (corner[6] - corner[2]) + (corner[7] - corner[3]);
                var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
                cubeVertex[i + j * cx + k * cx * cy] = vp.length / 3;
                vp.push(ox + (i + px / count) * h, oy + (j + py / count) * h, oz + (k + pz / count) * h);
                // The field grows inward, so the outward normal is -gradient.
                vn.push(-gx / gl, -gy / gl, -gz / gl);
            }
        }
    }

    // Quads around every grid edge that crosses the surface.
    var quads = [];
    function cube(i, j, k) {
        return cubeVertex[i + j * cx + k * cx * cy];
    }
    for (var k = 1; k < cz; k++) {
        for (var j = 1; j < cy; j++) {
            for (var i = 1; i < cx; i++) {
                var n0 = i + j * nx + k * nxy;
                var inside = f[n0] > 0;
                if (inside !== (f[n0 + 1] > 0)) {
                    quads.push(cube(i, j - 1, k - 1), cube(i, j, k - 1), cube(i, j, k), cube(i, j - 1, k));
                }
                if (inside !== (f[n0 + nx] > 0)) {
                    quads.push(cube(i - 1, j, k - 1), cube(i, j, k - 1), cube(i, j, k), cube(i - 1, j, k));
                }
                if (inside !== (f[n0 + nxy] > 0)) {
                    quads.push(cube(i - 1, j - 1, k), cube(i, j - 1, k), cube(i, j, k), cube(i - 1, j, k));
                }
            }
        }
    }

    // Laplacian smoothing over the quad mesh removes the voxel texture.
    var nverts = vp.length / 3;
    var adjacency = buildAdjacency(quads, nverts);
    for (var it = 0; it < 2; it++) {
        vp = smooth(vp, adjacency, 3, 0.5);
    }

    // Nearest atom (by distance to its vdW sphere) for coloring.
    var cell = 4.0;
    var hash = {};
    for (var i = 0; i < atoms.length; i++) {
        var a = atoms[i];
        var key = Math.floor(a.x / cell) + "," + Math.floor(a.y / cell) + "," + Math.floor(a.z / cell);
        (hash[key] = hash[key] || []).push(i);
    }
    var nearest = new Int32Array(nverts);
    for (var q = 0; q < nverts; q++) {
        var x = vp[3 * q], y = vp[3 * q + 1], zz = vp[3 * q + 2];
        var hx = Math.floor(x / cell), hy = Math.floor(y / cell), hz = Math.floor(zz / cell);
        var best = -1, bestD = Infinity;
        for (var dx = -1; dx <= 1; dx++)
        for (var dy = -1; dy <= 1; dy++)
        for (var dz = -1; dz <= 1; dz++) {
            var list = hash[(hx + dx) + "," + (hy + dy) + "," + (hz + dz)];
            if (!list) continue;
            for (var m = 0; m < list.length; m++) {
                var a = atoms[list[m]];
                var ddx = a.x - x, ddy = a.y - y, ddz = a.z - zz;
                var d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) - radii[list[m]];
                if (d < bestD) {
                    bestD = d;
                    best = list[m];
                }
            }
        }
        nearest[q] = best;
    }

    return {
        vertices: new Float32Array(vp),
        normals: new Float32Array(vn),
        quads: new Int32Array(quads),
        adjacency: adjacency,
        nearest: nearest,
        atoms: atoms,
        spacing: h
    };
}


module.exports.buildMesh = function(s, view) {
    var probe = view.surfaceProbe;
    var resolution = Math.max(0.2, view.surfaceResolution);
    var atoms = surfaceAtoms(s, view);
    var key = [probe, resolution, view.surfaceAtoms, atoms.length, s.version || 0].join("|");
    if (s._surface === undefined || s._surface.key !== key) {
        s._surface = atoms.length > 0 ? buildGeometry(atoms, probe, resolution) : null;
        if (s._surface) s._surface.key = key;
    }
    var geo = s._surface;
    if (!geo) {
        return {position: new Float32Array(0), normal: new Float32Array(0), color: new Float32Array(0), count: 0};
    }

    var residues = Cartoon.getResidues(s);
    var scheme = view.surfaceColor || "element";
    Cartoon.residueColors(residues, scheme, view);
    var nverts = geo.vertices.length / 3;
    var vc = new Float32Array(nverts * 3);
    for (var q = 0; q < nverts; q++) {
        var c = geo.nearest[q] >= 0 ? Cartoon.atomColor(geo.atoms[geo.nearest[q]], scheme, view) : [1, 1, 1];
        vc[3 * q] = c[0];
        vc[3 * q + 1] = c[1];
        vc[3 * q + 2] = c[2];
    }
    // Soften the boundaries between atoms.
    vc = smooth(vc, geo.adjacency, 3, 0.5);

    // Expand the quads to plain triangles for the renderer.
    var nq = geo.quads.length / 4;
    var position = new Float32Array(nq * 18);
    var normal = new Float32Array(nq * 18);
    var color = new Float32Array(nq * 18);
    var ORDER = [0, 1, 2, 0, 2, 3];
    var o = 0;
    for (var qd = 0; qd < nq; qd++) {
        for (var t = 0; t < 6; t++) {
            var vi = geo.quads[4 * qd + ORDER[t]];
            for (var c = 0; c < 3; c++) {
                position[o + c] = geo.vertices[3 * vi + c];
                normal[o + c] = geo.normals[3 * vi + c];
                color[o + c] = vc[3 * vi + c];
            }
            o += 3;
        }
    }
    return {position: position, normal: normal, color: color, count: nq * 6};
};
