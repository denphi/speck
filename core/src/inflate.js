"use strict";

// Gunzip for browsers without DecompressionStream (before Safari 16.4 /
// Firefox 113): a compact DEFLATE decoder (RFC 1951) inside a gzip reader
// (RFC 1952). gunzip() prefers the native stream when available.

var LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115,
                131, 163, 195, 227, 258];
var LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
                 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// Canonical Huffman table: counts per length and symbols sorted by code.
function huffman(lengths) {
    var counts = new Uint16Array(16), offs = new Uint16Array(16);
    for (var i = 0; i < lengths.length; i++) counts[lengths[i]]++;
    counts[0] = 0;
    for (var l = 1; l < 16; l++) offs[l] = offs[l - 1] + counts[l - 1];
    var symbols = new Uint16Array(lengths.length);
    for (var s = 0; s < lengths.length; s++) if (lengths[s]) symbols[offs[lengths[s]]++] = s;
    return {counts: counts, symbols: symbols};
}

function inflateRaw(src, pos) {
    var out = new Uint8Array(Math.max(1024, src.length * 4)), n = 0;
    var bitBuf = 0, bitCnt = 0;
    function need(k) {
        while (bitCnt < k) {
            if (pos >= src.length) throw new Error("gzip data is truncated");
            bitBuf |= src[pos++] << bitCnt;
            bitCnt += 8;
        }
    }
    function bits(k) {
        need(k);
        var v = bitBuf & ((1 << k) - 1);
        bitBuf >>>= k;
        bitCnt -= k;
        return v;
    }
    function decode(h) {
        var code = 0, first = 0, index = 0;
        for (var l = 1; l < 16; l++) {
            code |= bits(1);
            var count = h.counts[l];
            if (code - first < count) return h.symbols[index + code - first];
            index += count;
            first = (first + count) << 1;
            code <<= 1;
        }
        throw new Error("bad gzip data");
    }
    function room(k) {
        if (n + k <= out.length) return;
        var grown = new Uint8Array(Math.max(out.length * 2, n + k));
        grown.set(out.subarray(0, n));
        out = grown;
    }
    var fixedLit = null, fixedDist = null;
    for (;;) {
        var last = bits(1), type = bits(2);
        if (type === 0) {
            bitBuf = 0; bitCnt = 0;
            var len = src[pos] | (src[pos + 1] << 8);
            pos += 4;
            room(len);
            out.set(src.subarray(pos, pos + len), n);
            n += len; pos += len;
        } else {
            var lit, dist;
            if (type === 1) {
                if (!fixedLit) {
                    var ll = new Uint8Array(288);
                    for (var i = 0; i < 288; i++) ll[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
                    fixedLit = huffman(ll);
                    var dl = new Uint8Array(30);
                    dl.fill(5);
                    fixedDist = huffman(dl);
                }
                lit = fixedLit; dist = fixedDist;
            } else if (type === 2) {
                var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
                var cl = new Uint8Array(19);
                for (var c = 0; c < hclen; c++) cl[CL_ORDER[c]] = bits(3);
                var clh = huffman(cl);
                var lens = new Uint8Array(hlit + hdist), k = 0;
                while (k < hlit + hdist) {
                    var sym = decode(clh);
                    if (sym < 16) lens[k++] = sym;
                    else if (sym === 16) { var rep = 3 + bits(2), prev = lens[k - 1]; while (rep--) lens[k++] = prev; }
                    else if (sym === 17) { k += 3 + bits(3); }
                    else { k += 11 + bits(7); }
                }
                lit = huffman(lens.subarray(0, hlit));
                dist = huffman(lens.subarray(hlit));
            } else {
                throw new Error("bad gzip block");
            }
            for (;;) {
                var s = decode(lit);
                if (s < 256) {
                    room(1);
                    out[n++] = s;
                } else if (s === 256) {
                    break;
                } else {
                    s -= 257;
                    var length = LEN_BASE[s] + bits(LEN_EXTRA[s]);
                    var ds = decode(dist);
                    var back = DIST_BASE[ds] + bits(DIST_EXTRA[ds]);
                    room(length);
                    for (var j = 0; j < length; j++, n++) out[n] = out[n - back];
                }
            }
        }
        if (last) break;
    }
    return {data: out.subarray(0, n), pos: pos};
}

// gzip bytes (Uint8Array) -> bytes, synchronously.
function gunzipSync(src) {
    var parts = [], total = 0, pos = 0;
    while (pos + 18 <= src.length && src[pos] === 0x1f && src[pos + 1] === 0x8b) {   // members
        var flags = src[pos + 3];
        pos += 10;
        if (flags & 4) pos += 2 + (src[pos] | (src[pos + 1] << 8));   // FEXTRA
        if (flags & 8) while (src[pos++]) {}                        // FNAME
        if (flags & 16) while (src[pos++]) {}                       // FCOMMENT
        if (flags & 2) pos += 2;                                     // FHCRC
        var r = inflateRaw(src, pos);
        parts.push(r.data);
        total += r.data.length;
        pos = r.pos + 8;                                             // CRC32, ISIZE
    }
    if (parts.length === 1) return parts[0];
    var out = new Uint8Array(total), at = 0;
    parts.forEach(function(p) { out.set(p, at); at += p.length; });
    return out;
}

function isGzip(bytes) {
    return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

// Promise of the text in `bytes` (Uint8Array), gunzipped if it is gzip data.
function gunzipText(bytes) {
    if (!isGzip(bytes)) return Promise.resolve(new TextDecoder().decode(bytes));
    if (typeof DecompressionStream !== "undefined" && typeof Response !== "undefined") {
        var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Response(stream).text().catch(function() {
            return new TextDecoder().decode(gunzipSync(bytes));
        });
    }
    return Promise.resolve().then(function() { return new TextDecoder().decode(gunzipSync(bytes)); });
}

module.exports.gunzipSync = gunzipSync;
module.exports.gunzipText = gunzipText;
module.exports.isGzip = isGzip;
