"use strict";

// Mouse, touch and pen interaction through Pointer Events.
//   mouse / pen: drag rotates, Shift-drag pans, wheel zooms
//   touch:       one finger rotates, two fingers pinch to zoom and drag to pan
// The container gets touch-action: none, so gestures move the molecule rather
// than scroll or zoom the page.

var speckView = require("./view.js");

module.exports = function(args) {
    if (arguments.length > 1) {
        throw "Error: The Speck Interactions module has changed!";
    } else if ((arguments.length === 0) || (typeof args !== "object")) {
        throw "Error: Arguments not provided to interactions";
    }

    var scrollZoom = args.scrollZoom === undefined ? true : args.scrollZoom;
    var container = args.container;

    var getRotation = args.getRotation;
    var setRotation = args.setRotation;
    var getTranslation = args.getTranslation;
    var setTranslation = args.setTranslation;
    var getZoom = args.getZoom;
    var setZoom = args.setZoom;
    var refreshView = args.refreshView;

    var pointers = {};          // pointerId -> {x, y}
    var shiftDown = false;
    var pinch = null;           // {dist, x, y} of the last two-finger frame

    container.style.touchAction = "none";

    function count() {
        return Object.keys(pointers).length;
    }

    function rotate(dx, dy) {
        var viewDummyObj = {rotation: new Float32Array(getRotation())};
        speckView.rotate(viewDummyObj, dx, dy);
        setRotation(viewDummyObj.rotation);
    }

    function pan(dx, dy) {
        var translation = getTranslation();
        var inverseZoom = 0.001 / getZoom();
        setTranslation({x: translation.x - dx * inverseZoom, y: translation.y + dy * inverseZoom});
    }

    function twoFingers() {
        var ids = Object.keys(pointers);
        var a = pointers[ids[0]], b = pointers[ids[1]];
        return {dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
    }

    function pointerdownFn(e) {
        if (e.pointerType === "mouse" && e.button !== 0) {
            return;
        }
        pointers[e.pointerId] = {x: e.clientX, y: e.clientY};
        if (container.setPointerCapture) {
            try { container.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
        }
        pinch = count() === 2 ? twoFingers() : null;
    }

    function pointermoveFn(e) {
        var p = pointers[e.pointerId];
        if (!p) {
            return;
        }
        // prevents interaction with other page elements while dragging
        e.preventDefault();
        var dx = e.clientX - p.x;
        var dy = e.clientY - p.y;
        if (dx === 0 && dy === 0) {
            return;
        }
        p.x = e.clientX;
        p.y = e.clientY;

        var n = count();
        if (n === 1) {
            if (shiftDown || e.shiftKey) {
                pan(dx, dy);
            } else {
                rotate(dx, dy);
            }
        } else if (n === 2 && pinch) {
            var now = twoFingers();
            if (pinch.dist > 0 && now.dist > 0) {
                setZoom(getZoom() * now.dist / pinch.dist);
            }
            pan(now.x - pinch.x, now.y - pinch.y);
            pinch = now;
        }
        refreshView();
    }

    function pointerupFn(e) {
        if (!pointers[e.pointerId]) {
            return;
        }
        delete pointers[e.pointerId];
        pinch = count() === 2 ? twoFingers() : null;
    }

    function keychangeFn(e) {
        shiftDown = e.shiftKey;
    }

    function wheelFn(e) {
        // prevents the page from scrolling when using scroll wheel inside speck component
        e.preventDefault();
        setZoom(getZoom() * (e.deltaY < 0 ? 1 / 0.9 : 0.9));
        refreshView();
    }

    container.addEventListener("pointerdown", pointerdownFn);
    container.addEventListener("pointermove", pointermoveFn);
    container.addEventListener("pointerup", pointerupFn);
    container.addEventListener("pointercancel", pointerupFn);
    window.addEventListener("keydown", keychangeFn);
    window.addEventListener("keyup", keychangeFn);
    if (scrollZoom) {
        container.addEventListener("wheel", wheelFn, {passive: false});
    }

    function removeAllEventListeners() {
        container.removeEventListener("pointerdown", pointerdownFn);
        container.removeEventListener("pointermove", pointermoveFn);
        container.removeEventListener("pointerup", pointerupFn);
        container.removeEventListener("pointercancel", pointerupFn);
        window.removeEventListener("keydown", keychangeFn);
        window.removeEventListener("keyup", keychangeFn);
        container.removeEventListener("wheel", wheelFn);
    }

    return removeAllEventListeners;
};
