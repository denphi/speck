"use strict";

var elements = require("./elements");

// PDBx/mmCIF reader: the PDB's standard format, needed for entries too large
// for the PDB format (over 99,999 atoms or 62 chains, multi-character chain
// IDs, five-character ligand codes). Reads the first data block: atoms of the
// first model (first alternate location), later models as frames, helices and
// sheets, the unit cell and covalent / disulfide / metal bonds from
// _struct_conn. Author numbering (auth_*) is used, as in PDB files.

function isCIF(data) {
    return /^data_/m.test(data) && /^_atom_site\./m.test(data);
}

// Tokens of one line: bare words, 'quoted' or "quoted" strings (a quote only
// closes before whitespace, so O5' stays one token).
var TOKEN = /'(?:[^']|'(?=\S))*'(?=\s|$)|"(?:[^"]|"(?=\S))*"(?=\s|$)|\S+/g;

function unquote(t) {
    var c = t.charAt(0);
    return (c === "'" || c === '"') && t.length > 1 ? t.substring(1, t.length - 1) : t;
}

// Calls onItem(category, fields, rowValues) for every loop row and once for
// each group of single key-value items (category "_cell", fields ["length_a", ...]).
// Values are strings; "." and "?" (missing) are returned as null.
// onProgress(fraction), optional, is called about 50 times.
function scan(data, onItem, onProgress) {
    var lines = data.split("\n");
    var i = 0, n = lines.length;
    var step = Math.max(1, Math.floor(n / 50)), nextReport = step;
    function report() {
        if (onProgress && i >= nextReport) {
            nextReport = i + step;
            onProgress(i / n);
        }
    }
    var blocks = 0;
    var single = null; // {category, fields, values} of consecutive key-value items

    function flushSingle() {
        if (single) onItem(single.category, single.fields, single.values);
        single = null;
    }
    // Next value token starting at line i (handles ;text fields;).
    function textField() {
        var text = [lines[i].substring(1)];
        i++;
        while (i < n && lines[i].charAt(0) !== ";") {
            text.push(lines[i]);
            i++;
        }
        i++; // closing ;
        return text.join("\n").trim();
    }
    function value(t) {
        if (t === "." || t === "?") return null;
        return unquote(t);
    }

    while (i < n) {
        var line = lines[i];
        var first = line.charAt(0);
        if (first === "#" || line.trim() === "") {
            i++;
            continue;
        }
        if (line.substring(0, 5) === "data_") {
            flushSingle();
            if (++blocks > 1) break; // first block only
            i++;
            continue;
        }
        if (line.substring(0, 5) === "loop_") {
            flushSingle();
            i++;
            var fields = [], category = null;
            while (i < n && lines[i].charAt(0) === "_") {
                var name = lines[i].trim();
                var dot = name.indexOf(".");
                category = name.substring(0, dot);
                fields.push(name.substring(dot + 1));
                i++;
            }
            var row = [];
            while (i < n) {
                report();
                line = lines[i];
                first = line.charAt(0);
                if (first === ";") {
                    row.push(textField());
                } else {
                    if (first === "_" || first === "#" || line.substring(0, 5) === "loop_" ||
                        line.substring(0, 5) === "data_") {
                        break;
                    }
                    var toks = line.match(TOKEN);
                    if (toks) {
                        for (var k = 0; k < toks.length; k++) row.push(value(toks[k]));
                    }
                    i++;
                }
                while (row.length >= fields.length) {
                    onItem(category, fields, row.slice(0, fields.length));
                    row = row.slice(fields.length);
                }
            }
            continue;
        }
        if (first === "_") {
            var m = /^(\S+)\s*(.*)$/.exec(line);
            var key = m[1], rest = m[2];
            var d = key.indexOf(".");
            var cat = d > 0 ? key.substring(0, d) : key, field = d > 0 ? key.substring(d + 1) : "";
            if (!single || single.category !== cat) {
                flushSingle();
                single = {category: cat, fields: [], values: []};
            }
            i++;
            var v;
            if (rest.trim() !== "") {
                var t = rest.match(TOKEN);
                v = value(t[0]);
            } else if (i < n && lines[i].charAt(0) === ";") {
                v = textField();
            } else {
                var nt = (lines[i] || "").match(TOKEN);
                v = nt ? value(nt[0]) : null;
                i++;
            }
            single.fields.push(field);
            single.values.push(v);
            continue;
        }
        i++;
    }
    flushSingle();
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
}

function elementSymbol(type, name) {
    var sym = capitalize((type || "").replace(/[^A-Za-z]/g, ""));
    if (!(sym in elements)) {
        sym = capitalize((name || "").replace(/[^A-Za-z]/g, "").substring(0, 2));
        if (!(sym in elements)) sym = sym.substring(0, 1);
    }
    return sym in elements ? sym : "Xx";
}

function cellFromLengths(c) {
    var a = parseFloat(c.length_a), b = parseFloat(c.length_b), cc = parseFloat(c.length_c);
    var al = parseFloat(c.angle_alpha) * Math.PI / 180;
    var be = parseFloat(c.angle_beta) * Math.PI / 180;
    var ga = parseFloat(c.angle_gamma) * Math.PI / 180;
    // Cryo-EM and NMR entries carry a placeholder 1 x 1 x 1 cell.
    if (!(a > 1.5 && b > 1.5 && cc > 1.5) || [al, be, ga].some(isNaN)) return null;
    var cx = Math.cos(be);
    var cy = (Math.cos(al) - Math.cos(be) * Math.cos(ga)) / Math.sin(ga);
    var cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
    return [[a, 0, 0], [b * Math.cos(ga), b * Math.sin(ga), 0], [cc * cx, cc * cy, cc * cz]];
}

var BOND_TYPES = {covale: 1, covale_base: 1, covale_phosphate: 1, covale_sugar: 1, disulf: 1, metalc: 1};

function parse(data, onProgress) {
    var atoms = [], helices = [], sheets = [], conns = [];
    var cell = null;
    var frames = [];
    var firstModel = null, model = null, modelCoords = [];
    var col = null, colsFor = null;

    function colIndex(fields) {
        var c = {};
        for (var k = 0; k < fields.length; k++) c[fields[k]] = k;
        return c;
    }
    function pick(row, c, a, b) {
        var v = a in c ? row[c[a]] : null;
        if (v === null && b !== undefined && b in c) v = row[c[b]];
        return v;
    }
    function endModel() {
        if (model !== null && model !== firstModel && modelCoords.length === 3 * atoms.length) {
            frames.push(new Float32Array(modelCoords));
        }
        modelCoords = [];
    }

    scan(data, function(category, fields, row) {
        if (category === "_atom_site") {
            if (colsFor !== fields) {
                col = colIndex(fields);
                colsFor = fields;
            }
            var alt = pick(row, col, "label_alt_id");
            if (alt !== null && alt !== "A" && alt !== "1") return;
            var m = pick(row, col, "pdbx_PDB_model_num") || "1";
            if (firstModel === null) firstModel = m;
            if (m !== model) {
                endModel();
                model = m;
            }
            var x = parseFloat(pick(row, col, "Cartn_x"));
            var y = parseFloat(pick(row, col, "Cartn_y"));
            var z = parseFloat(pick(row, col, "Cartn_z"));
            if (model !== firstModel) {
                modelCoords.push(x, y, z);
                return;
            }
            var name = pick(row, col, "auth_atom_id", "label_atom_id") || "";
            var seq = pick(row, col, "auth_seq_id", "label_seq_id");
            atoms.push({
                symbol: elementSymbol(pick(row, col, "type_symbol"), name),
                x: x, y: y, z: z,
                name: name,
                resName: pick(row, col, "auth_comp_id", "label_comp_id") || "",
                chain: pick(row, col, "auth_asym_id", "label_asym_id") || "",
                resSeq: seq === null ? 0 : parseInt(seq),
                iCode: pick(row, col, "pdbx_PDB_ins_code") || " ",
                // B-factor; AlphaFold models store the pLDDT confidence here.
                bfactor: parseFloat(pick(row, col, "B_iso_or_equiv")),
                hetero: pick(row, col, "group_PDB") === "HETATM",
                // Molecule type (same protein or RNA in every copy), for 'entity' coloring.
                entity: pick(row, col, "label_entity_id") || "",
                // label_atom_id, used by _struct_conn
                _label: pick(row, col, "label_atom_id") || name
            });
        } else if (category === "_struct_conf") {
            var c = colIndex(fields);
            if (!/^HELX/.test(pick(row, c, "conf_type_id") || "")) return;
            helices.push({
                chain: pick(row, c, "beg_auth_asym_id", "beg_label_asym_id"),
                start: parseInt(pick(row, c, "beg_auth_seq_id", "beg_label_seq_id")),
                end: parseInt(pick(row, c, "end_auth_seq_id", "end_label_seq_id"))
            });
        } else if (category === "_struct_sheet_range") {
            var s = colIndex(fields);
            sheets.push({
                chain: pick(row, s, "beg_auth_asym_id", "beg_label_asym_id"),
                start: parseInt(pick(row, s, "beg_auth_seq_id", "beg_label_seq_id")),
                end: parseInt(pick(row, s, "end_auth_seq_id", "end_label_seq_id"))
            });
        } else if (category === "_cell") {
            var values = {};
            for (var k = 0; k < fields.length; k++) values[fields[k]] = row[k];
            cell = cellFromLengths(values);
        } else if (category === "_struct_conn") {
            var q = colIndex(fields);
            if (!(pick(row, q, "conn_type_id") in BOND_TYPES)) return;
            var sym1 = pick(row, q, "ptnr1_symmetry"), sym2 = pick(row, q, "ptnr2_symmetry");
            if ((sym1 && sym1 !== "1_555") || (sym2 && sym2 !== "1_555")) return;
            var partner = function(p) {
                return [pick(row, q, "ptnr" + p + "_auth_asym_id", "ptnr" + p + "_label_asym_id"),
                        pick(row, q, "ptnr" + p + "_auth_seq_id", "ptnr" + p + "_label_seq_id"),
                        pick(row, q, "pdbx_ptnr" + p + "_PDB_ins_code") || " ",
                        pick(row, q, "ptnr" + p + "_label_atom_id")].join("|");
            };
            conns.push([partner(1), partner(2)]);
        }
    }, onProgress);
    endModel();

    // Bonds from _struct_conn, as atom index pairs.
    var bonds = [];
    if (conns.length) {
        var index = {};
        for (var a = 0; a < atoms.length; a++) {
            var at = atoms[a];
            index[[at.chain, at.resSeq, at.iCode, at._label].join("|")] = a;
        }
        for (var b = 0; b < conns.length; b++) {
            var i1 = index[conns[b][0]], i2 = index[conns[b][1]];
            if (i1 !== undefined && i2 !== undefined && i1 !== i2) bonds.push([i1, i2]);
        }
    }
    for (var d = 0; d < atoms.length; d++) delete atoms[d]._label;

    var first = new Float32Array(3 * atoms.length);
    for (var e = 0; e < atoms.length; e++) {
        first[3 * e] = atoms[e].x;
        first[3 * e + 1] = atoms[e].y;
        first[3 * e + 2] = atoms[e].z;
    }
    return {
        atoms: atoms,
        helices: helices,
        sheets: sheets,
        cell: cell,
        bonds: bonds,
        frames: [first].concat(frames)
    };
}

module.exports.isCIF = isCIF;
module.exports.parse = parse;
module.exports.scan = scan;
