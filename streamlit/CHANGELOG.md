# Changelog

## [0.8.1] - 2026-09-27

### Added
- Macro-lens depth of field: the blur grows with the distance to the focal plane (in Angstrom) and with zoom, so zooming in on a detail gives a shallow, photographic depth of field; `dofStrength` now goes up to 3
- `dofFocus`: keep an atom selection in focus as the view rotates (same keys as `highlight`)
- Gallery of 32 renders in the README

### Changed
- Smoother bokeh: 128 golden-angle taps, per-pixel rotation, no bleeding of sharp objects into blurred ones, and bright highlights bloom

### Fixed
- Peptide-like ligands (e.g. saquinavir) were treated as part of the protein chain and hidden in cartoon mode; HETATM residues now count as polymer only when bonded into the chain

## [0.8.0] - 2026-09-26

First release as a standalone package (previously bundled with ipyspeck as
`ipyspeck.stspeck`). The version follows ipyspeck, whose renderer and settings it shares.

### Added
- `stspeck.speck()` with every ipyspeck setting: cartoons, molecular surfaces
  (optionally transparent), materials, shadows, fog, outlines, highlighting,
  trajectories and unit cells; `preset=` for named looks
- Toolbar with styles, cartoon / surface / ligand toggles, views, color schemes and a
  high-resolution PNG download; toolbar choices persist across reruns
- `return_state=True` returns the camera and settings; `camera=` restores a view
- Loaders returning keyword arguments: `fetch_pdb`, `fetch_alphafold`, `read_file`,
  `from_ase`, `from_rdkit`, `from_pymatgen`; `count_frames` for frame sliders
- Python 3.8+ (tested with Streamlit 1.40 on 3.8, 1.50 on 3.9 and 1.64 on 3.10)
- Frontend without React or Arrow (~215 KB), with a content-hashed bundle so browsers
  never serve a stale copy after an upgrade
