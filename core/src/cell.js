"use strict";

// Unit cell box: twelve tubes along the cell edges, drawn through the mesh
// pipeline (so they get ambient occlusion like everything else).

var System = require("./system");
var parseColor = require("./select").parseColor;

var SIDES = 10;

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a) {
    var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
}

module.exports.buildMesh = function(s, view) {
    var corners = System.cellCorners(s);
    var position = [], normal = [], color = [];
    if (corners.length === 0 || !view.unitCell) {
        return {position: new Float32Array(0), normal: new Float32Array(0), color: new Float32Array(0), count: 0};
    }
    var c = parseColor(view.cellColor, [0.4, 0.4, 0.4]);
    var r = view.cellRadius;
    for (var n = 0; n < 8; n++) {
        for (var bit = 1; bit < 8; bit <<= 1) {
            if (n & bit) continue;
            var a = corners[n], b = corners[n | bit];
            var t = normalize(sub(b, a));
            // Extend by the radius so tubes overlap at the corners.
            var p0 = [a[0] - t[0] * r, a[1] - t[1] * r, a[2] - t[2] * r];
            var p1 = [b[0] + t[0] * r, b[1] + t[1] * r, b[2] + t[2] * r];
            var u = normalize(cross(t, Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
            var w = cross(t, u);
            for (var q = 0; q < SIDES; q++) {
                var a0 = 2 * Math.PI * q / SIDES, a1 = 2 * Math.PI * (q + 1) / SIDES;
                var n0 = [u[0] * Math.cos(a0) + w[0] * Math.sin(a0), u[1] * Math.cos(a0) + w[1] * Math.sin(a0),
                          u[2] * Math.cos(a0) + w[2] * Math.sin(a0)];
                var n1 = [u[0] * Math.cos(a1) + w[0] * Math.sin(a1), u[1] * Math.cos(a1) + w[1] * Math.sin(a1),
                          u[2] * Math.cos(a1) + w[2] * Math.sin(a1)];
                var quad = [[p0, n0], [p1, n0], [p1, n1], [p0, n0], [p1, n1], [p0, n1]];
                for (var v = 0; v < 6; v++) {
                    var p = quad[v][0], nn = quad[v][1];
                    position.push(p[0] + nn[0] * r, p[1] + nn[1] * r, p[2] + nn[2] * r);
                    normal.push(nn[0], nn[1], nn[2]);
                    color.push(c[0], c[1], c[2]);
                }
            }
        }
    }
    return {
        position: new Float32Array(position),
        normal: new Float32Array(normal),
        color: new Float32Array(color),
        count: position.length / 3
    };
};
