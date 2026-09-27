"use strict";

// Structure parsing that keeps the page responsive: texts larger than
// ASYNC_BYTES are parsed in a Web Worker (the ribosome's 28 MB mmCIF takes
// about a second), smaller ones right away. Falls back to the main thread
// where workers are unavailable (or blocked by a content security policy).
var formats = require("./formats.js");

var ASYNC_BYTES = 2e6;
var worker = null, failed = false, nextId = 0, pending = {};

function getWorker() {
    if (worker || failed) return worker;
    try {
        var source = require("./worker-source.js");
        var url = URL.createObjectURL(new Blob([source], {type: "text/javascript"}));
        worker = new Worker(url);
        worker.onmessage = function(e) {
            var job = pending[e.data.id];
            if (!job) return;
            if (e.data.progress !== undefined) {
                if (job.onProgress) job.onProgress(e.data.progress);
                return;
            }
            delete pending[e.data.id];
            if (e.data.error) job.reject(new Error(e.data.error));
            else job.resolve(formats.unpack(e.data.packed));
        };
        worker.onerror = function() {
            // Could not start (e.g. blocked): parse the pending texts here.
            failed = true;
            worker = null;
            for (var id in pending) {
                var job = pending[id];
                delete pending[id];
                try { job.resolve(formats.parse(job.text)); } catch (err) { job.reject(err); }
            }
        };
    } catch (err) {
        failed = true;
        worker = null;
    }
    return worker;
}

// The parsed structure, or a Promise of it for large texts; onProgress
// (optional) receives the reading progress (0 - 1) of a background parse.
module.exports.parse = function(text, onProgress) {
    if (text.length < ASYNC_BYTES || typeof Worker === "undefined" || typeof Blob === "undefined" || !getWorker()) {
        return formats.parse(text);
    }
    return new Promise(function(resolve, reject) {
        var id = ++nextId;
        pending[id] = {resolve: resolve, reject: reject, text: text, onProgress: onProgress};
        worker.postMessage({id: id, text: text});
    });
};

module.exports.ASYNC_BYTES = ASYNC_BYTES;
