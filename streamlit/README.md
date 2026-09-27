# stspeck

The [Speck](https://github.com/denphi/speck) molecule viewer for Streamlit, with the
same renderer and settings as the `ipyspeck` Jupyter widget: ambient occlusion,
cartoons, molecular surfaces (optionally transparent), metallic and glossy
materials, shadows, fog, outlines, highlighting, trajectories and unit cells.

```bash
pip install stspeck      # Python 3.8+, Streamlit 1.20+
```

![Speck 0.8](https://raw.githubusercontent.com/denphi/speck/master/media/banner.jpg)

```python
import streamlit as st
import stspeck

# Any structure as PDB or (extended) XYZ text
stspeck.speck(data=open("1ubq.pdb").read(), cartoon=True, surface=True, surfaceOpacity=0.35)

# Loaders return keyword arguments to splat into speck()
stspeck.speck(**stspeck.fetch_alphafold("Q8W3K0"), preset="cover", height=500)
stspeck.speck(**stspeck.fetch_pdb("4HHB"), highlight={"resName": "HEM"}, ghost=0.6)
stspeck.speck(**stspeck.from_ase(atoms), preset="metal")   # also from_rdkit, from_pymatgen
```

- **Settings**: every ipyspeck setting is a keyword argument; see `stspeck.SETTINGS`
  for names and defaults, and `stspeck.PRESETS` for named looks (`preset="cover"`).
- **Toolbar**: styles, cartoon / surface / ligand toggles, standard views, color
  schemes and a camera button that downloads a high-resolution PNG
  (`export_width=3000`, `export_scale=...`). Toolbar choices persist across reruns.
- **State**: with `return_state=True` the call returns the camera, the current
  settings and `nframes`; pass the camera back as `camera=` to restore a view.
- **Trajectories**: multi-frame XYZ or multi-model PDB; drive `frame=` with a slider
  (`stspeck.count_frames(data)` gives the range).

Run the demo with `streamlit run example/app.py`.

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

For Jupyter, use [ipyspeck](https://pypi.org/project/ipyspeck/), which has the same settings.

## Development

The frontend (`frontend/`) bundles the viewer shared with ipyspeck (`../core`).
Build it with `cd frontend && npm install && npm run build`, which also compiles
`../core`. `pip install .` runs the same build when `stspeck/static` is missing.
