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

<p>
<img src="https://raw.githubusercontent.com/denphi/speck/master/media/alphafold.jpg" width="32%"/>
<img src="https://raw.githubusercontent.com/denphi/speck/master/media/hemoglobin_glass.jpg" width="32%"/>
<img src="https://raw.githubusercontent.com/denphi/speck/master/media/nucleosome.jpg" width="32%"/>
</p>
<p>
<img src="https://raw.githubusercontent.com/denphi/speck/master/media/gold_cluster.jpg" width="32%"/>
<img src="https://raw.githubusercontent.com/denphi/speck/master/media/copper_crystal.jpg" width="32%"/>
<img src="https://raw.githubusercontent.com/denphi/speck/master/media/ubiquitin_surface.jpg" width="32%"/>
</p>

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
