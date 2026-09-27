# stspeck

The [Speck](https://github.com/denphi/speck) molecule viewer for Streamlit, with the
same renderer and settings as the `ipyspeck` Jupyter widget: ambient occlusion,
cartoons, molecular surfaces (optionally transparent), metallic and glossy
materials, shadows, fog, outlines, highlighting, trajectories and unit cells.

```bash
pip install stspeck      # Python 3.8+, Streamlit 1.20+
```

![ipyspeck 0.8](https://raw.githubusercontent.com/denphi/speck/master/media/banner.jpg)

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

Rendered with the ipyspeck / stspeck renderer (see `example/showcase.ipynb` for the settings behind these looks).

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

For Jupyter, use [ipyspeck](https://pypi.org/project/ipyspeck/), which has the same settings.

## Development

The frontend (`frontend/`) bundles the viewer shared with ipyspeck (`../core`).
Build it with `cd frontend && npm install && npm run build`, which also compiles
`../core`. `pip install .` runs the same build when `stspeck/static` is missing.
