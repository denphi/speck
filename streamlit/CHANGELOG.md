# Changelog

## [0.8.2] - 2026-09-27

### Added
- Tap to focus: a focus button in the toolbar (or Alt / Option-click) sets the depth-of-field focal plane to
  the exact depth under the cursor, turning depth of field on if needed; synced as `dofPosition`
- Color menu: the palette button opens a menu of cartoon, surface and atom color schemes (with the current
  one checked) instead of cycling element palettes
- Looks menu: a toolbar button lists the looks of `apply_preset()` (default, matte, glossy, toon, cover,
  metal, glass) with the current one checked; it replaces the toon button. Style buttons (ball and stick,
  space filling, licorice) now change only geometry, so they combine with any look
- Auto-rotate: `autoRotate` setting and toolbar toggle (turntable spin, 20° per second). Spinning frames keep
  ambient occlusion and shadows: 8 - 96 AO samples per frame (chosen to hold ~50 fps), taken along directions
  fixed to the molecule so the shading does not flicker as it turns; full refinement resumes when it stops
- Depth-of-field toggle: an aperture button in the toolbar turns the macro blur off, and back on at the last
  strength (tap to focus also turns it back on)
- `colorScheme` and `atomColors` settings: the element palette and per-element colors (`'#rrggbb'` or
  `[r, g, b]`), kept across redraws and usable before the viewer is displayed; the color menu updates
  `colorScheme`
- Touch: one finger rotates, two fingers pinch to zoom and pan (Pointer Events; the page no longer scrolls
  under the viewer); larger toolbar buttons on touch screens
- Keyboard and screen readers: toolbar and menus are real buttons with labels and pressed / checked states;
  Tab reaches the molecule, where arrows rotate, Shift+arrows pan, + / - zoom, 0 recenters and F focuses

### Changed
- License metadata is BSD-3-Clause (Speck's original public-domain notice ships as `LICENSE-SPECK`)

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
