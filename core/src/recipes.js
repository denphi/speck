"use strict";

// Ready-made films: one name gives a complete, good-looking video, fitted
// to the structure (its main ligand, its trajectory). Used by the viewer's
// video menu, save_video("movie.mp4", "tour") in Python and the demo site.
//
// info: {ligand: selection or null (the largest ligand), frames: number of
// trajectory frames}; options: {seconds, target (a selection instead of the
// ligand)}.

var RECIPES = [
    {name: "spin", label: "Spin", seconds: 8, needs: null,
     description: "One full turn; loops seamlessly"},
    {name: "rock", label: "Rock", seconds: 6, needs: null,
     description: "A gentle swing back and forth; loops seamlessly"},
    {name: "orbit", label: "Orbit", seconds: 10, needs: null,
     description: "A full turn around a tilted axis, showing top and bottom"},
    {name: "tour", label: "Ligand tour", seconds: 12, needs: "target",
     description: "Turns, flies in to the ligand, looks around it and returns"},
    {name: "focus", label: "Focus on the ligand", seconds: 8, needs: "target",
     description: "Moves close to the ligand and pulls the focus onto it (macro look)"},
    {name: "reveal", label: "Cut open", seconds: 8, needs: null,
     description: "Slices the structure open while it turns, to show the inside"},
    {name: "trajectory", label: "Play trajectory", seconds: 8, needs: "frames",
     description: "Plays the frames smoothly while swinging gently"},
    // A scripted story rather than a move that suits any structure: kept for
    // Python (save_video(..., "showcase")) but not offered in menus.
    {name: "showcase", label: "Showcase", seconds: 16, needs: null, menu: false,
     description: "Half a turn, then the ligand up close (or the inside), and back"}
];

function find(name) {
    for (var i = 0; i < RECIPES.length; i++) {
        if (RECIPES[i].name === name) return RECIPES[i];
    }
    return null;
}

var NAMES = RECIPES.map(function(r) { return "'" + r.name + "'"; }).join(", ");

// Whether a recipe can be made for a structure.
function available(recipe, info) {
    if (recipe.needs === "target") return !!info.ligand;
    if (recipe.needs === "frames") return info.frames > 1;
    return true;
}

// The shots of a recipe (throws a readable error when it cannot be made).
function build(name, info, options) {
    options = options || {};
    var recipe = find(name);
    if (!recipe) throw new Error("unknown video '" + name + "'; choose one of " + NAMES);
    var S = options.seconds ? +options.seconds : recipe.seconds;
    if (!(S > 0)) throw new Error("seconds must be a positive number");
    var target = options.target && Object.keys(options.target).length ? options.target : info.ligand;
    if (recipe.needs === "target" && !target) {
        throw new Error("'" + name + "' moves to a ligand, but this structure has none. Give a target " +
                        "(e.g. target={'chain': 'A'}) or choose 'spin', 'rock', 'orbit' or 'reveal'.");
    }
    if (recipe.needs === "frames" && !(info.frames > 1)) {
        throw new Error("'trajectory' plays frames, but this structure has only one. Load a trajectory " +
                        "(several models or frames) or choose another video.");
    }
    switch (name) {
    case "spin":
        return [{type: "turntable", seconds: S}];
    case "rock":
        return [{type: "rock", seconds: S, degrees: 25}];
    case "orbit":
        return [{type: "orbit", seconds: S, degrees: 360, tilt: 25}];
    case "tour":
        return [{type: "orbit", seconds: 0.25 * S, degrees: 90, ease: "smooth"},
                {type: "fly_to", selection: target, seconds: 0.2 * S, face: true},
                {type: "rock", seconds: 0.3 * S, degrees: 15},
                {type: "home", seconds: 0.25 * S}];
    case "focus":
        return [{type: "fly_to", selection: target, seconds: 0.3 * S, face: true},
                {type: "together", shots: [{type: "rock", seconds: 0.7 * S, degrees: 10},
                                           {type: "rack_focus", to: target, seconds: 0.35 * S, strength: 0.7}]}];
    case "reveal":
        return [{type: "together", shots: [{type: "orbit", seconds: S, degrees: 120, tilt: 15},
                                           {type: "cut_open", seconds: 0.45 * S, to: 0.5}]}];
    case "trajectory":
        return [{type: "together", shots: [{type: "trajectory", seconds: S},
                                           {type: "rock", seconds: S, degrees: 10}]}];
    case "showcase":
        if (target) {
            return [{type: "orbit", seconds: 0.3 * S, degrees: 180, tilt: 15},
                    {type: "fly_to", selection: target, seconds: 0.2 * S, face: true},
                    {type: "together", shots: [{type: "rock", seconds: 0.2 * S, degrees: 12},
                                               {type: "rack_focus", to: target, seconds: 0.12 * S, strength: 0.7}]},
                    {type: "together", shots: [{type: "home", seconds: 0.3 * S},
                                               {type: "fade", settings: {dofStrength: 0}, seconds: 0.3 * S}]}];
        }
        return [{type: "orbit", seconds: 0.35 * S, degrees: 180, tilt: 15},
                {type: "together", shots: [{type: "turntable", seconds: 0.4 * S, degrees: 90},
                                           {type: "cut_open", seconds: 0.25 * S, to: 0.5}]},
                {type: "cut_open", seconds: 0.25 * S, to: 0}];
    }
    throw new Error("unknown video '" + name + "'");
}

// Shots with a title (and subtitle) shown over the first seconds.
function withTitle(shots, title, subtitle) {
    if (!title) return shots;
    var first = shots[0];
    var span = Math.min(4, first.seconds || 3);
    var t = {type: "title", text: String(title), seconds: span};
    if (subtitle) t.subtitle = String(subtitle);
    return [{type: "together", shots: [first, t]}].concat(shots.slice(1));
}

module.exports.RECIPES = RECIPES;
module.exports.find = find;
module.exports.available = available;
module.exports.build = build;
module.exports.withTitle = withTitle;
