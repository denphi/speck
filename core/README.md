# Speck core

The renderer and viewer shared by the two Python packages in this repository:

- `jupyter/` — **ipyspeck**, the Jupyter widget (ipywidgets 7 and 8)
- `streamlit/` — **stspeck**, the Streamlit component

`src/*.js` is the WebGL renderer (atoms, bonds, cartoon, surface, ambient occlusion,
shadows, materials...), and `src/viewer.ts` is `SpeckViewer`, the framework-independent
interactive viewer (toolbar, camera, trajectories, export). Each package adapts
`SpeckViewer` to its host through a small `ViewerHost` interface. `css/speck.css`
styles the viewer.

Both packages build this folder first (`tsc -p ../core`), which writes `lib/`; nothing
here has npm dependencies.

The renderer derives from [Speck](https://github.com/wwwtyro/speck) by wwwtyro (public domain,
`../LICENSE-SPECK`); this repository's changes are under the BSD 3-Clause License (`../LICENSE`).
