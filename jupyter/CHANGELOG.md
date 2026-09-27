# Changelog

All notable changes to ipyspeck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Gallery notebooks: one per README gallery image (`example/gallery`), linked from the gallery

### Changed
- `setAtomsColor()` / `setColorSchema()` / `switchColorSchema()` now set `atomColors` / `colorScheme`, so
  custom colors persist and work before display
- Gallery notebooks use `atomColors`
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

### Added
- PDB input with cartoon (ribbon) rendering; secondary structure from HELIX/SHEET records or computed from backbone H-bonds
- Molecular (solvent-excluded) surface with optional transparency (`surfaceOpacity`)
- Color schemes for cartoon and surface: secondary structure, chain, rainbow, element, AlphaFold pLDDT, single color
- Materials: `specular`, `gloss`, `metallic`, `metallicAtoms` (metals only)
- All renderer settings exposed as traits, including `ao`, `aoRes`, `fxaa`, `ligands` and `toolbar`
- Toolbar with style presets, cartoon / surface / ligand toggles, standard views, color schemes and PNG snapshot
- `center()` and `snapshot()` methods; AlphaFold and showcase example notebooks
- Directional shadows, depth fog, rim light, saturation, highlight roll-off (`tonemap`), outline width and color
- Highlighting (`highlight`, `highlightColor`, `highlightScale`, `ghost`) and a synced `camera`
- `save_image()` (supersampled, up to 4096 px) and `save_animation()` (turntable or trajectory; GIF, MP4, PNG frames)
- `apply_preset()`: default, matte, glossy, toon, cover, metal, glass
- Loaders: `from_file`, `from_pdb_id`, `from_alphafold`, `from_ase`, `from_rdkit`, `from_pymatgen`
- Trajectories (multi-frame XYZ, multi-model PDB) with `frame`, `nframes` and `trajectory_controls()`
- Unit cells from extended XYZ `Lattice` or PDB `CRYST1` (`unitCell`, `cellColor`, `cellRadius`)

### Fixed
- Widget did not render on ipywidgets 7 (only Lumino lifecycle messages were handled); the view now uses a ResizeObserver and works on ipywidgets 7 and 8
- Classic Notebook could not load the widget: missing `nbextension/extension.js` and wrong nbextension paths
- Trait changes after display (other than `bonds` and `atomScale`) were ignored
- A new WebGL context was created on every resize, and contexts and listeners were never released
- Rendering now uses the display pixel density; auto-fit ignores hidden waters and ligands
- Zooming a wide or tall viewer no longer drifts off center

### Changed
- Python 3.8 is supported again (tested on 3.8, 3.9 and 3.10)
- The renderer and viewer are shared with the new stspeck package (`core/` in the repository)
- Ambient occlusion shows at full strength immediately and refines as samples accumulate
- Unit cells are off by default (`unitCell=True`, or the ASE / pymatgen loaders, turn them on)

## [0.7.0] - 2024-12-04

### Added
- Support for ipywidgets 8.x while maintaining backward compatibility with ipywidgets 7.x
- Modern JupyterLab 3+ federated extension system support
- Dual lifecycle methods for PhosphorJS (legacy) and LuminoJS (modern) compatibility
- TypeScript-based widget implementation for better type safety and maintainability

### Changed
- **BREAKING**: Minimum Python version increased to 3.9
- **BREAKING**: Minimum JupyterLab version increased to 3.0
- Migrated from JupyterLab 2.x AMD module system to JupyterLab 3+ federated extensions
- Updated build system to use webpack 5 and modern tooling
- Updated @jupyterlab/builder to 4.5.0
- Removed upper bound on ipywidgets dependency (was `<8`, now `>=7.0`)
- Improved installation process - no manual extension installation required for JupyterLab 3+

### Fixed
- Widget loading errors in JupyterLab 3+ ("Error: No version of module ipyspeck is registered")
- Compatibility issues with ipywidgets 8.x
- Deprecated PhosphorJS usage warnings

### Migration Guide

#### For Users

**Upgrading from 0.6.x to 0.7.0:**

If you're using JupyterLab 3+ and ipywidgets 7+:
```bash
pip install --upgrade ipyspeck
```

If you're using older versions:
```bash
# Stay on 0.6.x for JupyterLab 2.x
pip install "ipyspeck<0.7"
```

**What's Changed:**
- No more manual `jupyter labextension install` needed for JupyterLab 3+
- Extension automatically installs and enables with `pip install`
- Widget behavior and API remain the same - no code changes needed

#### For Developers

**Key Infrastructure Changes:**
- Build system migrated from webpack 3 to webpack 5
- Added TypeScript compilation step
- Modern hatchling build backend with hatch-jupyter-builder
- Labextension now uses federated module system
- Widget implements both `processPhosphorMessage()` and `processLuminoMessage()` for compatibility

## [0.6.2] - 2023-XX-XX

### Previous Releases
- Support for JupyterLab 2.x
- ipywidgets 7.x support
- Streamlit integration
- Basic molecular visualization features

---

For older versions and detailed commit history, see the [GitHub releases page](https://github.com/denphi/speck/releases).
