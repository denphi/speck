"""Structure text formats: detection, frame counts and file reading.

The same module ships in ipyspeck and stspeck (keep the two copies
identical). The browser viewer parses the text itself (core/src/formats.js),
so this only needs to agree with it on the format and the number of frames.
"""

import gzip
import re

_CIF = re.compile(r"^data_", re.M)
_CIF_ATOMS = re.compile(r"^_atom_site\.", re.M)
_PDB_ATOMS = re.compile(r"^(ATOM  |HETATM)", re.M)
_TOKEN = re.compile(r"""'(?:[^']|'(?=\S))*'(?=\s|$)|"(?:[^"]|"(?=\S))*"(?=\s|$)|\S+""")

EXTENSIONS = (".pdb", ".ent", ".cif", ".mmcif", ".sdf", ".mol", ".xyz", ".extxyz")


def detect(data):
    """'mmcif', 'pdb', 'sdf' or 'xyz' (the same rules as the viewer)."""
    if _CIF.search(data) and _CIF_ATOMS.search(data):
        return "mmcif"
    if _PDB_ATOMS.search(data):
        return "pdb"
    lines = data.split("\n", 5)
    if len(lines) >= 4 and re.search(r"V[23]000\s*$", lines[3]):
        return "sdf"
    return "xyz"


def _cif_models(data):
    """Number of models in the _atom_site loop of an mmCIF file."""
    fields, models, in_loop, reading = [], set(), False, False
    for line in data.split("\n"):
        if line.startswith("loop_"):
            in_loop, reading, fields = True, False, []
            continue
        if in_loop and line.startswith("_"):
            name = line.split()[0]
            if name.startswith("_atom_site."):
                fields.append(name[len("_atom_site."):])
            else:
                in_loop = False
            continue
        if in_loop and fields:
            if line.startswith(("#", "_", "data_")) or not line.strip():
                if models:
                    break
                continue
            reading = True
            if "pdbx_PDB_model_num" not in fields:
                return 1
            tokens = _TOKEN.findall(line)
            if len(tokens) == len(fields):
                models.add(tokens[fields.index("pdbx_PDB_model_num")])
        elif reading:
            break
    return max(1, len(models))


def _sdf_records(data):
    """Records of an SDF with the same atoms as the first (conformers)."""
    counts = []
    for k, record in enumerate(re.split(r"^\$\$\$\$[ \t\r]*$", data, flags=re.M)):
        # Records after a $$$$ line start with its newline; the first record's
        # title line may itself be empty, so it is left as is.
        if k > 0 and record.startswith("\n"):
            record = record[1:]
        lines = record.split("\n")
        if len(lines) >= 4 and re.search(r"V2000\s*$", lines[3]):
            counts.append(lines[3][:3].strip())
        elif len(lines) >= 4 and re.search(r"V3000\s*$", lines[3]):
            m = re.search(r"COUNTS\s+(\d+)", record)
            counts.append(m.group(1) if m else "?")
    if not counts:
        return 1
    return sum(1 for c in counts if c == counts[0])


def count_frames(data):
    """Number of frames: mmCIF models, PDB MODELs, SDF conformers or XYZ blocks."""
    kind = detect(data)
    if kind == "mmcif":
        return _cif_models(data)
    if kind == "pdb":
        return max(1, len(re.findall(r"^ENDMDL", data, re.M)))
    if kind == "sdf":
        return _sdf_records(data)
    lines = data.split("\n")
    count, at = 0, 0
    while at < len(lines):
        try:
            natoms = int(lines[at].strip())
        except ValueError:
            break
        if natoms <= 0 or at + natoms + 2 > len(lines):
            break
        count, at = count + 1, at + natoms + 2
    return max(1, count)


def read_text(path):
    """Text of a structure file, gunzipping .gz files."""
    path = str(path)
    if path.endswith(".gz"):
        with gzip.open(path, "rt") as f:
            return f.read()
    with open(path) as f:
        return f.read()



def count_atoms(data):
    """Atoms in the first model / frame of structure text."""
    kind = detect(data)
    if kind == "mmcif":
        n, model = 0, None
        fields = [l.split()[0][len("_atom_site."):] for l in data.split("\n") if l.startswith("_atom_site.")]
        col = fields.index("pdbx_PDB_model_num") if "pdbx_PDB_model_num" in fields else None
        for line in data.split("\n"):
            if line.startswith(("ATOM", "HETATM")):
                if col is not None:
                    tokens = _TOKEN.findall(line)
                    m = tokens[col] if len(tokens) == len(fields) else model
                    if model is None:
                        model = m
                    elif m != model:
                        break
                n += 1
        return n
    if kind == "pdb":
        return len(re.findall(r"^(?:ATOM  |HETATM)", data.split("ENDMDL")[0], re.M))
    if kind == "sdf":
        counts = data.split("\n", 5)[3]
        m = re.search(r"COUNTS\s+(\d+)", data) if "V3000" in counts else None
        return int(m.group(1)) if m else int(counts[:3])
    try:
        return int(data.split("\n", 1)[0].strip())
    except ValueError:
        return 0


def _cif_value(v):
    v = str(v)
    if v == "":
        return "."
    if re.search(r"[\s'\"]", v) or v[0] in "_#$;[]" or v in (".", "?"):
        return '"%s"' % v if '"' not in v else "'%s'" % v
    return v


def topology_cif(atoms, coords, name="trajectory"):
    """mmCIF text for one frame: atoms is a list of
    (element, atom name, residue name, chain, residue number, hetero) and
    coords the matching (x, y, z) positions in Angstrom."""
    out = ["data_" + (re.sub(r"\W", "_", name) or "structure"), "#", "loop_"]
    for f in ("group_PDB", "id", "type_symbol", "label_atom_id", "label_comp_id", "label_asym_id",
              "label_seq_id", "Cartn_x", "Cartn_y", "Cartn_z", "auth_seq_id", "auth_asym_id",
              "pdbx_PDB_model_num"):
        out.append("_atom_site.%s" % f)
    for i, ((el, atom, res, chain, seq, het), (x, y, z)) in enumerate(zip(atoms, coords)):
        out.append("%s %d %s %s %s %s %d %.3f %.3f %.3f %d %s 1" % (
            "HETATM" if het else "ATOM", i + 1, _cif_value(el or "X"), _cif_value(atom), _cif_value(res),
            _cif_value(chain or "A"), int(seq), x, y, z, int(seq), _cif_value(chain or "A")))
    out.append("#")
    return "\n".join(out) + "\n"


def coordinates_bytes(frames):
    """Little-endian float32 bytes of an (nframes, natoms, 3) array in Angstrom."""
    import numpy as np
    arr = np.ascontiguousarray(np.asarray(frames, dtype="<f4"))
    if arr.ndim != 3 or arr.shape[2] != 3:
        raise ValueError("coordinates must have shape (frames, atoms, 3)")
    return arr.tobytes()


_PROTEIN = set("ALA ARG ASN ASP CYS GLN GLU GLY HIS HID HIE HIP HSD HSE HSP ILE LEU LYS MET PHE PRO SER THR "
               "TRP TYR VAL CYX ASH GLH LYN ACE NME NMA".split())
_NUCLEIC = set("A C G U T DA DC DG DT DU RA RC RG RU A3 A5 C3 C5 G3 G5 U3 U5 DA3 DA5 DC3 DC5 DG3 DG5 "
               "DT3 DT5".split())


def _chain_name(k):
    """A, B, ..., Z, AA, AB, ... for chain number k (0-based)."""
    name = ""
    k += 1
    while k:
        k, r = divmod(k - 1, 26)
        name = chr(65 + r) + name
    return name


def _guess_element(name):
    letters = re.sub(r"[^A-Za-z]", "", name)
    return letters[:1].upper() or "X"


def from_mdtraj(traj, stride=1):
    """(mmCIF topology text, coordinate bytes) of an mdtraj.Trajectory."""
    atoms = []
    for a in traj.topology.atoms:
        r = a.residue
        chain = getattr(r.chain, "chain_id", None) or _chain_name(r.chain.index)
        element = a.element.symbol if a.element is not None else _guess_element(a.name)
        atoms.append((element, a.name, r.name, chain, r.resSeq,
                      not (r.is_protein or r.is_nucleic or r.name in _PROTEIN or r.name in _NUCLEIC)))
    xyz = traj.xyz[::max(1, int(stride))] * 10.0     # nm -> Angstrom
    return topology_cif(atoms, xyz[0], "mdtraj"), coordinates_bytes(xyz), len(xyz)


def from_mdanalysis(obj, start=None, stop=None, step=None):
    """(mmCIF topology text, coordinate bytes) of an MDAnalysis Universe or
    AtomGroup, over trajectory[start:stop:step]."""
    group = obj.atoms
    universe = group.universe
    names = group.names
    elements = getattr(group, "elements", None) if hasattr(group, "elements") else None
    chains = None
    for attr in ("chainIDs", "segids"):
        if hasattr(group, attr):
            chains = getattr(group, attr)
            break
    resnames, resids = group.resnames, group.resids
    atoms = []
    for i in range(len(group)):
        el = str(elements[i]).strip().capitalize() if elements is not None else ""
        chain = str(chains[i]).strip() if chains is not None else ""
        res = str(resnames[i])
        atoms.append((el or _guess_element(names[i]), str(names[i]), res, chain or "A", int(resids[i]),
                      res not in _PROTEIN and res not in _NUCLEIC))
    frames = [group.positions.copy() for _ in universe.trajectory[start:stop:step]]
    if not frames:
        raise ValueError("the trajectory slice has no frames")
    return topology_cif(atoms, frames[0], "mdanalysis"), coordinates_bytes(frames), len(frames)
