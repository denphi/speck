"""Structure loaders. Each returns keyword arguments for stspeck.speck():

    stspeck.speck(**stspeck.fetch_pdb("4HHB"), highlight={"resName": "HEM"})

Wrap network loaders in st.cache_data to avoid downloading on every rerun.
"""

import json
import urllib.request

from . import _formats


def count_frames(data, trajectory=None):
    """Number of frames in structure text (mmCIF or PDB models, SDF
    conformers, XYZ blocks) or in a trajectory for it (from from_mdtraj /
    from_mdanalysis), e.g. for the range of a frame slider."""
    if trajectory:
        return max(1, len(trajectory) // (12 * max(1, _formats.count_atoms(data))))
    return _formats.count_frames(data)


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
    """A structure file: PDB (.pdb, .ent), mmCIF (.cif, .mmcif), MDL Molfile /
    SDF (.mol, .sdf, with their bonds) or XYZ / extended XYZ, optionally .gz.
    The format is detected from the content."""
    return {"data": _formats.read_text(path)}


def fetch_pdb(pdb_id, format="cif", assembly=None):
    """An RCSB PDB entry (e.g. "1UBQ"), shown as a cartoon. Downloaded as
    mmCIF, which exists for every entry, including large complexes with no
    PDB file; format="pdb" gets the legacy PDB file. assembly=1 (2, ...)
    loads that biological assembly, e.g. a complete virus capsid:
    fetch_pdb("1STM", assembly=1)."""
    if format not in ("cif", "pdb"):
        raise ValueError("format must be 'cif' or 'pdb'")
    if assembly is None:
        url = "https://files.rcsb.org/download/%s.%s" % (pdb_id.upper(), format)
    elif format != "cif":
        raise ValueError("assemblies are available as mmCIF only (format='cif')")
    else:
        url = "https://files.rcsb.org/download/%s-assembly%d.cif" % (pdb_id.upper(), int(assembly))
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
    """An RDKit molecule with 3D coordinates (a conformer), drawn with the
    molecule's own bonds."""
    if mol.GetNumConformers() == 0:
        raise ValueError("the molecule has no 3D coordinates; add them with "
                         "rdkit.Chem.AllChem.EmbedMolecule(mol) first")
    from rdkit import Chem
    return {"data": Chem.MolToMolBlock(mol, confId=conf_id, forceV3000=mol.GetNumAtoms() > 999)}


def from_mdtraj(traj, stride=1):
    """An mdtraj.Trajectory (every `stride`-th frame), shown as a cartoon:
    the topology as mmCIF plus the frames as binary coordinates."""
    data, coords, _ = _formats.from_mdtraj(traj, stride)
    return {"data": data, "trajectory": coords, "cartoon": True}


def from_mdanalysis(obj, start=None, stop=None, step=None):
    """An MDAnalysis Universe or AtomGroup over trajectory[start:stop:step],
    shown as a cartoon."""
    data, coords, _ = _formats.from_mdanalysis(obj, start, stop, step)
    return {"data": data, "trajectory": coords, "cartoon": True}


def from_pymatgen(structure):
    """A pymatgen Structure (with its unit cell) or Molecule."""
    symbols = [site.specie.symbol for site in structure]
    positions = [tuple(site.coords) for site in structure]
    lattice = getattr(structure, "lattice", None)
    cell = lattice.matrix.tolist() if lattice is not None else None
    return {"data": _extxyz([(symbols, positions, cell)]), "unitCell": cell is not None}
