import gzip
import io
import json
import os
import re
import urllib.request
import uuid

import warnings

import ipywidgets as widgets
from traitlets import Unicode, Bool, Bytes, Float, Int, Enum, Dict, observe, validate, TraitError

from . import _formats
from . import shots as _shots
from ._version import __version__


_MESH_SCHEMES = ('ss', 'chain', 'entity', 'type', 'rainbow', 'plddt')
_PALETTES = ('default', 'goodsell', 'pastel', 'colorblind', 'viridis', 'grays')
_HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
_COLOR_SCHEMES = ('speck', 'jmol', 'rasmol', 'newcpk')
_SELECTION_KEYS = ('index', 'chain', 'resName', 'resSeq', 'name', 'element', 'ligands')

# Named looks for apply_preset(). Every preset starts from 'default', so
# switching presets never leaves settings from the previous one behind.
PRESETS = {
    'default': dict(ao=0.75, brightness=0.5, atomShade=0.5, bondShade=0.5, cartoonShade=0.2,
                    surfaceShade=0.1, outline=0.0, outlineWidth=1.0, outlineColor='#000000',
                    specular=0.0, gloss=0.5, metallic=0.0, metallicAtoms='all', shadows=0.0,
                    rim=0.0, fog=0.0, fogColor='#ffffff', saturation=1.0, tonemap=False, dofStrength=0.0,
                    surfaceOpacity=1.0, surfaceColor='element', atomColor='element', palette='default',
                    water=True,
                    outlineMode='depth'),
    'matte': dict(ao=0.9, brightness=0.55),
    'glossy': dict(specular=0.6, gloss=0.65, rim=0.2, tonemap=True),
    'toon': dict(ao=0.3, outline=1.0, outlineWidth=1.5, atomShade=0.3, cartoonShade=0.1),
    'cover': dict(ao=1.0, brightness=0.55, specular=0.5, gloss=0.6, shadows=0.6, rim=0.35,
                  fog=0.35, saturation=1.15, tonemap=True, outline=0.2, atomShade=0.25,
                  cartoonShade=0.05),
    'metal': dict(metallic=1.0, metallicAtoms='metals', gloss=0.75, specular=0.6, atomShade=0.1,
                  tonemap=True),
    'glass': dict(surface=True, surfaceOpacity=0.35, surfaceColor='#e8e4dc', specular=0.4,
                  gloss=0.7, cartoon=True),
    # After David Goodsell's illustrations: space-filling atoms in flat
    # pastel colors per chain, outlined between molecules.
    'goodsell': dict(ao=0.3, brightness=0.82, atomShade=0.0, outline=1.0, outlineWidth=0.9, fog=0.4,
                     fogColor='#000000',
                     outlineColor='#141414', outlineMode='molecules', atomColor='chain',
                     palette='goodsell', cartoon=False, surface=False, bonds=False, water=False,
                     atomScale=0.7, relativeAtomScale=1.0),
}


def _rcsb_url(pdb_id, format='cif', assembly=None):
    """Download URL of an RCSB entry or of one of its biological assemblies."""
    if format not in ('cif', 'pdb'):
        raise ValueError("format must be 'cif' or 'pdb'")
    if assembly is None:
        return 'https://files.rcsb.org/download/%s.%s' % (pdb_id.upper(), format)
    if format != 'cif':
        raise ValueError("assemblies are available as mmCIF only (format='cif')")
    return 'https://files.rcsb.org/download/%s-assembly%d.cif' % (pdb_id.upper(), int(assembly))


_frontend_checked = False


def _check_frontend():
    """Warn (once) when Jupyter will serve a browser extension of another
    ipyspeck version than this Python package, e.g. an old copy left in
    ~/.local/share/jupyter by an earlier `pip install --user`. Jupyter uses
    the first copy on its data path, so a stale one hides the new version."""
    global _frontend_checked
    if _frontend_checked:
        return
    _frontend_checked = True
    try:
        from jupyter_core.paths import jupyter_path
    except ImportError:
        return
    stale = []
    for kind, name, pattern, ui in (
            ('nbextensions', 'index.js', r'"name":"ipyspeck","version":"([^"]+)"', 'Notebook 6'),
            ('labextensions', 'package.json', r'"version"\s*:\s*"([^"]+)"', 'JupyterLab / Notebook 7')):
        for folder in jupyter_path(kind):
            path = os.path.join(folder, 'ipyspeck', name)
            if not os.path.isfile(path):
                continue
            try:
                with open(path, encoding='utf-8', errors='replace') as f:
                    match = re.search(pattern, f.read())
            except OSError:
                break
            version = match.group(1) if match else 'unknown'
            if version != __version__:
                stale.append('  %s: ipyspeck %s in %s' % (ui, version, os.path.dirname(path)))
            break  # the first copy found is the one Jupyter serves
    if stale:
        warnings.warn(
            'ipyspeck %s is installed, but Jupyter will load a different browser extension:\n%s\n'
            'The viewer will run that older code. Delete (or upgrade) that folder, then restart '
            'the Jupyter server and reload the page.' % (__version__, '\n'.join(stale)),
            stacklevel=3)


def _extxyz(frames):
    """Extended XYZ text from [(symbols, positions, lattice or None), ...]."""
    out = []
    for symbols, positions, lattice in frames:
        comment = 'Properties=species:S:1:pos:R:3'
        if lattice is not None:
            flat = ' '.join('%.8f' % v for row in lattice for v in row)
            comment = 'Lattice="%s" %s' % (flat, comment)
        out.append(str(len(symbols)))
        out.append(comment)
        for s, (x, y, z) in zip(symbols, positions):
            out.append('%s %.6f %.6f %.6f' % (s, x, y, z))
    return '\n'.join(out) + '\n'


@widgets.register
class Speck(widgets.DOMWidget):
    """
    Speck molecule viewer: ambient-occlusion rendering of atoms, bonds,
    cartoons and molecular surfaces.

    Every attribute below can be passed to the constructor and changed later;
    the view updates live. Works with ipywidgets 7 and 8.

    Example
    -------
    >>> Speck(data=open("1ubq.pdb").read(), cartoon=True, surface=True,
    ...       surfaceOpacity=0.35)
    >>> Speck.from_alphafold("Q8W3K0")
    >>> w.apply_preset("cover"); w.save_image("figure.png", width=3000)

    Attributes
    ----------
    data : str
        Structure text: PDB, mmCIF, MDL Molfile / SDF or XYZ / extended XYZ,
        detected from the content. PDB and mmCIF enable cartoon and surface;
        bonds listed in the file (CONECT, _struct_conn, Molfile bonds) are
        always drawn. Several frames (XYZ blocks, PDB or mmCIF models, SDF
        conformers) form a trajectory.
    toolbar : bool
        Show the toolbar (styles, cartoon / surface / ligand toggles, views,
        colors and PNG snapshot), default(True)
    camera : dict
        Current camera {rotation, translation, zoom}, updated when you rotate
        or zoom. Assign a saved value to restore a view exactly.

    Atoms and bonds

    bonds : bool
        Draw bonds, default(True)
    atomScale : float
        Atom radius, size of spheres, default(0.24)
    relativeAtomScale : float
        How much element radii differ (0 = all equal, 1 = element radii),
        default(0.64)
    bondScale : float
        Bond radius relative to atoms, default(0.5)
    bondThreshold : float
        Bonding radius, defines the max distance for atoms to be connected,
        default(1.2)
    bondShade : float
        Blend of bond colors toward white, default(0.5)
    atomShade : float
        Blend of atom colors toward white, default(0.5)
    ligands : bool
        Show ligands (non-polymer, non-water PDB residues), default(True)
    water : bool
        Show water molecules, default(True)
    cutaway : float
        Slice away the front of the structure to show its inside [0 - 1]:
        0 cuts nothing, 0.5 cuts through the center; the plane faces the
        camera and cut atoms and surfaces are capped, default(0.0)
    cutawayAxis : str
        Cut plane: 'view' (facing the camera) or fixed across the molecule's
        'x', 'y' or 'z' axis, so rotating shows the cut from the side,
        default('view')
    cutawayLight : float
        Light entering through the cut [0 - 1]: brightens the cut faces and
        the inside near them, default(0.5)

    Colors

    colorScheme : str
        Element palette: 'speck', 'jmol', 'rasmol' or 'newcpk'; the toolbar's
        color menu sets it, default('speck')
    atomColors : dict
        Per-element colors on top of the palette, as '#rrggbb' or [r, g, b]
        in 0 - 1, e.g. {"Au": "#ffcc33", "S": [0.9, 0.8, 0.2]}, default({})
    atomColor : str
        Atom coloring: 'element', or by residue like cartoons: 'chain',
        'entity' (every copy of a molecule alike), 'type' (protein / nucleic
        acid), 'ss', 'rainbow'; heteroatoms stay a shade darker,
        default('element')
    palette : str
        Colors for chain, entity and type coloring: 'default', 'goodsell',
        'pastel', 'colorblind', 'viridis' or 'grays', default('default')

    Highlighting

    highlight : dict
        Atoms to highlight; keys are combined with AND, list values with OR:
        index (0-based atom index), chain, resName, resSeq (numbers or
        "10-20" ranges), name (atom name), element, ligands (bool).
        Example: {"chain": "A", "resSeq": ["40-60"]}. Empty = none.
    highlightColor : str
        '#rrggbb' color for highlighted atoms and residues ('' keeps their
        colors), default('')
    highlightScale : float
        Size factor for highlighted atoms, default(1.0)
    ghost : float
        Fade everything that is not highlighted toward white [0 - 1],
        default(0.0)

    Lighting and effects

    ao : float
        Ambient occlusion strength [0 - 1], default(0.75)
    aoRes : int
        Ambient occlusion resolution (256, 512, 1024...); higher gives finer
        contact shadows, default(256)
    aoSamples : int
        Ambient occlusion samples to converge (at most 1024), default(1024)
    spf : float
        Ambient occlusion samples per frame (0 disables AO), default(32)
    brightness : float
        Brightness [0 - 1], default(0.5)
    shadows : float
        Shadows cast by the key light (upper left) [0 - 1], default(0.0)
    shadowSoftness : float
        Shadow edge softness, default(1.5)
    rim : float
        Rim light along silhouettes [0 - 2], default(0.0)
    fog : float
        Depth cue: fade the back of the structure toward fogColor [0 - 1],
        default(0.0)
    fogColor : str
        '#rrggbb' fog color (match the background), default('#ffffff')
    saturation : float
        Color saturation (1 = unchanged), default(1.0)
    tonemap : bool
        Roll off bright highlights instead of clipping them, default(False)
    outline : float
        Outline strength [0 - 1], default(0.0)
    outlineWidth : float
        Outline width (1 = default thickness), default(1.0)
    outlineColor : str
        '#rrggbb' outline color, default('#000000')
    outlineMode : str
        'depth' outlines every depth step; 'molecules' only the edges
        between molecules (colors) and silhouettes, as in illustrations,
        default('depth')
    floor : float
        Studio floor [0 - 1]: a soft contact shadow under the molecule, on
        any background (0 = off), default(0.0)
    floorReflection : float
        Reflection of the molecule in the floor [0 - 1], default(0.3)
    fxaa : int
        Anti-aliasing passes, default(1)
    dofStrength : float
        Depth of field strength [0 - 3]. The blur grows with the distance to
        the focal plane and with zoom, like a macro lens: zoom in on a detail
        with 1 - 2 for a macro-photography look, default(0.0)
    dofPosition : float
        Focal depth [0 - 1] (front to back of the scene), default(0.5)
    dofFocus : dict
        Keep a selection in focus instead of dofPosition, e.g.
        {"resName": "HEM"}; same keys as highlight, default({})

    Materials

    specular : float
        Strength of the key-light highlight [0 - 1], default(0.0)
    gloss : float
        Surface smoothness [0 - 1]; higher gives tighter highlights and
        sharper reflections, default(0.5)
    metallic : float
        Metallic reflection [0 - 1]: surfaces reflect a studio environment
        tinted by their own color, default(0.0)
    metallicAtoms : str
        'all' applies metallic to everything, 'metals' only to metal
        elements (e.g. a shiny Au core with matte ligands), default('all')

    Cartoon (PDB input)

    cartoon : bool
        Show proteins / nucleic acids as a cartoon, default(False)
    cartoonColor : str
        'ss' (secondary structure), 'chain', 'rainbow', 'plddt' (AlphaFold
        confidence from the B-factor column) or a '#rrggbb' color,
        default('ss')
    cartoonAtoms : str
        Polymer atoms drawn with the cartoon or surface: 'ligands' (none),
        'sidechains', 'all' or 'none' (also hides ligands),
        default('ligands')
    cartoonHelixWidth : float
        Helix ribbon width in Angstrom, default(2.6)
    cartoonSheetWidth : float
        Strand width in Angstrom (arrow heads are 1.6x wider), default(2.4)
    cartoonThickness : float
        Helix and strand thickness in Angstrom, default(0.6)
    cartoonTubeRadius : float
        Coil tube radius in Angstrom, default(0.3)
    cartoonQuality : int
        Spline samples per residue, default(8)
    cartoonShade : float
        Blend of cartoon colors toward white, default(0.2)

    Surface (PDB input; XYZ input wraps all atoms)

    surface : bool
        Show the molecular (solvent-excluded) surface, default(False)
    surfaceColor : str
        'element', 'ss', 'chain', 'rainbow', 'plddt' or a '#rrggbb' color,
        default('element')
    surfaceAtoms : str
        'polymer' wraps protein / nucleic acid only (ligands stay visible
        as atoms), 'all' includes ligands, default('polymer')
    surfaceProbe : float
        Solvent probe radius in Angstrom, default(1.4)
    surfaceResolution : float
        Grid spacing in Angstrom; smaller is smoother and slower. Very large
        systems are coarsened automatically, default(0.5)
    surfaceShade : float
        Blend of surface colors toward white, default(0.1)
    surfaceOpacity : float
        Surface opacity [0 - 1]; below 1 the cartoon and ligands show
        through, and the surface keeps its own ambient occlusion,
        default(1.0)

    Unit cell and trajectory

    unitCell : bool
        Draw the unit cell (extended XYZ Lattice or PDB CRYST1),
        default(False; the ASE and pymatgen loaders turn it on)
    cellColor : str
        '#rrggbb' cell color, default('#666666')
    cellRadius : float
        Cell edge radius in Angstrom, default(0.12)
    frame : int
        Trajectory frame shown, default(0)
    nframes : int
        Number of frames in data (read only)
    autoRotate : bool
        Spin the molecule about the vertical axis (toolbar toggle),
        default(False)

    Methods
    -------
    save_image(filename, width=None, height=None, scale=2, ...)
        High-resolution PNG rendered in the browser, saved from Python
    save_animation(filename, frames=60, mode='turntable', ...)
        Turntable or trajectory animation as GIF, MP4 or PNG frames
    apply_preset(name)
        Named look: default, matte, glossy, toon, cover, metal, glass
    trajectory_controls()
        Play button and slider linked to frame
    from_file(), from_pdb_id(), from_alphafold(), from_ase(), from_rdkit(),
    from_pymatgen(), from_mdtraj(), from_mdanalysis()
        Create a viewer from a file, a database entry or a Python structure
    set_trajectory(coordinates)
        Frames (frames, atoms, 3) for the current structure
    frontview(), topview(), rightview(), center()
        Standard views and fit
    snapshot()
        Download the on-screen image as PNG in the browser
    setAtomColor(atom, color), setAtomsColor(atoms)
        Add element colors to atomColors
    setColorSchema(schema), switchColorSchema()
        Change colorScheme (and clear atomColors)
    """

    _view_name = Unicode('SpeckView').tag(sync=True)
    _model_name = Unicode('SpeckModel').tag(sync=True)
    _view_module = Unicode('ipyspeck').tag(sync=True)
    _model_module = Unicode('ipyspeck').tag(sync=True)
    _view_module_version = Unicode('^0.8.3').tag(sync=True)
    _model_module_version = Unicode('^0.8.3').tag(sync=True)

    data = Unicode('')
    # `data` reaches the browser gzipped, as a binary buffer (a 28 MB mmCIF
    # ribosome travels as about 7 MB, without JSON escaping).
    _data = Bytes(b'').tag(sync=True)
    # Frames from set_trajectory(): float32 x, y, z of every atom, frame after frame.
    _trajectory = Bytes(b'').tag(sync=True)
    toolbar = Bool(True).tag(sync=True)
    camera = Dict().tag(sync=True)

    # atoms and bonds
    bonds = Bool(True).tag(sync=True)
    atomScale = Float(0.24).tag(sync=True)
    relativeAtomScale = Float(0.64).tag(sync=True)
    bondScale = Float(0.5).tag(sync=True)
    bondThreshold = Float(1.2).tag(sync=True)
    bondShade = Float(0.5).tag(sync=True)
    atomShade = Float(0.5).tag(sync=True)
    ligands = Bool(True).tag(sync=True)

    # colors
    colorScheme = Enum(_COLOR_SCHEMES, default_value='speck').tag(sync=True)
    atomColors = Dict().tag(sync=True)
    atomColor = Unicode('element').tag(sync=True)
    palette = Enum(_PALETTES, default_value='default').tag(sync=True)

    # highlighting
    highlight = Dict().tag(sync=True)
    highlightColor = Unicode('').tag(sync=True)
    highlightScale = Float(1.0).tag(sync=True)
    ghost = Float(0.0).tag(sync=True)

    # lighting and effects
    ao = Float(0.75).tag(sync=True)
    aoRes = Int(256, min=16, max=4096).tag(sync=True)
    aoSamples = Int(1024, min=1, max=1024).tag(sync=True)
    spf = Float(32).tag(sync=True)
    brightness = Float(0.5).tag(sync=True)
    outline = Float(0.0).tag(sync=True)
    outlineWidth = Float(1.0).tag(sync=True)
    outlineColor = Unicode('#000000').tag(sync=True)
    shadows = Float(0.0).tag(sync=True)
    shadowSoftness = Float(1.5).tag(sync=True)
    rim = Float(0.0).tag(sync=True)
    fog = Float(0.0).tag(sync=True)
    fogColor = Unicode('#ffffff').tag(sync=True)
    saturation = Float(1.0).tag(sync=True)
    tonemap = Bool(False).tag(sync=True)
    outlineMode = Enum(['depth', 'molecules'], default_value='depth').tag(sync=True)
    floor = Float(0.0, min=0.0, max=1.0).tag(sync=True)
    floorReflection = Float(0.3, min=0.0, max=1.0).tag(sync=True)
    fxaa = Int(1, min=0, max=8).tag(sync=True)
    dofStrength = Float(0.0).tag(sync=True)
    dofPosition = Float(0.5).tag(sync=True)
    dofFocus = Dict().tag(sync=True)

    # materials
    specular = Float(0.0).tag(sync=True)
    gloss = Float(0.5).tag(sync=True)
    metallic = Float(0.0).tag(sync=True)
    metallicAtoms = Enum(['all', 'metals'], default_value='all').tag(sync=True)

    # cartoon
    cartoon = Bool(False).tag(sync=True)
    cartoonColor = Unicode('ss').tag(sync=True)
    cartoonAtoms = Enum(
        ['ligands', 'sidechains', 'all', 'none'], default_value='ligands'
    ).tag(sync=True)
    cartoonHelixWidth = Float(2.6).tag(sync=True)
    cartoonSheetWidth = Float(2.4).tag(sync=True)
    cartoonThickness = Float(0.6).tag(sync=True)
    cartoonTubeRadius = Float(0.3).tag(sync=True)
    cartoonQuality = Int(8, min=2, max=32).tag(sync=True)
    cartoonShade = Float(0.2).tag(sync=True)

    # surface
    surface = Bool(False).tag(sync=True)
    surfaceColor = Unicode('element').tag(sync=True)
    surfaceAtoms = Enum(['polymer', 'all'], default_value='polymer').tag(sync=True)
    surfaceProbe = Float(1.4).tag(sync=True)
    surfaceResolution = Float(0.5).tag(sync=True)
    surfaceShade = Float(0.1).tag(sync=True)
    surfaceOpacity = Float(1.0, min=0.0, max=1.0).tag(sync=True)

    # unit cell and trajectory
    unitCell = Bool(False).tag(sync=True)
    water = Bool(True).tag(sync=True)
    cutaway = Float(0.0, min=0.0, max=1.0).tag(sync=True)
    cutawayAxis = Enum(['view', 'x', 'y', 'z'], default_value='view').tag(sync=True)
    cutawayLight = Float(0.5, min=0.0, max=1.0).tag(sync=True)
    cellColor = Unicode('#666666').tag(sync=True)
    cellRadius = Float(0.12).tag(sync=True)
    frame = Int(0, min=0).tag(sync=True)
    nframes = Int(1, read_only=True).tag(sync=True)

    # interaction
    autoRotate = Bool(False).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        _check_frontend()
        self._requests = {}
        self.last_image = None
        self.on_msg(self._on_frontend_msg)

    # --- validation ---------------------------------------------------------

    @validate('cartoonColor', 'surfaceColor')
    def _valid_mesh_color(self, proposal):
        value = proposal['value']
        schemes = _MESH_SCHEMES
        if proposal['trait'].name == 'surfaceColor':
            schemes += ('element',)
        if value in schemes or _HEX.match(value):
            return value
        raise TraitError(
            "%s must be one of %s or '#rrggbb'"
            % (proposal['trait'].name, ', '.join(schemes))
        )

    @validate('atomColor')
    def _valid_atom_color(self, proposal):
        value = proposal['value']
        schemes = ('element',) + tuple(s for s in _MESH_SCHEMES if s != 'plddt')
        if value in schemes or _HEX.match(value):
            return value
        raise TraitError("atomColor must be one of %s or '#rrggbb'" % ', '.join(schemes))

    @validate('outlineColor', 'fogColor', 'cellColor', 'highlightColor')
    def _valid_hex(self, proposal):
        value = proposal['value']
        if _HEX.match(value) or (value == '' and proposal['trait'].name == 'highlightColor'):
            return value
        raise TraitError("%s must be a '#rrggbb' color" % proposal['trait'].name)

    @validate('atomColors')
    def _valid_atom_colors(self, proposal):
        colors = {}
        for atom, color in proposal['value'].items():
            if not isinstance(atom, str):
                raise TraitError("atomColors keys must be element symbols, got %r" % (atom,))
            if isinstance(color, str):
                if not _HEX.match(color):
                    raise TraitError("atomColors[%r] must be '#rrggbb' or [r, g, b], got %r" % (atom, color))
                colors[atom] = color
            else:
                try:
                    rgb = [float(c) for c in color]
                except (TypeError, ValueError):
                    rgb = []
                if len(rgb) != 3 or not all(0 <= c <= 1 for c in rgb):
                    raise TraitError("atomColors[%r] must be '#rrggbb' or [r, g, b] in 0 - 1, got %r"
                                     % (atom, color))
                colors[atom] = rgb
        return colors

    @validate('highlight', 'dofFocus')
    def _valid_selection(self, proposal):
        unknown = set(proposal['value']) - set(_SELECTION_KEYS)
        if unknown:
            raise TraitError(
                "unknown %s keys %s; use %s"
                % (proposal['trait'].name, sorted(unknown), ', '.join(_SELECTION_KEYS))
            )
        return proposal['value']

    @observe('data')
    def _data_changed(self, change):
        self._data = gzip.compress(change['new'].encode('utf-8'), compresslevel=3, mtime=0)
        self._trajectory = b''   # frames belong to the previous structure
        self.set_trait('nframes', _formats.count_frames(change['new']))
        if self.frame >= self.nframes:
            self.frame = 0

    # --- constructors -------------------------------------------------------

    @classmethod
    def from_file(cls, path, **kwargs):
        """Viewer for a structure file: PDB (.pdb, .ent), mmCIF (.cif,
        .mmcif), MDL Molfile / SDF (.mol, .sdf, with their bonds) or XYZ /
        extended XYZ (.xyz, .extxyz), optionally gzipped (.gz). The format is
        detected from the content."""
        return cls(data=_formats.read_text(path), **kwargs)

    @classmethod
    def from_pdb_id(cls, pdb_id, format='cif', assembly=None, **kwargs):
        """Viewer for an RCSB PDB entry (e.g. "1UBQ"), shown as a cartoon.

        The entry is downloaded as mmCIF, which exists for every entry,
        including large complexes (ribosomes, viral capsids) that have no PDB
        file; pass format='pdb' for the legacy PDB file.

        assembly=1 (2, ...) loads that biological assembly instead of the
        deposited coordinates, e.g. the complete 60-copy capsid of a virus
        whose file holds a single copy: Speck.from_pdb_id("1STM", assembly=1)."""
        url = _rcsb_url(pdb_id, format, assembly)
        with urllib.request.urlopen(url) as r:
            data = r.read().decode()
        kwargs.setdefault('cartoon', True)
        return cls(data=data, **kwargs)

    @classmethod
    def from_alphafold(cls, uniprot_id, **kwargs):
        """Viewer for the latest AlphaFold DB model of a UniProt accession,
        shown as a cartoon colored by confidence (pLDDT)."""
        api = 'https://alphafold.ebi.ac.uk/api/prediction/%s' % uniprot_id
        with urllib.request.urlopen(api) as r:
            entry = json.load(r)[0]
        with urllib.request.urlopen(entry['pdbUrl']) as r:
            data = r.read().decode()
        kwargs.setdefault('cartoon', True)
        kwargs.setdefault('cartoonColor', 'plddt')
        return cls(data=data, **kwargs)

    @classmethod
    def from_mdtraj(cls, traj, stride=1, **kwargs):
        """Viewer for an mdtraj.Trajectory (every `stride`-th frame), shown as a
        cartoon. The topology keeps residues and chains; the frames are sent
        as binary coordinates, e.g. mdtraj.load("run.xtc", top="system.gro")."""
        data, coords, _ = _formats.from_mdtraj(traj, stride)
        kwargs.setdefault('cartoon', True)
        w = cls(data=data, **kwargs)
        w._set_coordinates(coords)
        return w

    @classmethod
    def from_mdanalysis(cls, obj, start=None, stop=None, step=None, **kwargs):
        """Viewer for an MDAnalysis Universe or AtomGroup over
        trajectory[start:stop:step], shown as a cartoon, e.g.
        Speck.from_mdanalysis(u.select_atoms("protein"), step=10)."""
        data, coords, _ = _formats.from_mdanalysis(obj, start, stop, step)
        kwargs.setdefault('cartoon', True)
        w = cls(data=data, **kwargs)
        w._set_coordinates(coords)
        return w

    def set_trajectory(self, coordinates):
        """Frames for the current structure: an array of shape (frames, atoms,
        3) in Angstrom, atoms in the order of `data`. Set `frame` (or use
        trajectory_controls()) to move through them."""
        import numpy as np
        arr = np.asarray(coordinates, dtype='<f4')
        natoms = _formats.count_atoms(self.data)
        if arr.ndim != 3 or arr.shape[2] != 3 or arr.shape[1] != natoms:
            raise ValueError('coordinates must have shape (frames, %d, 3) for this structure, got %s'
                             % (natoms, arr.shape))
        self._set_coordinates(_formats.coordinates_bytes(arr))

    def _set_coordinates(self, coords):
        natoms = _formats.count_atoms(self.data)
        with self.hold_trait_notifications():
            self._trajectory = coords
            self.set_trait('nframes', max(1, len(coords) // (12 * max(1, natoms))))
            if self.frame >= self.nframes:
                self.frame = 0

    @classmethod
    def from_ase(cls, atoms, **kwargs):
        """Viewer for an ase.Atoms object or a list of them (trajectory).
        Periodic structures show their unit cell."""
        frames = atoms if isinstance(atoms, (list, tuple)) else [atoms]
        periodic = any(a.pbc.any() and a.cell.volume > 0 for a in frames)
        data = _extxyz([
            (a.get_chemical_symbols(), a.get_positions(),
             a.cell.array.tolist() if a.pbc.any() and a.cell.volume > 0 else None)
            for a in frames
        ])
        kwargs.setdefault('unitCell', periodic)
        return cls(data=data, **kwargs)

    @classmethod
    def from_rdkit(cls, mol, conf_id=-1, **kwargs):
        """Viewer for an RDKit molecule with 3D coordinates (a conformer),
        drawn with the molecule's own bonds."""
        if mol.GetNumConformers() == 0:
            raise ValueError(
                'the molecule has no 3D coordinates; add them with '
                'rdkit.Chem.AllChem.EmbedMolecule(mol) first'
            )
        from rdkit import Chem
        data = Chem.MolToMolBlock(mol, confId=conf_id, forceV3000=mol.GetNumAtoms() > 999)
        return cls(data=data, **kwargs)

    @classmethod
    def from_pymatgen(cls, structure, **kwargs):
        """Viewer for a pymatgen Structure (with its unit cell) or Molecule."""
        symbols = [site.specie.symbol for site in structure]
        positions = [tuple(site.coords) for site in structure]
        lattice = getattr(structure, 'lattice', None)
        cell = lattice.matrix.tolist() if lattice is not None else None
        kwargs.setdefault('unitCell', cell is not None)
        return cls(data=_extxyz([(symbols, positions, cell)]), **kwargs)

    # --- looks --------------------------------------------------------------

    def apply_preset(self, name):
        """Apply a named look: default, matte, glossy, toon, cover, metal or
        glass. Presets start from 'default', so they don't accumulate."""
        if name not in PRESETS:
            raise ValueError('unknown preset %r; choose from %s' % (name, ', '.join(PRESETS)))
        values = dict(PRESETS['default'])
        values.update(PRESETS[name])
        with self.hold_sync():
            for key, value in values.items():
                setattr(self, key, value)

    # --- export -------------------------------------------------------------

    def save_image(self, filename=None, size=None, quality='good', transparent=True, background='#ffffff',
                   width=None, height=None, scale=None, supersample=None, aoRes=None, samples=None,
                   callback=None):
        """Render a high-resolution PNG in the browser and save it.

        The image uses the current camera and settings:

            w.save_image("figure.png")                               # 2x the viewer
            w.save_image("figure.png", size="screen", quality="best")
            w.save_image("cover.png", size="portrait", transparent=False)

        size: 'screen' (the viewer's shape, 3000 px on the longer side),
        'largest' (4096 px), '1080p', '4k', 'square' (3000 x 3000),
        'portrait' (2400 x 3000), 'vertical' (2160 x 3840) or (width,
        height). Without it, twice the on-screen size (or `width` and/or
        `height` in pixels, the other side keeping the viewer's shape, or
        `scale`). When the shape differs from the viewer's, what is on
        screen is kept (the whole structure is refitted if it was all
        visible). quality: 'draft' (fast), 'good' (default) or 'best';
        samples, supersample and aoRes set its parts directly. The widget's
        camera button offers the same choices without code.

        Rendering runs in the browser after the current cell finishes (it
        starts once the viewer is on screen): the file is written,
        `last_image` set to the PNG bytes and `callback(png_bytes)` called
        once it arrives. The largest side is limited to 4096 px.
        """
        if quality is not None and quality not in _IMAGE_QUALITY:
            raise ValueError("quality must be one of %s" % ', '.join(_IMAGE_QUALITY))
        if isinstance(size, (list, tuple)):
            size = [int(size[0]), int(size[1])]
        elif size is not None and size not in _IMAGE_SIZES:
            raise ValueError("size must be one of %s or (width, height)" % ', '.join(_IMAGE_SIZES))
        if size is None and width is None and height is None and scale is None:
            scale = 2
        self._request('saveImage', 'image', filename, callback, dict(
            size=size, quality=quality, width=width, height=height, scale=scale, supersample=supersample,
            transparent=transparent, background=background, aoRes=aoRes, samples=samples))

    def save_animation(self, filename, frames=60, mode='turntable', fps=20, width=None,
                       height=None, scale=1, supersample=1, transparent=False,
                       background='#ffffff', aoRes=512, samples=256, callback=None):
        """Render an animation in the browser and save it.

        mode 'turntable' turns the structure once about the vertical axis in
        `frames` steps; 'trajectory' plays every frame of the data. The format
        follows the extension: .gif (needs Pillow), .mp4 / .webm (needs
        imageio with ffmpeg) or a directory name for numbered PNG files.
        Like save_image, frames arrive after the current cell finishes;
        `callback(list_of_png_bytes)` runs when the file is written.
        """
        if mode not in ('turntable', 'trajectory'):
            raise ValueError("mode must be 'turntable' or 'trajectory'")
        self._request('saveAnimation', 'frames', filename, callback, dict(
            frames=frames, mode=mode, width=width, height=height, scale=scale,
            supersample=supersample, transparent=transparent, background=background,
            aoRes=aoRes, samples=samples), fps=fps)

    # --- films ----------------------------------------------------------------

    def keyframe(self, time=None, **settings):
        """The current camera as a key for shots.keyframes(), with optional
        settings to reach at that key (e.g. keyframe(fog=0.4)) and its time in
        seconds. Rotate the view in the widget between calls."""
        if not self.camera:
            raise RuntimeError('the camera is not known yet: display the widget first')
        key = {'camera': dict(self.camera)}
        if settings:
            key['settings'] = settings
        if time is not None:
            key['time'] = time
        return key

    def preview(self, film='spin', seconds=None, target=None, title=None, subtitle=None, loop=True,
                background=None, credit=None, size=None):
        """Play a video in the widget, with a player bar: play / pause, a time
        slider, "Save video" (downloads an MP4 in your browser) and close.

        film: a ready-made video by name ('spin', 'rock', 'orbit', 'tour',
        'focus', 'reveal', 'trajectory', 'showcase'; see shots.RECIPES) or
        your own list of shots. seconds, target, title, subtitle: as in
        save_video. The view returns to how it was when the player closes.
        The widget's video button (clapperboard) does the same without code.
        """
        options = {'loop': loop}
        for key, value in (('background', background), ('credit', credit), ('size', size)):
            if value is not None:
                options[key] = value
        self.send({'do': 'playFilm', 'film': _shots.spec(film, seconds, target, title, subtitle),
                   'options': options})

    def stop_preview(self):
        """Close the video player."""
        self.send({'do': 'stopFilm'})

    def save_video(self, filename='movie.mp4', film='spin', seconds=None, target=None, title=None,
                   subtitle=None, size=None, fps=None, quality='good', background='#ffffff',
                   vignette=0.0, motion_blur=0, credit=None, samples=None, aoRes=1024, supersample=1,
                   bitrate=None, callback=None):
        """Render a video of the structure and save it next to the notebook.

        The simplest call is w.save_video("movie.mp4"): one full turn. Pick a
        ready-made video by name:

            w.save_video("tour.mp4", "tour", title="Hemoglobin")

        'spin', 'rock', 'orbit', 'reveal' (cut open) and 'showcase' work for
        any structure; 'tour' and 'focus' visit the largest ligand (or
        `target`, e.g. {"chain": "B"}); 'trajectory' plays the frames. See
        shots.RECIPES. You can also pass your own list of shots.

        seconds: length of a ready-made video. title / subtitle: text shown
        over the first seconds. size: '1080p' (default; '480p' for GIFs),
        '720p', '1440p', '4k', 'square', 'vertical' (9:16, phones),
        'portrait' (4:5) or (width, height). fps: frames per second (default
        30; 15 for GIFs, which grow quickly). quality: 'draft' (fast
        preview), 'good' or 'best'. background: a color, a list of colors
        (vertical gradient) or {'center': ..., 'edge': ...} (radial).
        vignette: darker corners, 0 - 1. motion_blur: e.g. 4 for smoother
        fast moves (slower). credit: small text in the corner.

        The video is rendered in the browser after the cell finishes, with
        its progress (and a Cancel button) in the widget, which must be on
        screen; the file appears a moment after it completes. MP4 is encoded
        by the browser; .gif, .webm, .mov or a folder name (numbered PNG
        files) are written by Python (needs Pillow; .webm / .mov also
        imageio with ffmpeg). `callback(filename)` runs when the file is
        written.
        """
        spec = _shots.spec(film, seconds, target, title, subtitle)
        ext = os.path.splitext(filename)[1].lower()
        if size is None:
            size = '480p' if ext == '.gif' else '1080p'
        if fps is None:
            fps = 15 if ext == '.gif' else 30
        if ext not in ('.mp4', '.gif', '.webm', '.mov', ''):
            raise ValueError('unsupported video format %r (use .mp4, .gif, .webm, .mov or a folder name)' % ext)
        if quality not in _QUALITY:
            raise ValueError("quality must be 'draft', 'good' or 'best'")
        if isinstance(size, (list, tuple)):
            size = [int(size[0]), int(size[1])]
        options = dict(film=spec, fps=fps, size=size, samples=samples or _QUALITY[quality], aoRes=aoRes,
                       supersample=supersample, background=background, vignette=vignette,
                       motionBlur=motion_blur, credit=credit, bitrate=bitrate,
                       format='mp4' if ext == '.mp4' else 'frames')

        def done(_):
            size_mb = _size_mb(filename)
            self.send({'do': 'flash', 'text': 'Saved %s%s' % (os.path.basename(filename.rstrip('/')) or filename,
                                                             ' (%.1f MB)' % size_mb if size_mb else '')})
            if callback:
                callback(filename)

        self._request('saveVideo', 'video', filename, done, options, fps=fps, chunks={})
        print('Making %s: %.0f seconds of video, %s. It starts once the viewer is on screen and shows '
              'its progress there; the file is saved here when it is done.'
              % (filename, _shots.spec_seconds(spec), _size_label(size)))

    def _request(self, do, kind, filename, callback, options, **extra):
        rid = uuid.uuid4().hex
        self._requests[rid] = dict(kind=kind, filename=filename, callback=callback,
                                   frames={}, **extra)
        message = {'do': do, 'id': rid}
        message.update({k: v for k, v in options.items() if v is not None})
        self.send(message)

    def _on_frontend_msg(self, _, content, buffers):
        request = self._requests.get(content.get('id'))
        if request is None:
            # Unknown request, or already answered by another view.
            return
        if content.get('error'):
            self._requests.pop(content['id'], None)
            self.log.warning('ipyspeck export failed: %s', content['error'])
            return
        if content.get('event') == 'video':
            # The MP4 in chunks (comm messages have a size limit).
            request['chunks'][content['index']] = bytes(buffers[0])
            if len(request['chunks']) == content['count']:
                self._requests.pop(content['id'], None)
                data = b''.join(request['chunks'][i] for i in range(content['count']))
                with open(request['filename'], 'wb') as f:
                    f.write(data)
                if request['callback']:
                    request['callback'](data)
            return
        png = bytes(buffers[0])
        if content.get('event') == 'image':
            self._requests.pop(content['id'], None)
            self.last_image = png
            if request['filename']:
                with open(request['filename'], 'wb') as f:
                    f.write(png)
            if request['callback']:
                request['callback'](png)
        elif content.get('event') == 'frame':
            request['frames'][content['index']] = png
            if len(request['frames']) == content['count']:
                self._requests.pop(content['id'], None)
                frames = [request['frames'][i] for i in range(content['count'])]
                _write_animation(request['filename'], frames, request['fps'])
                if request['callback']:
                    request['callback'](frames)

    # --- trajectory -----------------------------------------------------------

    def trajectory_controls(self, interval=100):
        """Play button and slider linked to `frame` (runs in the browser)."""
        last = max(0, self.nframes - 1)
        play = widgets.Play(min=0, max=last, interval=interval, description='Play')
        slider = widgets.IntSlider(min=0, max=last, description='frame')
        widgets.jslink((play, 'value'), (slider, 'value'))
        widgets.jslink((slider, 'value'), (self, 'frame'))

        def update_range(change):
            play.max = slider.max = max(0, change['new'] - 1)

        self.observe(update_range, 'nframes')
        return widgets.HBox([play, slider])

    # --- views and colors -----------------------------------------------------

    def frontview(self):
        """Rotates the molecule model to visualize the front view"""
        self.send({"do": "frontView"})

    def topview(self):
        """Rotates the molecule model to visualize the top view"""
        self.send({"do": "topView"})

    def rightview(self):
        """Rotates the molecule model to visualize the right view"""
        self.send({"do": "rightView"})

    def center(self):
        """Recenters the structure and fits it to the view"""
        self.send({"do": "center"})

    def snapshot(self):
        """Downloads the on-screen image as a PNG file in the browser"""
        self.send({"do": "snapshot"})

    def setAtomColor(self, atom, color):
        """Set the color of one element ('#rrggbb' or [r, g, b] in 0 - 1)."""
        self.setAtomsColor({atom: color})

    def setAtomsColor(self, atoms):
        """Add element colors to atomColors, e.g. {"Au": [1, 0.8, 0.2]}.

        Colors are '#rrggbb' or [r, g, b] in 0 - 1. Unlike before 0.8.2 they
        are kept in the atomColors trait, so they also work before the
        viewer is displayed.
        """
        self.atomColors = {**self.atomColors, **atoms}

    def setColorSchema(self, schema):
        """Switch the element palette (colorScheme) and clear atomColors."""
        with self.hold_trait_notifications():
            self.colorScheme = schema
            self.atomColors = {}

    def switchColorSchema(self):
        """Switch to the next element palette."""
        i = _COLOR_SCHEMES.index(self.colorScheme)
        self.setColorSchema(_COLOR_SCHEMES[(i + 1) % len(_COLOR_SCHEMES)])


_IMAGE_SIZES = ('screen', 'largest', '1080p', '4k', 'square', 'portrait', 'vertical')
_IMAGE_QUALITY = ('draft', 'good', 'best')

# Ambient-occlusion samples per video frame.
_QUALITY = {'draft': 64, 'good': 256, 'best': 512}


def _size_mb(path):
    try:
        if os.path.isdir(path):
            return sum(os.path.getsize(os.path.join(path, f)) for f in os.listdir(path)) / 1e6
        return os.path.getsize(path) / 1e6
    except OSError:
        return 0


_SIZES = {'480p': (854, 480), '720p': (1280, 720), '1080p': (1920, 1080), '1440p': (2560, 1440),
          '4k': (3840, 2160), 'square': (1080, 1080), 'vertical': (1080, 1920), 'portrait': (1080, 1350)}


def _size_label(size):
    if isinstance(size, (list, tuple)):
        return '%d x %d' % (size[0], size[1])
    w, h = _SIZES.get(str(size).lower(), (0, 0))
    return '%s (%d x %d)' % (size, w, h) if w else str(size)


def _write_animation(filename, frames, fps):
    """Writes PNG frames as .gif, .mp4/.webm/.mov, or numbered PNGs in a directory."""
    ext = os.path.splitext(filename)[1].lower()
    if ext == '':
        os.makedirs(filename, exist_ok=True)
        for i, png in enumerate(frames):
            with open(os.path.join(filename, 'frame_%04d.png' % i), 'wb') as f:
                f.write(png)
        return
    from PIL import Image
    images = [Image.open(io.BytesIO(png)).convert('RGB') for png in frames]
    if ext == '.gif':
        images[0].save(filename, save_all=True, append_images=images[1:],
                       duration=int(round(1000.0 / fps)), loop=0)
    elif ext in ('.mp4', '.webm', '.mov'):
        import numpy as np
        import imageio.v2 as imageio
        with imageio.get_writer(filename, fps=fps) as writer:
            for im in images:
                # Video codecs need even dimensions.
                w, h = im.size
                writer.append_data(np.asarray(im.crop((0, 0, w - w % 2, h - h % 2))))
    else:
        raise ValueError('unsupported animation format %r (use .gif, .mp4, .webm or a directory)' % ext)
