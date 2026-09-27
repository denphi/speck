import io
import json
import os
import re
import urllib.request
import uuid

import ipywidgets as widgets
from traitlets import Unicode, Bool, Float, Int, Enum, Dict, observe, validate, TraitError


_MESH_SCHEMES = ('ss', 'chain', 'rainbow', 'plddt')
_HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
_SELECTION_KEYS = ('index', 'chain', 'resName', 'resSeq', 'name', 'element', 'ligands')

# Named looks for apply_preset(). Every preset starts from 'default', so
# switching presets never leaves settings from the previous one behind.
PRESETS = {
    'default': dict(ao=0.75, brightness=0.5, atomShade=0.5, bondShade=0.5, cartoonShade=0.2,
                    surfaceShade=0.1, outline=0.0, outlineWidth=1.0, outlineColor='#000000',
                    specular=0.0, gloss=0.5, metallic=0.0, metallicAtoms='all', shadows=0.0,
                    rim=0.0, fog=0.0, saturation=1.0, tonemap=False, dofStrength=0.0),
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
}


def _count_frames(data):
    """Number of frames in XYZ (repeated blocks) or PDB (MODEL records) text."""
    if re.search(r'^(ATOM  |HETATM)', data, re.M):
        return max(1, len(re.findall(r'^ENDMDL', data, re.M)))
    lines = data.split('\n')
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
        Structure as XYZ / extended XYZ or PDB text. PDB input enables cartoon
        and surface; several frames (XYZ blocks or PDB MODELs) form a
        trajectory.
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
    from_pymatgen()
        Create a viewer from a file, a database entry or a Python structure
    frontview(), topview(), rightview(), center()
        Standard views and fit
    snapshot()
        Download the on-screen image as PNG in the browser
    setAtomColor(atom, color), setAtomsColor(atoms)
        Set element colors
    setColorSchema(schema), switchColorSchema()
        Change the element color palette
    """

    _view_name = Unicode('SpeckView').tag(sync=True)
    _model_name = Unicode('SpeckModel').tag(sync=True)
    _view_module = Unicode('ipyspeck').tag(sync=True)
    _model_module = Unicode('ipyspeck').tag(sync=True)
    _view_module_version = Unicode('^0.8.1').tag(sync=True)
    _model_module_version = Unicode('^0.8.1').tag(sync=True)

    data = Unicode('').tag(sync=True)
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
    cellColor = Unicode('#666666').tag(sync=True)
    cellRadius = Float(0.12).tag(sync=True)
    frame = Int(0, min=0).tag(sync=True)
    nframes = Int(1, read_only=True).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
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

    @validate('outlineColor', 'fogColor', 'cellColor', 'highlightColor')
    def _valid_hex(self, proposal):
        value = proposal['value']
        if _HEX.match(value) or (value == '' and proposal['trait'].name == 'highlightColor'):
            return value
        raise TraitError("%s must be a '#rrggbb' color" % proposal['trait'].name)

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
        self.set_trait('nframes', _count_frames(change['new']))
        if self.frame >= self.nframes:
            self.frame = 0

    # --- constructors -------------------------------------------------------

    @classmethod
    def from_file(cls, path, **kwargs):
        """Viewer for a .pdb, .ent, .xyz or .extxyz file (optionally .gz)."""
        if str(path).endswith('.gz'):
            import gzip
            with gzip.open(path, 'rt') as f:
                data = f.read()
        else:
            with open(path) as f:
                data = f.read()
        return cls(data=data, **kwargs)

    @classmethod
    def from_pdb_id(cls, pdb_id, **kwargs):
        """Viewer for an RCSB PDB entry (e.g. "1UBQ"), shown as a cartoon."""
        url = 'https://files.rcsb.org/download/%s.pdb' % pdb_id.upper()
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
        """Viewer for an RDKit molecule with 3D coordinates (a conformer)."""
        if mol.GetNumConformers() == 0:
            raise ValueError(
                'the molecule has no 3D coordinates; add them with '
                'rdkit.Chem.AllChem.EmbedMolecule(mol) first'
            )
        conf = mol.GetConformer(conf_id)
        symbols = [a.GetSymbol() for a in mol.GetAtoms()]
        positions = [tuple(conf.GetAtomPosition(i)) for i in range(mol.GetNumAtoms())]
        return cls(data=_extxyz([(symbols, positions, None)]), **kwargs)

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

    def save_image(self, filename=None, width=None, height=None, scale=2, supersample=2,
                   transparent=True, background='#ffffff', aoRes=1024, samples=1024,
                   callback=None):
        """Render a high-resolution PNG in the browser and save it.

        The image uses the current camera and settings. Give width and/or
        height in pixels (the other side keeps the on-screen aspect), or
        scale the on-screen size. Rendering runs in the browser after the
        current cell finishes: the file is written, `last_image` set to the
        PNG bytes and `callback(png_bytes)` called once it arrives. The
        widget must be displayed. The largest side is limited to 4096 px.
        """
        self._request('saveImage', 'image', filename, callback, dict(
            width=width, height=height, scale=scale, supersample=supersample,
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
        """Set the color of atom types

        Parameters
        ----------
        atom : str
            Atom Name
        color : list
            A list with 3 rgb normalized values [0 - 1]
        """
        self.setAtomsColor({atom: color})

    def setAtomsColor(self, atoms):
        """Set the color of multiple atom types

        Parameters
        ----------
        atoms : dict
            A dictionary with tuples key as str and value rgb normalized values
            [0 - 1]
        """
        for atom, rgb in atoms.items():
            if not isinstance(atom, str):
                raise Exception(
                    "atom names should be str, '%s' passed" % type(atom).__name__
                )
            if len(rgb) != 3:
                raise Exception("RGB values should contain exactly 3 elements")
            for i in range(3):
                if rgb[i] < 0 or rgb[i] > 1:
                    raise Exception("RGB values should be [0 - 1] range")
        self.send({"do": "changeAtomsColor", "atoms": atoms})

    def setColorSchema(self, schema):
        """Set the color schema used by Speck, overwrites any custom change in
           atom color

        Parameters
        ----------
        schema : str
            name of the schema/palette to use
        """
        self.send({"do": "changeColorSchema", "schema": schema})

    def switchColorSchema(self):
        """Switch to the next available color schema """
        self.send({"do": "switchColorSchema"})


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
