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

Speck.from_pdb_id("4HHB")                  # RCSB entry, shown as a cartoon
Speck.from_alphafold("Q8W3K0")             # AlphaFold model, colored by confidence
Speck(data=open("molecule.xyz").read())    # any XYZ / extended XYZ / PDB text
```

Every setting below is a constructor argument and can also be changed live
(`w.surface = True`). The toolbar in the top right switches styles, toggles
cartoon, surface and ligands, sets standard views, cycles color schemes and
saves a PNG. Set the size with `w.layout.height = "500px"`.

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
w.apply_preset("cover")           # default, matte, glossy, toon, cover, metal, glass
w.shadows = 0.6                   # cast shadows from the key light
w.fog = 0.4                       # depth cue toward fogColor
w.rim = 0.3                       # rim light along silhouettes
w.specular, w.gloss = 0.5, 0.7    # highlights
w.metallic, w.metallicAtoms = 1.0, "metals"   # shiny metals, matte organics
w.outline, w.outlineColor = 0.5, "#2d2466"
```

### Macro look (depth of field)

Blur grows with the distance to the focal plane and with zoom, like a macro lens:
zoom in on a detail and keep it sharp with `dofFocus`.

```python
w = Speck.from_pdb_id("4HHB", cartoon=True, highlight={"resName": "HEM", "chain": "A"})
w.dofFocus = {"resName": "HEM", "chain": "A"}   # stays in focus as you rotate
w.dofStrength = 1.2                              # 1 - 2 for a macro look (max 3)
```

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

### Structures from Python

```python
Speck.from_file("structure.pdb")
Speck.from_ase(atoms)              # ase.Atoms or a list (trajectory); periodic cells shown
Speck.from_rdkit(mol)              # needs 3D coordinates (AllChem.EmbedMolecule)
Speck.from_pymatgen(structure)     # Structure (with its cell) or Molecule
```

Multi-frame XYZ and multi-model PDB data are trajectories: set `w.frame`, or display
`w.trajectory_controls()` for a play button and slider.

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

Rendered with ipyspeck (see `example/showcase.ipynb` for the settings behind these looks).

### Macro photography (depth of field)

<table>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gold_macro.jpg" width="100%"/><br/><sub>Gold nanoparticle, 923 atoms</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/copper_macro.jpg" width="100%"/><br/><sub>Copper surface</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/heme_macro.jpg" width="100%"/><br/><sub>Heme in hemoglobin (4HHB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/imatinib_macro.jpg" width="100%"/><br/><sub>Imatinib in ABL kinase (1IEP)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/dna_macro.jpg" width="100%"/><br/><sub>Nucleosome DNA (1KX5)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/alphafold_macro.jpg" width="100%"/><br/><sub>AlphaFold RPP7 repeat domain</sub></td>
</tr>
</table>

### Proteins and complexes

<table>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/alphafold.jpg" width="100%"/><br/><sub>AlphaFold RPP7, by pLDDT</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/hemoglobin_glass.jpg" width="100%"/><br/><sub>Hemoglobin, glass surface (4HHB)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/spike.jpg" width="100%"/><br/><sub>SARS-CoV-2 spike (6VXX)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/antibody.jpg" width="100%"/><br/><sub>IgG antibody (1IGT)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gfp.jpg" width="100%"/><br/><sub>Green fluorescent protein (1EMA)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/groel.jpg" width="100%"/><br/><sub>GroEL–GroES chaperonin (1AON)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/potassium_channel.jpg" width="100%"/><br/><sub>KcsA K⁺ channel (1BL8)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/crispr_cas9.jpg" width="100%"/><br/><sub>CRISPR-Cas9 with guide RNA (4OO8)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/hiv_protease.jpg" width="100%"/><br/><sub>HIV protease + saquinavir (1HXB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/streptavidin_biotin.jpg" width="100%"/><br/><sub>Streptavidin–biotin (1STP)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/myoglobin.jpg" width="100%"/><br/><sub>Myoglobin, toon style (1MBN)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/collagen.jpg" width="100%"/><br/><sub>Collagen triple helix (1BKV)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ubiquitin_surface.jpg" width="100%"/><br/><sub>Ubiquitin surface (1UBQ)</sub></td>
</tr>
</table>

### Nucleic acids

<table>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/nucleosome.jpg" width="100%"/><br/><sub>Nucleosome (1KX5)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/trna.jpg" width="100%"/><br/><sub>Transfer RNA (1EHZ)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/g_quadruplex.jpg" width="100%"/><br/><sub>G-quadruplex with K⁺ (1KF1)</sub></td>
</tr>
</table>

### Chemistry and materials

<table>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gold_cluster.jpg" width="100%"/><br/><sub>Gold–thiolate cluster</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/copper_crystal.jpg" width="100%"/><br/><sub>Copper crystal and unit cell</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/perovskite.jpg" width="100%"/><br/><sub>SrTiO₃ perovskite</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/mos2.jpg" width="100%"/><br/><sub>MoS₂ monolayer</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/graphene.jpg" width="100%"/><br/><sub>Graphene</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/nanotube.jpg" width="100%"/><br/><sub>Carbon nanotube</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/buckyball.jpg" width="100%"/><br/><sub>C₆₀ buckminsterfullerene</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/taxol.jpg" width="100%"/><br/><sub>Taxol (paclitaxel)</sub></td>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/chlorophyll.jpg" width="100%"/><br/><sub>Chlorophyll a</sub></td>
</tr>
<tr>
<td align="center" width="33%"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/caffeine.jpg" width="100%"/><br/><sub>Caffeine</sub></td>
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

BSD-3-Clause

## Author

Daniel Mejia (Denphi) - denphi@denphi.com

## Links

- [GitHub Repository](https://github.com/denphi/speck)
- [PyPI Package](https://pypi.org/project/ipyspeck/)
- [Issue Tracker](https://github.com/denphi/speck/issues)
