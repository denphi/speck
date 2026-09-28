"use strict";

var glm = require("./gl-matrix");

// Films: camera moves and setting changes over time, described as a list of
// shots (plain JSON, so Python can build them) and compiled into a timeline
// that gives the scene's state at any time.
//
// A state is {q, target, span, settings, frame, overlays, blend}:
//   q        rotation of the model (quaternion; view.rotation as a matrix)
//   target   model-space point at the center of the picture
//   span     world units across the shorter side of the picture
//   settings view settings that differ from the starting view
//   frame    trajectory frame (fractional between frames) or null
// Framing by target and span, rather than by the view's translation and
// zoom, keeps a move the same at any output size and aspect ratio.
//
// Shots ({type: ..., seconds: ...}):
//   hold        nothing moves
//   turntable   turn about the screen's vertical axis (degrees=360, axis='y' or 'x')
//   rock        swing back and forth and return (degrees=30, cycles=1)
//   orbit       turn about an axis tilted toward the viewer (degrees=360, tilt=20)
//   zoom        move closer (factor=2; below 1 moves away)
//   fly_to      center a selection and fit it (zoom: magnification instead of
//               fitting; face: also turn so the selection faces the viewer)
//   home        back to the camera the film started with
//   rack_focus  depth of field moves to a selection (to), from the current focus
//   cut_open    the cutaway plane moves in (to=0.5, axis)
//   fade        settings change smoothly ({settings: {...}})
//   crossfade   the picture dissolves into the one with new settings
//   trajectory  plays trajectory frames (start=0, end=last), interpolated
//   keyframes   passes through camera / settings keys ({keys: [{time, camera, settings}]})
//   title       text over the picture (text, subtitle, position, size, color)
//   together    runs shots at the same time ({shots: [...]})
// Every shot takes `ease`: linear, smooth (in and out), in, out or sine.

var EASE = {
    linear: function(u) { return u; },
    smooth: function(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
    "in": function(u) { return u * u * u; },
    out: function(u) { return 1 - Math.pow(1 - u, 3); },
    sine: function(u) { return 0.5 - 0.5 * Math.cos(Math.PI * u); }
};

var DEFAULT_EASE = {
    turntable: "linear", orbit: "linear", trajectory: "linear", rock: "linear", hold: "linear",
    title: "linear", keyframes: "linear"
};

var DEFAULT_SECONDS = {
    hold: 1, turntable: 6, rock: 4, orbit: 8, zoom: 2, fly_to: 3, home: 2, rack_focus: 2,
    cut_open: 2, fade: 1.5, crossfade: 1.5, trajectory: 5, title: 3, keyframes: 0, together: 0
};

var TYPES = Object.keys(DEFAULT_SECONDS);

function easing(shot) {
    var name = shot.ease || DEFAULT_EASE[shot.type] || "smooth";
    if (!(name in EASE)) throw new Error("unknown ease '" + name + "' (use " + Object.keys(EASE).join(", ") + ")");
    return EASE[name];
}

function seconds(shot) {
    var s = shot.seconds === undefined || shot.seconds === null ? DEFAULT_SECONDS[shot.type] : +shot.seconds;
    if (!(s >= 0)) throw new Error("shot '" + shot.type + "': seconds must be a number >= 0");
    return s;
}

function cloneState(s) {
    return {
        q: glm.quat.clone(s.q),
        target: s.target.slice(),
        span: s.span,
        settings: Object.assign({}, s.settings),
        frame: s.frame,
        overlays: s.overlays.slice(),
        blend: s.blend
    };
}

function lerp(a, b, u) {
    return a + (b - a) * u;
}

// '#rrggbb' <-> [r, g, b]
function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(c) {
    return "#" + c.map(function(v) {
        var s = Math.round(Math.max(0, Math.min(255, v))).toString(16);
        return s.length < 2 ? "0" + s : s;
    }).join("");
}

var HEX = /^#[0-9a-fA-F]{6}$/;

// A setting between a and b at u (0 - 1): numbers and colors blend; a
// switch turned on happens at the start (so it can fade in), turned off at
// the end, anything else halfway.
function mix(a, b, u) {
    if (typeof a === "number" && typeof b === "number") return lerp(a, b, u);
    if (typeof a === "string" && typeof b === "string" && HEX.test(a) && HEX.test(b)) {
        var ca = hexToRgb(a), cb = hexToRgb(b);
        return rgbToHex([0, 1, 2].map(function(i) { return lerp(ca[i], cb[i], u); }));
    }
    if (typeof b === "boolean") return b ? (u > 0 ? b : a) : (u >= 1 ? b : a);
    return u >= 0.5 ? b : a;
}

// Rotation about a screen axis, applied after the current one.
function rotateScreen(q, axis, radians) {
    var r = glm.quat.setAxisAngle(glm.quat.create(), axis, radians);
    return glm.quat.normalize(glm.quat.create(), glm.quat.multiply(glm.quat.create(), r, q));
}

function screenAxis(name) {
    if (name === "x") return [1, 0, 0];
    if (name === "y" || name === undefined) return [0, 1, 0];
    if (name === "z") return [0, 0, 1];
    if (Array.isArray(name) && name.length === 3) return glm.vec3.normalize(glm.vec3.create(), name);
    throw new Error("axis must be 'x', 'y', 'z' or [x, y, z]");
}

// The rotation after q that turns `point` toward the viewer, as seen from
// `center` (so a ligand in a pocket is seen from outside, not through the
// protein), turning as little as possible.
function facing(q, point, center) {
    var d = glm.vec3.sub(glm.vec3.create(), point, center || [0, 0, 0]);
    if (glm.vec3.length(d) < 1e-3) return q;
    glm.vec3.normalize(d, d);
    var seen = glm.vec3.transformQuat(glm.vec3.create(), d, q);
    var turn = glm.quat.rotationTo(glm.quat.create(), seen, [0, 0, 1]);
    // Only part of the way when the point is far behind: a quarter turn
    // off-axis looks more natural than staring straight down the pocket.
    var target = glm.quat.slerp(glm.quat.create(), glm.quat.create(), turn, 0.85);
    return glm.quat.normalize(glm.quat.create(), glm.quat.multiply(glm.quat.create(), target, q));
}

function catmull(p0, p1, p2, p3, u) {
    var u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

// scene: what the film needs to know about the structure and the viewer:
//   start              the state at time 0
//   value(key)         a setting of the starting view
//   selection(sel)     {center: [x, y, z], radius} of a selection, or null
//   center             [x, y, z], the middle of the structure
//   frames             number of trajectory frames
//   camera(c)          {q, target, span} for a camera from cameraState()
//   focusDepth(sel, q) normalized depth of a selection seen with rotation q
function compile(film, scene) {
    var shots = Array.isArray(film) ? film : (film && film.shots) || [];
    if (!shots.length) throw new Error("the film has no shots");
    var home = cloneState(scene.start);

    function value(state, key) {
        return key in state.settings ? state.settings[key] : scene.value(key);
    }

    // Compiles a shot starting from `start`: {duration, apply(state, t)}.
    function build(shot, start) {
        if (!shot || typeof shot !== "object" || TYPES.indexOf(shot.type) < 0) {
            throw new Error("unknown shot " + JSON.stringify(shot && shot.type) + " (use " + TYPES.join(", ") + ")");
        }
        var duration = seconds(shot);
        var ease = easing(shot);
        var progress = function(t) {
            return duration > 0 ? ease(Math.max(0, Math.min(1, t / duration))) : 1;
        };
        var type = shot.type;

        if (type === "hold") {
            return {duration: duration, apply: function() {}};
        }
        if (type === "turntable" || type === "orbit" || type === "rock") {
            var degrees = shot.degrees !== undefined ? +shot.degrees : type === "rock" ? 30 : 360;
            var axis;
            if (type === "orbit") {
                var tilt = (shot.tilt === undefined ? 20 : +shot.tilt) * Math.PI / 180;
                axis = [0, Math.cos(tilt), Math.sin(tilt)];
            } else {
                axis = screenAxis(shot.axis);
            }
            var cycles = shot.cycles === undefined ? 1 : +shot.cycles;
            return {duration: duration, apply: function(s, t) {
                var u = progress(t);
                var angle = type === "rock"
                    ? Math.sin(2 * Math.PI * cycles * u) * degrees
                    : degrees * u;
                s.q = rotateScreen(s.q, axis, angle * Math.PI / 180);
            }};
        }
        if (type === "zoom") {
            var factor = shot.factor === undefined ? 2 : +shot.factor;
            if (!(factor > 0)) throw new Error("zoom: factor must be > 0");
            return {duration: duration, apply: function(s, t) {
                s.span /= Math.pow(factor, progress(t));
            }};
        }
        if (type === "fly_to" || type === "home" || type === "keyframes") {
            var keys;
            if (type === "keyframes") {
                keys = keyStates(shot, start);
                duration = keys[keys.length - 1].time;
            } else {
                var to = {q: start.q, target: start.target, span: start.span, settings: {}};
                if (type === "home") {
                    to = {q: home.q, target: home.target, span: home.span, settings: {}};
                } else {
                    var sel = scene.selection(shot.selection || {});
                    if (!sel) throw new Error("fly_to: the selection " + JSON.stringify(shot.selection) + " matches no atoms");
                    var span = shot.zoom ? start.span / +shot.zoom : Math.max(12, 2.6 * sel.radius);
                    var q = start.q;
                    if (shot.face) q = facing(start.q, sel.center, scene.center);
                    to = {q: q, target: sel.center, span: span, settings: {}};
                }
                keys = [{time: 0, q: start.q, target: start.target, span: start.span, settings: {}},
                        {time: duration, q: to.q, target: to.target, span: to.span, settings: {}}];
            }
            return {duration: duration, apply: function(s, t) {
                pathAt(keys, duration > 0 ? progress(t) * duration : duration, s, start);
            }};
        }
        if (type === "rack_focus") {
            var toSel = shot.to;
            var strength = shot.strength === undefined ? Math.max(1, value(start, "dofStrength") || 0) : +shot.strength;
            var startStrength = value(start, "dofStrength") || 0;
            var fromSel = shot.from !== undefined ? shot.from : value(start, "dofFocus");
            var depthOf = function(sel, q, fallback) {
                if (typeof sel === "number") return sel;
                if (sel && typeof sel === "object" && Object.keys(sel).length) return scene.focusDepth(sel, q);
                return fallback;
            };
            if (toSel === undefined) throw new Error("rack_focus: give `to` (a selection or a depth 0 - 1)");
            if (typeof toSel === "object" && !scene.selection(toSel)) {
                throw new Error("rack_focus: the selection " + JSON.stringify(toSel) + " matches no atoms");
            }
            return {duration: duration, apply: function(s, t) {
                var u = progress(t);
                var a = depthOf(fromSel, s.q, value(start, "dofPosition"));
                var b = depthOf(toSel, s.q, 0.5);
                s.settings.dofFocus = u >= 1 && typeof toSel === "object" ? toSel : {};
                s.settings.dofPosition = u >= 1 && typeof toSel === "object" ? b : lerp(a, b, u);
                // Blur fades in over the first third when depth of field was off.
                s.settings.dofStrength = lerp(startStrength, strength, duration > 0 ? Math.min(1, 3 * t / duration) : 1);
            }};
        }
        if (type === "cut_open" || type === "fade") {
            var changes = type === "fade" ? (shot.settings || {}) : {cutaway: shot.to === undefined ? 0.5 : +shot.to};
            var cutAxis = type === "cut_open" ? shot.axis : undefined;
            var from = {};
            for (var k in changes) from[k] = value(start, k);
            return {duration: duration, apply: function(s, t) {
                var u = progress(t);
                if (cutAxis) s.settings.cutawayAxis = cutAxis;
                for (var key in changes) s.settings[key] = mix(from[key], changes[key], u);
            }};
        }
        if (type === "crossfade") {
            var target = Object.assign({}, shot.settings || {});
            return {duration: duration, apply: function(s, t) {
                var u = progress(t);
                if (u >= 1) {
                    Object.assign(s.settings, target);
                } else if (u > 0) {
                    s.blend = {settings: target, alpha: u};
                }
            }};
        }
        if (type === "trajectory") {
            var last = Math.max(0, scene.frames - 1);
            var first = shot.start === undefined ? 0 : +shot.start;
            var end = shot.end === undefined || shot.end === null || +shot.end < 0 ? last : Math.min(last, +shot.end);
            var smooth = shot.interpolate === undefined ? true : !!shot.interpolate;
            return {duration: duration, apply: function(s, t) {
                var f = lerp(first, end, progress(t));
                s.frame = smooth ? f : Math.round(f);
            }};
        }
        if (type === "title") {
            var fade = shot.fade === undefined ? Math.min(0.6, duration / 4) : +shot.fade;
            var overlay = {
                text: String(shot.text || ""), subtitle: shot.subtitle ? String(shot.subtitle) : "",
                position: shot.position || "bottom-left", size: shot.size || 1, color: shot.color || ""
            };
            return {duration: duration, apply: function(s, t) {
                if (t < 0 || t > duration) return;
                var alpha = fade > 0 ? Math.min(1, t / fade, (duration - t) / fade) : 1;
                if (alpha > 0) s.overlays.push(Object.assign({alpha: alpha}, overlay));
            }};
        }
        if (type === "together") {
            var parts = (shot.shots || []).map(function(child) { return build(child, start); });
            var longest = parts.reduce(function(m, p) { return Math.max(m, p.duration); }, 0);
            return {duration: shot.seconds === undefined ? longest : duration, apply: function(s, t) {
                for (var i = 0; i < parts.length; i++) {
                    var local = Math.min(t, parts[i].duration);
                    parts[i].apply(s, local);
                }
            }};
        }
        throw new Error("unknown shot type " + type);
    }

    // Keyframes as states with times (seconds from the shot's start). The
    // first key defaults to the state the shot starts from.
    function keyStates(shot, start) {
        var raw = shot.keys || [];
        if (!raw.length) throw new Error("keyframes: no keys");
        var gap = shot.seconds ? +shot.seconds / Math.max(1, raw.length - (raw[0].time === 0 ? 1 : 0)) : 2;
        var keys = [];
        var t = 0;
        if (!(raw[0].time === 0)) keys.push({time: 0, q: start.q, target: start.target, span: start.span, settings: {}});
        var prev = keys.length ? keys[0] : {q: start.q, target: start.target, span: start.span};
        for (var i = 0; i < raw.length; i++) {
            var k = raw[i];
            t = k.time !== undefined && k.time !== null ? +k.time : (keys.length ? t + gap : 0);
            var cam = k.camera ? scene.camera(k.camera) : prev;
            var key = {time: t, q: cam.q, target: cam.target, span: cam.span, settings: k.settings || {}};
            keys.push(key);
            prev = key;
        }
        for (var j = 1; j < keys.length; j++) {
            if (!(keys[j].time >= keys[j - 1].time)) throw new Error("keyframes: times must increase");
        }
        return keys;
    }

    // State along a keyframe path at time t: the target and zoom follow a
    // smooth curve through the keys, the rotation turns steadily between
    // them, settings blend from key to key.
    function pathAt(keys, t, s, start) {
        var n = keys.length;
        var i = 0;
        while (i < n - 2 && t > keys[i + 1].time) i++;
        var a = keys[i], b = keys[Math.min(n - 1, i + 1)];
        var u = b.time > a.time ? Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time))) : 1;
        var k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
        var target = [0, 1, 2].map(function(c) {
            return n > 2 ? catmull(k0.target[c], a.target[c], b.target[c], k3.target[c], u) : lerp(a.target[c], b.target[c], u);
        });
        var logSpan = n > 2
            ? catmull(Math.log(k0.span), Math.log(a.span), Math.log(b.span), Math.log(k3.span), u)
            : lerp(Math.log(a.span), Math.log(b.span), u);
        s.q = glm.quat.normalize(glm.quat.create(), glm.quat.slerp(glm.quat.create(), a.q, b.q, u));
        s.target = target;
        s.span = Math.exp(logSpan);
        // Settings: each key's settings hold until the next key changes them.
        var names = {};
        keys.forEach(function(k) { for (var name in k.settings) names[name] = true; });
        for (var name in names) {
            var va = settingAt(keys, i, name, start), vb = settingAt(keys, Math.min(n - 1, i + 1), name, start);
            s.settings[name] = mix(va, vb, u);
        }
    }

    function settingAt(keys, i, name, start) {
        for (var j = i; j >= 0; j--) if (name in keys[j].settings) return keys[j].settings[name];
        return value(start, name);
    }

    var segments = [];
    var state = cloneState(scene.start);
    var time = 0;
    for (var i = 0; i < shots.length; i++) {
        var seg = build(shots[i], state);
        seg.start = time;
        seg.from = state;
        var end = cloneState(state);
        seg.apply(end, seg.duration);
        end.overlays = [];
        end.blend = null;
        seg.to = end;
        segments.push(seg);
        state = end;
        time += seg.duration;
    }

    return {
        duration: time,
        // The state at time t (seconds).
        sample: function(t) {
            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i];
                var last = i === segments.length - 1;
                if (t < seg.start + seg.duration || last) {
                    var s = cloneState(seg.from);
                    s.overlays = [];
                    s.blend = null;
                    seg.apply(s, Math.max(0, Math.min(seg.duration, t - seg.start)));
                    return s;
                }
            }
            return cloneState(state);
        }
    };
}

// --- camera <-> view --------------------------------------------------------

// The state's camera for a view (its rotation, translation, zoom and resolution).
function fromView(view) {
    var R = view.rotation;
    var q = glm.quat.normalize(glm.quat.create(), glm.quat.fromMat3(glm.quat.create(), glm.mat3.fromMat4(glm.mat3.create(), R)));
    var res = view.resolution;
    var side = Math.max(res.x, res.y);
    var half = 1 / (2 * view.zoom);
    // The canvas shows the bottom-left of a square frame of side `side`.
    var cx = view.translation.x - half * (1 - res.x / side);
    var cy = view.translation.y - half * (1 - res.y / side);
    // Back to model space (R is a rotation: its inverse is its transpose).
    var target = [R[0] * cx + R[1] * cy, R[4] * cx + R[5] * cy, R[8] * cx + R[9] * cy];
    return {q: q, target: target, span: (1 / view.zoom) * Math.min(res.x, res.y) / side};
}

// Sets a view's rotation, translation and zoom from a state.
function toView(state, view) {
    var R = glm.mat4.fromQuat(glm.mat4.create(), state.q);
    var t = state.target;
    var px = R[0] * t[0] + R[4] * t[1] + R[8] * t[2];
    var py = R[1] * t[0] + R[5] * t[1] + R[9] * t[2];
    var res = view.resolution;
    var side = Math.max(res.x, res.y);
    var zoom = Math.min(res.x, res.y) / (side * state.span);
    var half = 1 / (2 * zoom);
    view.rotation = R;
    view.zoom = zoom;
    view.translation = {x: px + half * (1 - res.x / side), y: py + half * (1 - res.y / side)};
}

module.exports.compile = compile;
module.exports.fromView = fromView;
module.exports.toView = toView;
module.exports.mix = mix;
module.exports.TYPES = TYPES;
