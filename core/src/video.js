"use strict";

var Mp4Writer = require("./mp4").Mp4Writer;

// H.264 MP4 encoding in the browser with WebCodecs (Chrome / Edge 94+,
// Safari 16.4+, Firefox 130+): frames are encoded as they are rendered, so
// only the compressed video is kept.

function supported() {
    return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

// H.264 levels: [level_idc, max macroblocks per frame, per second].
var LEVELS = [[0x1f, 3600, 108000], [0x28, 8192, 245760], [0x2a, 8704, 522240], [0x32, 22080, 589824],
              [0x33, 36864, 983040], [0x34, 36864, 2073600]];
var PROFILES = ["6400", "4d40", "42e0"];   // High, Main, Constrained Baseline

function hex2(n) {
    return (n < 16 ? "0" : "") + n.toString(16);
}

function codecsFor(width, height, fps) {
    var mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
    var levels = LEVELS.filter(function(l) { return mbs <= l[1] && mbs * fps <= l[2]; });
    if (!levels.length) levels = [LEVELS[LEVELS.length - 1]];
    var out = [];
    PROFILES.forEach(function(p) {
        levels.slice(0, 2).forEach(function(l) { out.push("avc1." + p + hex2(l[0])); });
    });
    return out;
}

// options: width, height (even), fps, bitrate (bits per second, default
// from the size), keyInterval (frames between key frames).
function VideoWriter(options) {
    this.width = options.width;
    this.height = options.height;
    this.fps = options.fps || 30;
    // About 0.12 bits per pixel: rendered frames are smooth, so this is
    // clean at 1080p (about 7.5 Mbit/s at 30 fps) without large files.
    this.bitrate = options.bitrate || Math.min(60e6, Math.round(0.12 * this.width * this.height * this.fps));
    this.keyInterval = options.keyInterval || Math.round(2 * this.fps);
    this.mp4 = new Mp4Writer(this.width, this.height, this.fps);
    this.encoder = null;
    this.error = null;
    this.count = 0;
}

VideoWriter.prototype.start = function() {
    var self = this;
    if (!supported()) {
        return Promise.reject(new Error("this browser cannot encode video (WebCodecs is missing)"));
    }
    if (self.width % 2 || self.height % 2) {
        return Promise.reject(new Error("video width and height must be even"));
    }
    var codecs = codecsFor(self.width, self.height, self.fps);
    var tryNext = function(i) {
        if (i >= codecs.length) {
            return Promise.reject(new Error("this browser cannot encode H.264 video at " + self.width + " x " + self.height));
        }
        var config = {
            codec: codecs[i], width: self.width, height: self.height, bitrate: self.bitrate,
            framerate: self.fps, avc: {format: "avc"}
        };
        return VideoEncoder.isConfigSupported(config).then(function(r) {
            return r.supported ? config : tryNext(i + 1);
        }, function() { return tryNext(i + 1); });
    };
    return tryNext(0).then(function(config) {
        self.encoder = new VideoEncoder({
            output: function(chunk, metadata) { self.mp4.add(chunk, metadata); },
            error: function(e) { self.error = e; }
        });
        self.encoder.configure(config);
        self.codec = config.codec;
    });
};

// Encodes a canvas (or anything VideoFrame accepts) as the next frame.
VideoWriter.prototype.add = function(source) {
    var self = this;
    if (self.error) return Promise.reject(self.error);
    var frame = new VideoFrame(source, {
        timestamp: Math.round(self.count * 1e6 / self.fps),
        duration: Math.round(1e6 / self.fps)
    });
    self.encoder.encode(frame, {keyFrame: self.count % self.keyInterval === 0});
    frame.close();
    self.count++;
    // Keep only a few frames waiting in the encoder.
    var wait = function() {
        if (self.error) return Promise.reject(self.error);
        if (self.encoder.encodeQueueSize <= 4) return Promise.resolve();
        return new Promise(function(resolve) { setTimeout(resolve, 5); }).then(wait);
    };
    return wait();
};

// Bytes of encoded video so far.
Object.defineProperty(VideoWriter.prototype, "byteLength", {get: function() {
    return this.mp4.byteLength;
}});

// The finished MP4 file (Uint8Array).
VideoWriter.prototype.finish = function() {
    var self = this;
    return self.encoder.flush().then(function() {
        self.encoder.close();
        if (self.error) throw self.error;
        return self.mp4.finish();
    });
};

VideoWriter.prototype.cancel = function() {
    if (this.encoder && this.encoder.state !== "closed") this.encoder.close();
};

module.exports.VideoWriter = VideoWriter;
module.exports.supported = supported;
