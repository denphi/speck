"""Structure loaders. Each returns keyword arguments for stspeck.speck():

    stspeck.speck(**stspeck.fetch_pdb("4HHB"), highlight={"resName": "HEM"})

Wrap network loaders in st.cache_data to avoid downloading on every rerun.
"""

import json
import re
import urllib.request


def count_frames(data):
    """Number of frames in XYZ (repeated blocks) or PDB (MODEL records) text,
    e.g. for the range of a frame slider."""
    if re.search(r"^(ATOM  |HETATM)", data, re.M):
        return max(1, len(re.findall(r"^ENDMDL", data, re.M)))
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


def _extxyz(frames):
    """Extended XYZ text from [(symbols, positions, lattice or None), ...]."""
    out = []
    for symbols, positions, lattice in frames:
        comment = "Properties=species:S:1:pos:R:3"
        if lattice is not None:
            flat = " ".join("%.8f" % v for row in lattice for v in row)
            comment = 'Lattice="%s" %s' % (flat, comment)
        out.append(str(len(symbols)))
        out.append(comment)
        for s, (x, y, z) in zip(symbols, positions):
            out.append("%s %.6f %.6f %.6f" % (s, x, y, z))
    return "\n".join(out) + "\n"


def read_file(path):
    """A .pdb, .ent, .xyz or .extxyz file (optionally .gz)."""
    if str(path).endswith(".gz"):
        import gzip
        with gzip.open(path, "rt") as f:
            return {"data": f.read()}
    with open(path) as f:
        return {"data": f.read()}


def fetch_pdb(pdb_id):
    """An RCSB PDB entry (e.g. "1UBQ"), shown as a cartoon."""
    url = "https://files.rcsb.org/download/%s.pdb" % pdb_id.upper()
    with urllib.request.urlopen(url) as r:
        return {"data": r.read().decode(), "cartoon": True}


def fetch_alphafold(uniprot_id):
    """The latest AlphaFold DB model of a UniProt accession, shown as a cartoon
    colored by confidence (pLDDT)."""
    api = "https://alphafold.ebi.ac.uk/api/prediction/%s" % uniprot_id
    with urllib.request.urlopen(api) as r:
        entry = json.load(r)[0]
    with urllib.request.urlopen(entry["pdbUrl"]) as r:
        return {"data": r.read().decode(), "cartoon": True, "cartoonColor": "plddt"}


def from_ase(atoms):
    """An ase.Atoms object or a list of them (trajectory). Periodic
    structures show their unit cell."""
    frames = atoms if isinstance(atoms, (list, tuple)) else [atoms]
    periodic = any(a.pbc.any() and a.cell.volume > 0 for a in frames)
    data = _extxyz([
        (a.get_chemical_symbols(), a.get_positions(),
         a.cell.array.tolist() if a.pbc.any() and a.cell.volume > 0 else None)
        for a in frames
    ])
    return {"data": data, "unitCell": periodic}


def from_rdkit(mol, conf_id=-1):
    """An RDKit molecule with 3D coordinates (a conformer)."""
    if mol.GetNumConformers() == 0:
        raise ValueError("the molecule has no 3D coordinates; add them with "
                         "rdkit.Chem.AllChem.EmbedMolecule(mol) first")
    conf = mol.GetConformer(conf_id)
    symbols = [a.GetSymbol() for a in mol.GetAtoms()]
    positions = [tuple(conf.GetAtomPosition(i)) for i in range(mol.GetNumAtoms())]
    return {"data": _extxyz([(symbols, positions, None)])}


def from_pymatgen(structure):
    """A pymatgen Structure (with its unit cell) or Molecule."""
    symbols = [site.specie.symbol for site in structure]
    positions = [tuple(site.coords) for site in structure]
    lattice = getattr(structure, "lattice", None)
    cell = lattice.matrix.tolist() if lattice is not None else None
    return {"data": _extxyz([(symbols, positions, cell)]), "unitCell": cell is not None}
