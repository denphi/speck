"use strict";

// Web Worker entry (bundled into lib/worker-source.js by build-worker.js):
// parses structure text off the main thread.
var formats = require("./formats.js");

self.onmessage = function(e) {
    var id = e.data.id;
    try {
        var out = formats.pack(formats.parse(e.data.text, function(f) {
            self.postMessage({id: id, progress: f});
        }));
        self.postMessage({id: id, packed: out.packed}, out.transfer);
    } catch (err) {
        self.postMessage({id: id, error: String(err && err.message || err)});
    }
};
