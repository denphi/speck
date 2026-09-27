# Speck

Speck is a molecule renderer with the goal of producing figures that are as attractive as they are practical. Express your molecule clearly _and_ with style.

<p align="center">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-2.png">
</p>

## Python packages

This repository also hosts two Python packages built on the same renderer:

| Folder | Package | Use it in |
|---|---|---|
| [`jupyter/`](jupyter/) | **ipyspeck** | Jupyter Notebook / JupyterLab (ipywidgets 7 and 8) |
| [`streamlit/`](streamlit/) | **stspeck** | Streamlit apps |
| [`core/`](core/) | — | Shared renderer and viewer used by both |

Both add cartoons, molecular surfaces (optionally transparent), metallic and glossy
materials, shadows, fog, highlighting, trajectories, unit cells and high-resolution
export on top of the ambient-occlusion renderer described below.

## Try it live

Try speck out live in your browser here: http://wwwtyro.github.io/speck/

## Features

#### Ambient Occlusion

Ambient occlusion provides much more information about molecule structure than simple direct lighting. It's incredibly useful for large and small molecule viewing alike. Easily Speck's most important feature.

<p align="center">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-9.png">
</p>

#### Pixel-perfect atoms and bonds

Speck renders atoms and bonds not with polygons, but with imposters. This means you can zoom in as close as you like and surfaces remain smooth, not faceted.

<p align="center">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-0.png">
</p>

#### Depth-aware outlines

Speck can render atom outlines that are depth-aware. Instead of making your molecule appear to be a collection of flat circles, depth-aware outlines provide cues to the viewer that convey information about the molecular structure.

<p align="center">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-5.png">
</p>

#### Depth of field

Render a more attractive figure while simultaneously drawing your viewer's eye to a region you want to highlight.

<p align="center">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-1.png">
</p>

#### Mix and match rendering options

Speck goes to great lengths to decouple rendering options, so that you have the flexibility to present your data in the most clear and attractive way.

<p align="center">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-3.png">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-6.png">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-4.png">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-7.png">
  <img src="https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-8.png">
</p>

#### Compilation

* npm install --save webpack
* npm install --save jquery@2.2.4
* npm install --save keyboardjs
* npm install --save lodash
* npm install --save lz-string
* npx webpack
