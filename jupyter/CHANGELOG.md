# Changelog

All notable changes to ipyspeck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Faster, lighter rendering: a viewer uses about 60 - 70 % less GPU memory (render targets sized to the
  canvas instead of a square, no multisampled canvas, surface and shadow layers only when used, compact
  indexed meshes); it stops drawing once the picture is complete and while scrolled out of sight (no GPU
  work when idle); ambient occlusion converges up to 3x faster; the viewer redraws itself after the
  browser resets the GPU

### Added
- Ready-made videos by name (`spin`, `rock`, `orbit`, `tour`, `focus`, `reveal`, `trajectory`, `showcase`):
  they find the structure's ligand or trajectory and turn a ligand toward the viewer; `seconds`, `target`,
  `title` and `subtitle` adjust them (`shots.RECIPES`, `shots.video()`)
- A video button (clapperboard) in the viewer's toolbar: pick a video and a size, watch it, press
  **Save video**; no code needed
- Step-by-step video notebooks for researchers (`example/videos`) and preview clips of every video
- Films: camera moves and changes over time as a list of shots (`shots`: turntable, rock, orbit, zoom,
  fly_to a selection, home, rack_focus, cut_open, fade any setting, crossfade, trajectory, title, keyframes,
  together), with easing
- Film preview in the viewer with a player bar (play / pause, scrubber, time, MP4 download, close); the
  view returns to how it was when the player closes
- Video export: every frame fully shaded with ambient occlusion fixed to the molecule (no flicker), MP4
  (H.264) encoded in the browser with WebCodecs; named sizes (720p to 4K, square, vertical 9:16, portrait
  4:5), solid / gradient / radial backgrounds, vignette, titles, credit line, optional motion blur;
  progress with a Cancel button
- Trajectories play smoothly in films: coordinates are interpolated between frames
- `Speck.preview(film)`, `Speck.stop_preview()`, `Speck.save_video(filename, film, ...)` (MP4 from the
  browser; GIF, WebM, MOV or PNG frames written in Python) and `Speck.keyframe()` for `shots.keyframes`;
  `save_video("movie.mp4")` alone makes a spin, `quality='draft' | 'good' | 'best'`, and the viewer says
  when the file is saved
- Requests made before the viewer has loaded (e.g. `display(w); w.save_video(...)` in one cell) wait
  for the structure instead of being lost; a widget shown twice renders an export once
- Videos and images keep what is on screen when their shape differs from the viewer's (zoomed-in views
  are no longer refitted to the whole structure)
- Loading another structure during a video export stops it with a message instead of saving blank frames
- Atoms with unreadable coordinates (a damaged or cut-short file) are skipped with a notice instead of
  hiding the whole structure; a file with no atoms says so
- GIFs default to 480p at 15 fps; `pip install "ipyspeck[video]"` adds what GIF, WebM and MOV need
- Crossfades that hold still render each picture once (about twice as fast)
- Demo site: an Animate section with ready-made films, preview and MP4 export, included in Copy as Python

## [0.8.3] - 2026-09-27

### Added
- mmCIF (PDBx/mmCIF) support: the PDB's standard format, needed for entries that PDB files cannot hold
  (over 99,999 atoms or 62 chains, multi-character chain IDs, five-character ligand codes). Atoms, author
  numbering, helices and sheets, all models (as frames), B-factors / pLDDT, the unit cell and
  `_struct_conn` bonds are read; the result matches the PDB reader atom for atom
- MDL Molfile / SDF support (V2000 and V3000), with the file's bonds; conformers become frames
- Bonds from the file are always drawn: PDB CONECT records, mmCIF `_struct_conn` (covalent, disulfide,
  metal) and SDF / MOL bond tables, e.g. long metal-ligand bonds that the distance rule misses
- The format is detected from the content; `.gz` files are read directly
- Studio floor (`floor`, `floorReflection`; off by default): a soft ground tone, contact shadow and
  reflection under the molecule, on any background; turning it on makes room below the molecule
- Goodsell style: the `goodsell` look (space-filling atoms in flat pastel colors per chain, thin outlines
  between molecules and at depth steps, darker with depth, ligands in one accent color), matching the PDB-101
  Molecule of the Month illustrations
- Palettes (`palette`: goodsell, pastel, colorblind, viridis, grays) for chain, entity and type coloring;
  new schemes `entity` (every copy of a molecule alike, from mmCIF) and `type` (protein / nucleic acid) for
  cartoons, surfaces and atoms
- Atom coloring (`atomColor`): atoms by chain, entity, type, secondary structure or rainbow, not only by
  element; heteroatoms stay a shade darker
- Cutaway (`cutaway`): slice away the front of the structure to show its inside, with cut atoms, bonds,
  cartoons and surfaces capped; ambient occlusion and shadows follow the cut. `cutawayAxis` fixes the plane
  across the molecule's x, y or z axis (default: facing the camera), and `cutawayLight` adds light entering
  through the cut, so the inside is not lost in shadow
- Cutaway toolbar button: slices the structure open (at the last depth used, or through the center) and
  closes it again
- Studio floor toolbar button: turns the floor on (at the last strength used) and off
- Coarse models: residues modeled by their Cα (or P) atom only count as protein (nucleic acid) and are drawn
  as one residue-sized sphere, so CA-only chains read as solid molecules
- `outlineMode="molecules"` (outlines between molecules and at silhouettes only) and `water` (hide waters)
- Gallery: seven new images (hemoglobin and a gold cluster on the studio floor; hemoglobin, the capsid and the
  large ribosomal subunit in Goodsell style; the capsid cut open; the 180-copy MS2 capsid), with notebooks
- Loading panel: large loads list each step as it runs, with what it found: downloading (demo site, with MB
  received), unpacking the data from Python (Jupyter), reading the file (with its progress), placing atoms,
  residues and secondary structure (e.g. "19,845 residues in 89 chains · 25% helix, 12% strand"), bonds, and
  building the cartoon / surface; then a small "Shading n%" label until ambient occlusion has converged.
  Loads under 0.15 s show nothing, and errors stay on the panel. Hosts can add steps with
  `SpeckViewer.progress()`
- Biological assemblies: `from_pdb_id("1STM", assembly=1)` / `fetch_pdb(..., assembly=1)` load the complete
  assembly from RCSB, e.g. all 60 copies of a virus capsid (the demo site accepts `1STM-assembly1`)
- MD trajectories: `from_mdtraj(traj, stride)` and `from_mdanalysis(universe or atom group, start, stop, step)`;
  the topology keeps residues and chains (cartoons follow the motion) and the frames travel as binary float32
  coordinates (12 bytes per atom and frame)
- Gallery: the human 80S ribosome (237,685 atoms, mmCIF only) and a complete virus capsid (1STM assembly),
  with their notebooks
- `data` reaches the browser gzipped as a binary buffer (the 28 MB ribosome mmCIF travels as about 7 MB)
- `set_trajectory(coords)`: frames (frames, atoms, 3) for the current structure
- Large structures: a ribosome (237,685 atoms) renders as atoms and bonds at 60 fps. Atoms and bonds are
  drawn with instancing (stored once instead of once per vertex: about 40x less memory for bonds), bonds are
  found with a spatial grid (0.5 s instead of minutes; the same bonds), ambient-occlusion samples per frame
  are limited by the scene's vertex count so huge scenes refine over more frames instead of stalling the
  GPU, and GPU buffers are released when the scene is rebuilt
- Stale frontend warning: when Jupyter would serve a browser extension of another version than the Python
  package (e.g. an old copy in `~/.local/share/jupyter`), a warning names the folder; Classic Notebook also
  shows a notice in the viewer
- Large structures load in a Web Worker (mmCIF over 2 MB), so the page stays responsive: the ribosome now
  blocks the main thread for about 0.3 s instead of 1.6 s; bonds are built from a dense grid into typed
  arrays (0.1 s, a fifth of the memory); cartoons of huge structures use a coarser tube to stay under about
  6.5M vertices (every gallery structure keeps full quality); atoms and bonds are drawn as triangle strips
  (4 and 14 vertices instead of 6 and 36)
- Exports reuse the viewer's WebGL context instead of building a second renderer, so large structures are not
  held twice in GPU memory; render targets are released on resize (they leaked before)

### Changed
- Secondary structure from the file is used per chain; chains it does not cover (for example the copies in
  some assembly files) get it from backbone H-bonds instead of being drawn as coil
- `from_pdb_id` downloads mmCIF (`format="pdb"` for the legacy file), so every RCSB entry loads, including
  ribosomes and other large complexes; `from_file` reads `.cif`, `.mmcif`, `.sdf` and `.mol` (and `.gz`)
- `from_rdkit` passes RDKit's own bonds (a Molfile) instead of guessing them from distances

### Fixed
- A camera restored by the host (a saved `camera`, a gallery scene) was replaced by the default view when a
  large structure finished loading after a setting such as `autoRotate` changed

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
