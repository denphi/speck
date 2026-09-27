# Changelog

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
