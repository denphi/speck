# ipyspeck

A Jupyter Widget for rendering beautiful molecular structures using Speck.

<table>
    <tr>
        <td>Latest Release</td>
        <td>
            <a href="https://pypi.org/project/ipyspeck/"/>
            <img src="https://badge.fury.io/py/ipyspeck.svg"/>
        </td>
    </tr>
    <tr>
        <td>PyPI Downloads</td>
        <td>
            <a href="https://pepy.tech/project/ipyspeck"/>
            <img src="https://static.pepy.tech/badge/ipyspeck/month"/>
            <img src="https://static.pepy.tech/badge/ipyspeck"/>
        </td>
    </tr>
</table>

## About

Speck is a molecule renderer with the goal of producing figures that are as attractive as they are practical. Express your molecule clearly _and_ with style.

![ipyspeck 0.8](https://raw.githubusercontent.com/denphi/speck/master/media/banner.jpg)

ipyspeck brings Speck to Jupyter Notebook and JupyterLab: ambient-occlusion rendering of atoms and bonds, protein and nucleic-acid cartoons, molecular surfaces (optionally transparent), metallic and glossy materials, shadows, depth fog, highlighting, trajectories, unit cells and high-resolution image and animation export. The same viewer is available for Streamlit as [stspeck](https://pypi.org/project/stspeck/).

## Version Compatibility

> **⚠️ IMPORTANT: Version Compatibility Notice**
>
> **ipyspeck 0.8.x** requires:
> - Jupyter Notebook 6 or JupyterLab 3 / 4
> - ipywidgets 7 or 8
> - Python >= 3.8
>
> **For older environments**, use ipyspeck 0.6.x:
> - JupyterLab 2.x → use `ipyspeck<0.7`
> - ipywidgets < 7.0 → use `ipyspeck<0.7`
> - Python < 3.8 → use `ipyspeck<0.7`
>
> **Migration Notes:**
> - Version 0.8.0 works with Classic Notebook 6 and JupyterLab 3 and 4, on ipywidgets 7 and 8
> - Version 0.7.0+ uses the modern JupyterLab 3+ federated extension system
> - Version 0.7.0+ supports both ipywidgets 7.x and 8.x with backward compatibility
> - Version 0.7.0+ uses Lumino (LuminoJS) instead of deprecated PhosphorJS

## Installation

### Standard Installation

For JupyterLab 3+ and ipywidgets 7+:

```bash
pip install ipyspeck
```

That's it! The extension will be automatically enabled in JupyterLab 3+.

### Legacy Installation (JupyterLab 2.x)

For older JupyterLab versions:

```bash
pip install "ipyspeck<0.7"
jupyter nbextension enable --py --sys-prefix ipyspeck
jupyter labextension install ipyspeck
```

### Development Installation

For developers who want to contribute:

```bash
git clone https://github.com/denphi/speck.git
cd speck/jupyter
npm install && npm run build
pip install -e .
```

## Usage

### Quick start

```python
from ipyspeck import Speck

Speck.from_pdb_id("4HHB")                  # RCSB entry (mmCIF), shown as a cartoon
Speck.from_alphafold("Q8W3K0")             # AlphaFold model, colored by confidence
Speck.from_file("ligand.sdf")              # PDB, mmCIF, SDF / MOL or XYZ, also .gz
```

Every setting below is a constructor argument and can also be changed live
(`w.surface = True`). The toolbar in the top right switches styles and looks,
toggles cartoon, surface and ligands, sets standard views, auto-rotates,
focuses by tapping, opens a color menu (cartoon, surface and atom color
schemes) and saves a PNG. Set the size with `w.layout.height = "500px"`.

The viewer works with touch (one finger rotates, two fingers pinch to zoom and
pan) and keyboard (Tab to the toolbar or the molecule; arrows rotate,
Shift+arrows pan, + / - zoom, 0 recenters, F focuses at the center); toolbar
buttons are labelled for screen readers.

### Cartoons, surfaces and ligands

```python
w = Speck.from_pdb_id("4HHB", cartoonColor="chain")   # 'ss', 'chain', 'rainbow', 'plddt' or '#rrggbb'
w.surface = True                  # solvent-excluded molecular surface
w.surfaceOpacity = 0.3            # see the cartoon and ligands through it
w.cartoonAtoms = "sidechains"     # also 'ligands' (default), 'all', 'none'
w.ligands = False                 # hide ligands in any view
```

### Looks, lighting and materials

```python
w.apply_preset("cover")           # default, matte, glossy, toon, cover, metal, glass, goodsell
w.shadows = 0.6                   # cast shadows from the key light
w.fog = 0.4                       # depth cue toward fogColor
w.rim = 0.3                       # rim light along silhouettes
w.specular, w.gloss = 0.5, 0.7    # highlights
w.metallic, w.metallicAtoms = 1.0, "metals"   # shiny metals, matte organics
w.outline, w.outlineColor = 0.5, "#2d2466"
w.autoRotate = True               # turntable spin (also a toolbar toggle)
```

The looks are also in the toolbar's sparkle menu.

### Studio floor, illustration style and cutaway

```python
w.floor, w.floorReflection = 0.9, 0.3     # soft contact shadow and reflection (off by default)
w.apply_preset("goodsell")                # Goodsell-style illustration: flat colors per chain
w.atomColor = "type"                      # atoms by chain, entity, type (protein / RNA), ss, rainbow
w.palette = "colorblind"                  # goodsell, pastel, colorblind, viridis, grays, default
w.cutaway = 0.5                           # slice off the front half to look inside
w.cutawayAxis = "z"                       # plane facing the camera ("view") or fixed across x / y / z
w.cutawayLight = 0.6                      # light entering through the cut, for the inside
```

The floor works on any background (it only adds shadow and reflection). `outlineMode="molecules"`
outlines only the edges between molecules, as in illustrations. Cut atoms and surfaces are capped,
so capsids and ribosomes open up like a cross-section; a fixed axis keeps the cut in place on the
molecule while you rotate it.

### Element colors

```python
w.colorScheme = "jmol"                                  # speck, jmol, rasmol, newcpk
w.atomColors = {"Au": "#ffcc33", "S": [0.9, 0.8, 0.2]}  # per element, on top of the palette
```

Both are regular settings: they can be passed to the constructor, work before the viewer is
displayed, and the toolbar's color menu updates `colorScheme`.

### Macro look (depth of field)

Blur grows with the distance to the focal plane and with zoom, like a macro lens:
zoom in on a detail and keep it sharp with `dofFocus`.

```python
w = Speck.from_pdb_id("4HHB", cartoon=True, highlight={"resName": "HEM", "chain": "A"})
w.dofFocus = {"resName": "HEM", "chain": "A"}   # stays in focus as you rotate
w.dofStrength = 1.2                              # 1 - 2 for a macro look (max 3)
```

Or **tap to focus**: turn on the focus button in the toolbar (or hold Alt / Option) and click the
point that should be sharp. The depth under the cursor becomes `dofPosition` (depth of field
switches on if it was off), and the value is synced back to Python.
The aperture button next to it switches depth of field off and on (`dofStrength`).

### Highlighting

```python
w.highlight = {"resName": "HEM"}   # keys: index, chain, resName, resSeq, name, element, ligands
w.highlight = {"chain": "A", "resSeq": ["40-60"]}
w.highlightScale = 1.3
w.ghost = 0.6                      # fade everything else
```

### Figures and animations

```python
w.save_image("figure.png", width=3000)                 # supersampled PNG, up to 4096 px
w.save_animation("turn.gif", frames=60)                # turntable; .mp4 needs imageio
w.save_animation("traj.mp4", mode="trajectory")        # every frame of the data
saved = w.camera                                       # ...later: w.camera = saved
```

Exports render in the browser after the cell finishes; the file appears a moment later.

### Films and videos

A film is a list of shots, played one after another. Preview it in the widget
(play, pause, scrub, download), then render it as a video:

```python
from ipyspeck import Speck, shots

w = Speck.from_pdb_id("4HHB", cartoon=True)
heme = {"resName": "HEM", "chain": "A"}
film = [
    shots.together(shots.orbit(6, degrees=180), shots.title("Hemoglobin", subtitle="PDB 4HHB")),
    shots.cut_open(2, to=0.5),                 # slice in to show the inside
    shots.fly_to(heme, 3),                     # dolly in and center the heme
    shots.rack_focus(heme, 2),                 # depth of field pulls focus to it
    shots.crossfade(surface=True, surfaceOpacity=0.35),
    shots.home(3),                             # back to the opening view
]
w.preview(film)
w.save_video("hemoglobin.mp4", film, size="1080p", fps=30,
             background=["#1b2330", "#07090d"], vignette=0.3)
```

Shots: `turntable`, `rock`, `orbit`, `zoom`, `fly_to`, `home`, `rack_focus`, `cut_open`,
`fade` (any setting: `shots.fade(2, fog=0.5, ghost=0.6)`), `crossfade`, `trajectory`
(smooth MD playback, interpolating between frames), `title`, `hold` and `together` (shots at
the same time). Each takes an `ease` (`linear`, `smooth`, `in`, `out`, `sine`). For custom
moves, pose the widget and record keys: `k1 = w.keyframe()`, rotate, `k2 = w.keyframe(fog=0.4)`,
then `shots.keyframes([k1, k2], seconds=4)`.

Every frame is fully shaded, with ambient occlusion fixed to the molecule, so videos do not
flicker. MP4s are encoded in the browser (H.264 with WebCodecs: Chrome, Edge, Safari 16.4+,
Firefox 130+); `.gif`, `.webm`, `.mov` or a directory of PNGs are written in Python. Sizes:
`720p`, `1080p`, `1440p`, `4k`, `square`, `vertical` (9:16), `portrait` (4:5) or `(width, height)`;
`motion_blur=4` averages sub-frames, `credit="..."` adds a corner line. Progress and a Cancel
button show in the widget.

### Structures from Python

```python
Speck.from_file("structure.cif")   # .pdb/.ent, .cif/.mmcif, .sdf/.mol, .xyz/.extxyz, optionally .gz
Speck.from_pdb_id("4V6X")           # a ribosome: 237,685 atoms, only available as mmCIF
Speck.from_pdb_id("1STM", assembly=1)   # biological assembly: the whole 60-copy virus capsid
Speck.from_mdtraj(mdtraj.load("run.xtc", top="system.gro"), stride=10)   # MD trajectory
Speck.from_mdanalysis(u.select_atoms("protein"), step=10)                # MDAnalysis Universe / AtomGroup
Speck.from_ase(atoms)              # ase.Atoms or a list (trajectory); periodic cells shown
Speck.from_rdkit(mol)              # needs 3D coordinates (AllChem.EmbedMolecule); keeps its bonds
Speck.from_pymatgen(structure)     # Structure (with its cell) or Molecule
```

The format is detected from the text, so `Speck(data=...)` accepts any of them. mmCIF, the
PDB's standard format, covers entries that PDB files cannot hold (over 99,999 atoms or 62
chains, multi-character chain IDs, five-character ligand codes); `from_pdb_id` downloads it
by default (`format="pdb"` for the legacy file). Bonds listed in the file (PDB CONECT,
mmCIF `_struct_conn`, SDF / MOL bond tables) are always drawn, including long metal bonds.

Multi-frame XYZ, multi-model PDB or mmCIF and multi-conformer SDF data are trajectories: set
`w.frame`, or display `w.trajectory_controls()` for a play button and slider. MD trajectories
(`from_mdtraj`, `from_mdanalysis`, or `w.set_trajectory(coords)` with an array of shape
(frames, atoms, 3) in Å) keep residues and chains, so cartoons follow the motion; their frames
travel to the browser as binary coordinates rather than repeated text.

Large structures stay interactive: ribosomes and capsids (200k+ atoms) load in the background,
render as atoms, cartoons or surfaces at full frame rate, and structure data reaches the
browser gzipped.

If Jupyter serves an older copy of the browser extension than the installed package (for
example one left in `~/.local/share/jupyter` by an earlier `pip install --user`), ipyspeck
warns with the folder to remove; restart Jupyter afterwards.

See `example/showcase.ipynb` for a tour of every feature.

### Streamlit

The same viewer and settings are available for Streamlit apps in the separate
[stspeck](https://pypi.org/project/stspeck/) package:

```bash
pip install stspeck
```

```python
import stspeck
stspeck.speck(**stspeck.fetch_alphafold("Q8W3K0"), preset="cover", height=500)
```

## Features

- 🎨 Publication-quality rendering: ambient occlusion, shadows, fog, rim light, outlines
- 🧬 Protein and nucleic-acid cartoons with computed or file secondary structure
- 🫧 Molecular surfaces, optionally transparent, colored by element, chain, residue or pLDDT
- ✨ Glossy and metallic materials, with metal-only reflections for nanoparticles and crystals
- 🔦 Highlighting and ghosting of any atom selection
- 🎞️ Trajectories, unit cells, and high-resolution image, GIF and MP4 export
- 🧪 Loaders for RCSB, AlphaFold DB, ASE, RDKit and pymatgen
- 🔌 Jupyter Notebook 6, JupyterLab 3 and 4, ipywidgets 7 and 8; Streamlit via stspeck

## Gallery

Rendered with ipyspeck (see `example/showcase.ipynb` for the settings behind these looks). Click an image to open the notebook that reproduces it (same settings and camera), or see them all in [example/gallery](https://github.com/denphi/speck/tree/master/jupyter/example/gallery).

### Macro photography (depth of field)

<table>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/gold_macro.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gold_macro.jpg" width="100%"/></a><br/><sub>Gold nanoparticle, 923 atoms</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/copper_macro.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/copper_macro.jpg" width="100%"/></a><br/><sub>Copper surface</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/heme_macro.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/heme_macro.jpg" width="100%"/></a><br/><sub>Heme in hemoglobin (4HHB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/imatinib_macro.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/imatinib_macro.jpg" width="100%"/></a><br/><sub>Imatinib in ABL kinase (1IEP)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/dna_macro.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/dna_macro.jpg" width="100%"/></a><br/><sub>Nucleosome DNA (1KX5)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/alphafold_macro.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/alphafold_macro.jpg" width="100%"/></a><br/><sub>AlphaFold RPP7 repeat domain</sub></td>
</tr>
</table>

### Proteins and complexes

<table>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/alphafold.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/alphafold.jpg" width="100%"/></a><br/><sub>AlphaFold RPP7, by pLDDT</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/hemoglobin_glass.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/hemoglobin_glass.jpg" width="100%"/></a><br/><sub>Hemoglobin, glass surface (4HHB)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/spike.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/spike.jpg" width="100%"/></a><br/><sub>SARS-CoV-2 spike (6VXX)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/antibody.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/antibody.jpg" width="100%"/></a><br/><sub>IgG antibody (1IGT)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/gfp.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gfp.jpg" width="100%"/></a><br/><sub>Green fluorescent protein (1EMA)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/groel.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/groel.jpg" width="100%"/></a><br/><sub>GroEL–GroES chaperonin (1AON)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/potassium_channel.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/potassium_channel.jpg" width="100%"/></a><br/><sub>KcsA K⁺ channel (1BL8)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/crispr_cas9.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/crispr_cas9.jpg" width="100%"/></a><br/><sub>CRISPR-Cas9 with guide RNA (4OO8)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/hiv_protease.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/hiv_protease.jpg" width="100%"/></a><br/><sub>HIV protease + saquinavir (1HXB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/streptavidin_biotin.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/streptavidin_biotin.jpg" width="100%"/></a><br/><sub>Streptavidin–biotin (1STP)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/myoglobin.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/myoglobin.jpg" width="100%"/></a><br/><sub>Myoglobin, toon style (1MBN)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/collagen.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/collagen.jpg" width="100%"/></a><br/><sub>Collagen triple helix (1BKV)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/ubiquitin_surface.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ubiquitin_surface.jpg" width="100%"/></a><br/><sub>Ubiquitin surface (1UBQ)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/ribosome.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ribosome.jpg" width="100%"/></a><br/><sub>Human 80S ribosome, 237,685 atoms (4V6X)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/capsid.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/capsid.jpg" width="100%"/></a><br/><sub>Virus capsid, all 60 copies (1STM)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/ms2_capsid.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ms2_capsid.jpg" width="100%"/></a><br/><sub>Bacteriophage MS2 capsid, 180 copies (2MS2)</sub></td>
</tr>
</table>

### Nucleic acids

<table>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/nucleosome.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/nucleosome.jpg" width="100%"/></a><br/><sub>Nucleosome (1KX5)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/trna.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/trna.jpg" width="100%"/></a><br/><sub>Transfer RNA (1EHZ)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/g_quadruplex.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/g_quadruplex.jpg" width="100%"/></a><br/><sub>G-quadruplex with K⁺ (1KF1)</sub></td>
</tr>
</table>

### Studio floor, illustration and cutaway

<table>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/floor_hemoglobin.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/floor_hemoglobin.jpg" width="100%"/></a><br/><sub>Hemoglobin on the studio floor (4HHB)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/floor_gold.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/floor_gold.jpg" width="100%"/></a><br/><sub>Gold–thiolate cluster on the studio floor</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/goodsell_hemoglobin.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/goodsell_hemoglobin.jpg" width="100%"/></a><br/><sub>Hemoglobin, Goodsell style (4HHB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/goodsell_capsid.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/goodsell_capsid.jpg" width="100%"/></a><br/><sub>Virus capsid, Goodsell style (1STM)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/goodsell_ribosome.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/goodsell_ribosome.jpg" width="100%"/></a><br/><sub>Ribosome large subunit, Goodsell style (1FFK)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/cutaway_capsid.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/cutaway_capsid.jpg" width="100%"/></a><br/><sub>Virus capsid, cut open (1STM)</sub></td>
</tr>
</table>

### Chemistry and materials

<table>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/gold_cluster.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gold_cluster.jpg" width="100%"/></a><br/><sub>Gold–thiolate cluster</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/copper_crystal.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/copper_crystal.jpg" width="100%"/></a><br/><sub>Copper crystal and unit cell</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/perovskite.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/perovskite.jpg" width="100%"/></a><br/><sub>SrTiO₃ perovskite</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/mos2.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/mos2.jpg" width="100%"/></a><br/><sub>MoS₂ monolayer</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/graphene.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/graphene.jpg" width="100%"/></a><br/><sub>Graphene</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/nanotube.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/nanotube.jpg" width="100%"/></a><br/><sub>Carbon nanotube</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/buckyball.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/buckyball.jpg" width="100%"/></a><br/><sub>C₆₀ buckminsterfullerene</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/taxol.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/taxol.jpg" width="100%"/></a><br/><sub>Taxol (paclitaxel)</sub></td>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/chlorophyll.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/chlorophyll.jpg" width="100%"/></a><br/><sub>Chlorophyll a</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://github.com/denphi/speck/blob/master/jupyter/example/gallery/caffeine.ipynb"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/caffeine.jpg" width="100%"/></a><br/><sub>Caffeine</sub></td>
</tr>
</table>

## Development

The widget lives in `jupyter/`; the renderer and viewer it shares with stspeck live in
`core/` and are built first.

```bash
cd jupyter
npm install
npm run build          # core, TypeScript, notebook and lab extensions (dev)
npm run build:prod     # production build
npm test               # model unit tests
pip install -e .
```

## License

BSD-3-Clause (see `LICENSE`). ipyspeck is based on [Speck](https://github.com/wwwtyro/speck) by wwwtyro,
which is in the public domain (see `LICENSE-SPECK`).

## Author

Daniel Mejia (Denphi) - denphi@denphi.com

## Links

- [GitHub Repository](https://github.com/denphi/speck)
- [PyPI Package](https://pypi.org/project/ipyspeck/)
- [Issue Tracker](https://github.com/denphi/speck/issues)
