# Changelog

## [Unreleased]

### Added
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
- `speck(..., film=[...], film_loop=True, video={...})`: the film plays in the component, and its download
  button saves the MP4
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
- `speck(trajectory=...)` and `count_frames(data, trajectory)` for binary MD frames
- Large structures: a ribosome (237,685 atoms) renders as atoms and bonds at 60 fps. Atoms and bonds are
  drawn with instancing (stored once instead of once per vertex: about 40x less memory for bonds), bonds are
  found with a spatial grid (0.5 s instead of minutes; the same bonds), ambient-occlusion samples per frame
  are limited by the scene's vertex count so huge scenes refine over more frames instead of stalling the
  GPU, and GPU buffers are released when the scene is rebuilt
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
- `fetch_pdb` downloads mmCIF (`format="pdb"` for the legacy file), so every RCSB entry loads, including
  ribosomes and other large complexes; `read_file` reads `.cif`, `.mmcif`, `.sdf` and `.mol` (and `.gz`)
- `from_rdkit` passes RDKit's own bonds (a Molfile) instead of guessing them from distances
- `count_frames` counts mmCIF models and SDF conformers

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
