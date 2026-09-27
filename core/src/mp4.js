"use strict";

// MP4 (ISO BMFF) writer for one H.264 video track, as encoded by WebCodecs:
// the index (moov) comes before the data, so players can start at once.
// Samples are kept in memory; files up to 4 GB.

function u32(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function u16(n) {
    return [(n >>> 8) & 255, n & 255];
}

function ascii(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
}

function concat(parts) {
    var n = 0;
    parts.forEach(function(p) { n += p.length; });
    var out = new Uint8Array(n), at = 0;
    parts.forEach(function(p) {
        out.set(p, at);
        at += p.length;
    });
    return out;
}

// A box: size, type, then the contents (arrays of bytes or Uint8Arrays).
function box(type) {
    var parts = [];
    for (var i = 1; i < arguments.length; i++) {
        var p = arguments[i];
        parts.push(p instanceof Uint8Array ? p : new Uint8Array(p));
    }
    var body = concat(parts);
    return concat([new Uint8Array(u32(body.length + 8).concat(ascii(type))), body]);
}

function fullBox(type, version, flags) {
    var args = [type, [version].concat(u32(flags).slice(1))];
    for (var i = 3; i < arguments.length; i++) args.push(arguments[i]);
    return box.apply(null, args);
}

var MATRIX = [].concat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000));

// width, height: pixels; fps: frames per second.
function Mp4Writer(width, height, fps) {
    this.width = width;
    this.height = height;
    this.timescale = Math.round(fps * 1000);
    this.delta = 1000;
    this.samples = [];   // {data, key, pts}
    this.description = null;
}

// A chunk from VideoEncoder's output callback, with its metadata.
Mp4Writer.prototype.add = function(chunk, metadata) {
    if (metadata && metadata.decoderConfig && metadata.decoderConfig.description) {
        var d = metadata.decoderConfig.description;
        this.description = new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d);
    }
    var data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.samples.push({data: data, key: chunk.type === "key", pts: chunk.timestamp});
};

Object.defineProperty(Mp4Writer.prototype, "byteLength", {get: function() {
    var n = 0;
    this.samples.forEach(function(s) { n += s.data.length; });
    return n;
}});

// The finished file.
Mp4Writer.prototype.finish = function() {
    if (!this.description) throw new Error("the encoder gave no H.264 configuration (avcC)");
    var n = this.samples.length;
    var ts = this.timescale, delta = this.delta;
    var duration = n * delta;
    // Presentation offsets, in case the encoder reordered frames.
    var offsets = this.samples.map(function(s, i) {
        return Math.round(s.pts * ts / 1e6) - i * delta;
    });
    var reordered = offsets.some(function(o) { return o !== 0; });
    var signed = offsets.some(function(o) { return o < 0; });

    var w = this.width, h = this.height;
    var avc1 = box("avc1",
        [0, 0, 0, 0, 0, 0], u16(1),               // reserved, data reference index
        u16(0), u16(0), u32(0), u32(0), u32(0),   // pre-defined, reserved
        u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1),
        new Uint8Array(32),                       // compressor name
        u16(0x0018), u16(0xffff),
        box("avcC", this.description));
    var stsd = fullBox("stsd", 0, 0, u32(1), avc1);
    var stts = fullBox("stts", 0, 0, u32(1), u32(n), u32(delta));
    var syncs = [];
    this.samples.forEach(function(s, i) { if (s.key) syncs.push(i + 1); });
    var stss = fullBox("stss", 0, 0, u32(syncs.length), [].concat.apply([], syncs.map(u32)));
    var stsc = fullBox("stsc", 0, 0, u32(1), u32(1), u32(n), u32(1));
    var sizes = new Uint8Array(4 * n);
    this.samples.forEach(function(s, i) { sizes.set(u32(s.data.length), 4 * i); });
    var stsz = fullBox("stsz", 0, 0, u32(0), u32(n), sizes);
    var ctts = null;
    if (reordered) {
        var entries = new Uint8Array(8 * n);
        offsets.forEach(function(o, i) {
            entries.set(u32(1), 8 * i);
            entries.set(u32(o >>> 0), 8 * i + 4);
        });
        ctts = fullBox("ctts", signed ? 1 : 0, 0, u32(n), entries);
    }

    var self = this;
    var moovFor = function(dataOffset) {
        var stco = fullBox("stco", 0, 0, u32(1), u32(dataOffset));
        var stblParts = ["stbl", stsd, stts];
        if (ctts) stblParts.push(ctts);
        stblParts.push(stss, stsc, stsz, stco);
        var stbl = box.apply(null, stblParts);
        var dinf = box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)));
        var minf = box("minf", fullBox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf, stbl);
        var hdlr = fullBox("hdlr", 0, 0, u32(0), ascii("vide"), u32(0), u32(0), u32(0), ascii("VideoHandler"), [0]);
        var mdhd = fullBox("mdhd", 0, 0, u32(0), u32(0), u32(ts), u32(duration), u16(0x55c4), u16(0));
        var mdia = box("mdia", mdhd, hdlr, minf);
        var tkhd = fullBox("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(duration), u32(0), u32(0),
            u16(0), u16(0), u16(0), u16(0), MATRIX, u32(self.width << 16), u32(self.height << 16));
        var trak = box("trak", tkhd, mdia);
        var mvhd = fullBox("mvhd", 0, 0, u32(0), u32(0), u32(ts), u32(duration), u32(0x00010000), u16(0x0100),
            u16(0), u32(0), u32(0), MATRIX, new Uint8Array(24), u32(2));
        return box("moov", mvhd, trak);
    };

    var ftyp = box("ftyp", ascii("isom"), u32(0x200), ascii("isom"), ascii("iso2"), ascii("avc1"), ascii("mp41"));
    var dataSize = this.byteLength;
    // The moov's size does not depend on the offset's value, so measure it first.
    var moovSize = moovFor(0).length;
    var moov = moovFor(ftyp.length + moovSize + 8);
    var mdatHeader = new Uint8Array(u32(dataSize + 8).concat(ascii("mdat")));
    var parts = [ftyp, moov, mdatHeader];
    this.samples.forEach(function(s) { parts.push(s.data); });
    return concat(parts);
};

module.exports.Mp4Writer = Mp4Writer;
