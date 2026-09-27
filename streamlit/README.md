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

# Any structure as PDB, mmCIF, SDF / MOL or (extended) XYZ text (detected from the content)
stspeck.speck(data=open("1ubq.cif").read(), cartoon=True, surface=True, surfaceOpacity=0.35)
stspeck.speck(**stspeck.read_file("conformers.sdf.gz"), frame=2)

# Loaders return keyword arguments to splat into speck()
stspeck.speck(**stspeck.fetch_alphafold("Q8W3K0"), preset="cover", height=500)
stspeck.speck(**stspeck.fetch_pdb("4HHB"), highlight={"resName": "HEM"}, ghost=0.6)
stspeck.speck(**stspeck.from_ase(atoms), preset="metal")   # also from_rdkit, from_pymatgen
```

- **Settings**: every ipyspeck setting is a keyword argument; see `stspeck.SETTINGS`
  for names and defaults, and `stspeck.PRESETS` for named looks (`preset="cover"`).
- **Toolbar**: styles, a looks menu, cartoon / surface / ligand toggles, standard views,
  auto-rotate, tap to focus (or Alt-click), a depth-of-field toggle, a color menu for cartoon, surface and atoms,
  and a camera button that downloads a high-resolution PNG
  (`export_width=3000`, `export_scale=...`). Toolbar choices persist across reruns.
- **Studio floor, illustration, cutaway**: `floor=0.9, floorReflection=0.3`; `preset="goodsell"`
  (flat colors per chain, outlines between molecules), `atomColor="type"`, `palette="colorblind"`;
  `cutaway=0.5` slices off the front to show the inside (`cutawayAxis="z"` fixes the plane on the
  molecule, `cutawayLight=0.6` lights the inside).
- **Colors**: `colorScheme="jmol"` (speck, jmol, rasmol, newcpk) and per-element
  `atomColors={"Au": "#ffcc33"}` (`'#rrggbb'` or `[r, g, b]` in 0 - 1).
- **Touch and keyboard**: one finger rotates, two fingers pinch to zoom and pan; arrows
  rotate, Shift+arrows pan, + / - zoom, 0 recenters, F focuses at the center.
- **State**: with `return_state=True` the call returns the camera, the current
  settings and `nframes`; pass the camera back as `camera=` to restore a view.
- **Formats**: `fetch_pdb` downloads mmCIF, which also covers entries too large for PDB files
  (e.g. the 4V6X ribosome); `format="pdb"` gets the legacy file, and `assembly=1` a biological
  assembly (`fetch_pdb("1STM", assembly=1)`: a complete virus capsid). Bonds listed in the file
  (CONECT, `_struct_conn`, SDF / MOL bonds) are always drawn.
- **Trajectories**: multi-frame XYZ, multi-model PDB or mmCIF, or SDF conformers; drive `frame=` with a slider.
  MD: `stspeck.speck(**stspeck.from_mdtraj(traj), frame=f)` (or `from_mdanalysis`); frames go as
  binary coordinates (`trajectory=`), and `count_frames(data, trajectory)` gives the slider range
  (`stspeck.count_frames(data)` gives the range).

Run the demo with `streamlit run example/app.py`.

## Gallery

Rendered with the ipyspeck / stspeck renderer (see `example/showcase.ipynb` for the settings behind these looks). Click an image to open that scene in the [live demo](https://denphi.github.io/speck/).

### Macro photography (depth of field)

<table>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=gold_macro"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gold_macro.jpg" width="100%"/></a><br/><sub>Gold nanoparticle, 923 atoms</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=copper_macro"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/copper_macro.jpg" width="100%"/></a><br/><sub>Copper surface</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=heme_macro"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/heme_macro.jpg" width="100%"/></a><br/><sub>Heme in hemoglobin (4HHB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=imatinib_macro"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/imatinib_macro.jpg" width="100%"/></a><br/><sub>Imatinib in ABL kinase (1IEP)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=dna_macro"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/dna_macro.jpg" width="100%"/></a><br/><sub>Nucleosome DNA (1KX5)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=alphafold_macro"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/alphafold_macro.jpg" width="100%"/></a><br/><sub>AlphaFold RPP7 repeat domain</sub></td>
</tr>
</table>

### Proteins and complexes

<table>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=alphafold"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/alphafold.jpg" width="100%"/></a><br/><sub>AlphaFold RPP7, by pLDDT</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=hemoglobin_glass"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/hemoglobin_glass.jpg" width="100%"/></a><br/><sub>Hemoglobin, glass surface (4HHB)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=spike"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/spike.jpg" width="100%"/></a><br/><sub>SARS-CoV-2 spike (6VXX)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=antibody"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/antibody.jpg" width="100%"/></a><br/><sub>IgG antibody (1IGT)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=gfp"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gfp.jpg" width="100%"/></a><br/><sub>Green fluorescent protein (1EMA)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=groel"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/groel.jpg" width="100%"/></a><br/><sub>GroEL–GroES chaperonin (1AON)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=potassium_channel"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/potassium_channel.jpg" width="100%"/></a><br/><sub>KcsA K⁺ channel (1BL8)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=crispr_cas9"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/crispr_cas9.jpg" width="100%"/></a><br/><sub>CRISPR-Cas9 with guide RNA (4OO8)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=hiv_protease"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/hiv_protease.jpg" width="100%"/></a><br/><sub>HIV protease + saquinavir (1HXB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=streptavidin_biotin"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/streptavidin_biotin.jpg" width="100%"/></a><br/><sub>Streptavidin–biotin (1STP)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=myoglobin"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/myoglobin.jpg" width="100%"/></a><br/><sub>Myoglobin, toon style (1MBN)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=collagen"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/collagen.jpg" width="100%"/></a><br/><sub>Collagen triple helix (1BKV)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=ubiquitin_surface"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ubiquitin_surface.jpg" width="100%"/></a><br/><sub>Ubiquitin surface (1UBQ)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=ribosome"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ribosome.jpg" width="100%"/></a><br/><sub>Human 80S ribosome, 237,685 atoms (4V6X)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=capsid"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/capsid.jpg" width="100%"/></a><br/><sub>Virus capsid, all 60 copies (1STM)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=ms2_capsid"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/ms2_capsid.jpg" width="100%"/></a><br/><sub>Bacteriophage MS2 capsid, 180 copies (2MS2)</sub></td>
</tr>
</table>

### Nucleic acids

<table>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=nucleosome"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/nucleosome.jpg" width="100%"/></a><br/><sub>Nucleosome (1KX5)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=trna"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/trna.jpg" width="100%"/></a><br/><sub>Transfer RNA (1EHZ)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=g_quadruplex"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/g_quadruplex.jpg" width="100%"/></a><br/><sub>G-quadruplex with K⁺ (1KF1)</sub></td>
</tr>
</table>

### Studio floor, illustration and cutaway

<table>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=floor_hemoglobin"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/floor_hemoglobin.jpg" width="100%"/></a><br/><sub>Hemoglobin on the studio floor (4HHB)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=floor_gold"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/floor_gold.jpg" width="100%"/></a><br/><sub>Gold–thiolate cluster on the studio floor</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=goodsell_hemoglobin"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/goodsell_hemoglobin.jpg" width="100%"/></a><br/><sub>Hemoglobin, Goodsell style (4HHB)</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=goodsell_capsid"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/goodsell_capsid.jpg" width="100%"/></a><br/><sub>Virus capsid, Goodsell style (1STM)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=goodsell_ribosome"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/goodsell_ribosome.jpg" width="100%"/></a><br/><sub>Ribosome large subunit, Goodsell style (1FFK)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=cutaway_capsid"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/cutaway_capsid.jpg" width="100%"/></a><br/><sub>Virus capsid, cut open (1STM)</sub></td>
</tr>
</table>

### Chemistry and materials

<table>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=gold_cluster"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/gold_cluster.jpg" width="100%"/></a><br/><sub>Gold–thiolate cluster</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=copper_crystal"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/copper_crystal.jpg" width="100%"/></a><br/><sub>Copper crystal and unit cell</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=perovskite"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/perovskite.jpg" width="100%"/></a><br/><sub>SrTiO₃ perovskite</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=mos2"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/mos2.jpg" width="100%"/></a><br/><sub>MoS₂ monolayer</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=graphene"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/graphene.jpg" width="100%"/></a><br/><sub>Graphene</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=nanotube"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/nanotube.jpg" width="100%"/></a><br/><sub>Carbon nanotube</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=buckyball"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/buckyball.jpg" width="100%"/></a><br/><sub>C₆₀ buckminsterfullerene</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=taxol"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/taxol.jpg" width="100%"/></a><br/><sub>Taxol (paclitaxel)</sub></td>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=chlorophyll"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/chlorophyll.jpg" width="100%"/></a><br/><sub>Chlorophyll a</sub></td>
</tr>
<tr>
<td align="center" width="33%"><a href="https://denphi.github.io/speck/?example=caffeine"><img src="https://raw.githubusercontent.com/denphi/speck/master/media/gallery/caffeine.jpg" width="100%"/></a><br/><sub>Caffeine</sub></td>
</tr>
</table>

For Jupyter, use [ipyspeck](https://pypi.org/project/ipyspeck/), which has the same settings.

## Development

The frontend (`frontend/`) bundles the viewer shared with ipyspeck (`../core`).
Build it with `cd frontend && npm install && npm run build`, which also compiles
`../core`. `pip install .` runs the same build when `stspeck/static` is missing.

## License

BSD-3-Clause (see `LICENSE`). stspeck is based on [Speck](https://github.com/wwwtyro/speck) by wwwtyro,
which is in the public domain (see `LICENSE-SPECK`).
