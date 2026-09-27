"use strict";

var elements = require("./elements");

var MIN_ATOM_RADIUS = Infinity;
var MAX_ATOM_RADIUS = -Infinity;
for (var i = 0; i <= 118; i++) {
    MIN_ATOM_RADIUS = Math.min(MIN_ATOM_RADIUS, elements[i].radius);
    MAX_ATOM_RADIUS = Math.max(MAX_ATOM_RADIUS, elements[i].radius);
}

module.exports.MIN_ATOM_RADIUS = MIN_ATOM_RADIUS;
module.exports.MAX_ATOM_RADIUS = MAX_ATOM_RADIUS;

// Atomic numbers of non-metals and metalloids; everything else is a metal.
var NON_METALS = [0, 1, 2, 5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 32, 33, 34, 35, 36, 51, 52, 53, 54, 85, 86];

var isMetal = module.exports.isMetal = function(symbol) {
    var e = elements[symbol];
    return e !== undefined && NON_METALS.indexOf(e.number) < 0;
};
