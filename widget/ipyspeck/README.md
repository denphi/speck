# ipyspeck

A Jupyter Widget for rendering beautiful molecular structures using Speck.

<table>
    <tr>
        <td>Latest Release</td>
        <td>
            <a href="https://pypi.org/project/ipyspeck/"/>
            <img src="https://badge.fury.io/py/ipyspeck.svg"/>
        </td>
    </tr>
    <tr>
        <td>PyPI Downloads</td>
        <td>
            <a href="https://pepy.tech/project/ipyspeck"/>
            <img src="https://static.pepy.tech/badge/ipyspeck/month"/>
            <img src="https://static.pepy.tech/badge/ipyspeck"/>
        </td>
    </tr>
</table>

## About

Speck is a molecule renderer with the goal of producing figures that are as attractive as they are practical. Express your molecule clearly _and_ with style.

![speck](https://raw.githubusercontent.com/wwwtyro/speck/gh-pages/static/screenshots/demo-2.png)

Ipyspeck is an ipywidget wrapper for Speck that allows you to visualize molecular structures directly in Jupyter notebooks and JupyterLab.

## Version Compatibility

> **⚠️ IMPORTANT: Version Compatibility Notice**
>
> **ipyspeck 0.7.x and later** requires:
> - JupyterLab >= 3.0
> - ipywidgets >= 7.0
> - Python >= 3.9
>
> **For older environments**, use ipyspeck 0.6.x:
> - JupyterLab 2.x → use `ipyspeck<0.7`
> - ipywidgets < 7.0 → use `ipyspeck<0.7`
> - Python < 3.9 → use `ipyspeck<0.7`
>
> **Migration Notes:**
> - Version 0.7.0+ uses the modern JupyterLab 3+ federated extension system
> - Version 0.7.0+ supports both ipywidgets 7.x and 8.x with backward compatibility
> - Version 0.7.0+ uses Lumino (LuminoJS) instead of deprecated PhosphorJS

## Installation

### Standard Installation

For JupyterLab 3+ and ipywidgets 7+:

```bash
pip install ipyspeck
```

That's it! The extension will be automatically enabled in JupyterLab 3+.

### Legacy Installation (JupyterLab 2.x)

For older JupyterLab versions:

```bash
pip install "ipyspeck<0.7"
jupyter nbextension enable --py --sys-prefix ipyspeck
jupyter labextension install ipyspeck
```

### Development Installation

For developers who want to contribute:

```bash
git clone https://github.com/denphi/speck.git
cd speck/widget/ipyspeck
pip install -e .
```

## Usage

### Basic Usage

The ipyspeck widget renders molecules in XYZ format:

![h2o](https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/h2o.png)

```python
from ipyspeck import Speck

H2O = '''3
Water molecule
O          0.00000        0.00000        0.11779
H          0.00000        0.75545       -0.47116
H          0.00000       -0.75545       -0.47116'''

h2o = Speck(data=H2O)
h2o
```

### Using with Container Widgets

For better control over size and layout, use ipyspeck inside container widgets:

![h2oc](https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/h2oc.png)

```python
import ipywidgets as widgets

# Create a sized container
container = widgets.Box(
    [h2o],
    layout=widgets.Layout(width="600px", height="400px")
)
container
```

### Customization

Adjust visualization parameters to suit your needs:

```python
# Modify atom size
h2o.atomScale = 0.3

# Change bond thickness
h2o.bondScale = 0.3

# Toggle atom outlines
h2o.outline = 0
```

### Working with Different File Formats

Use OpenBabel to convert various molecular formats to XYZ:

```python
import openbabel
import requests

# Fetch a molecule in SDF format
url = "https://files.rcsb.org/ligands/view/CO2_ideal.sdf"
r = requests.get(url)

# Convert to XYZ
obConversion = openbabel.OBConversion()
obConversion.SetInAndOutFormats("sdf", "xyz")
mol = openbabel.OBMol()
obConversion.ReadString(mol, r.text)
co2 = obConversion.WriteString(mol)

# Visualize
Speck(data=co2)
```

![co2](https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/co2.png)

### Streamlit Integration

ipyspeck 0.6+ includes a Streamlit wrapper for building interactive web apps:

```python
import streamlit as st
from ipyspeck import stspeck

H2O = '''3
Water molecule
O          0.00000        0.00000        0.11779
H          0.00000        0.75545       -0.47116
H          0.00000       -0.75545       -0.47116'''

with st.sidebar:
    ao = st.selectbox("Ambient Occlusion", [0, 0.1, 0.2, 0.5, 0.8, 1])
    bonds = st.selectbox("Show Bonds", [True, False])

res = stspeck.Speck(
    data=H2O,
    ao=ao,
    bonds=bonds,
    width="800px",
    height="600px"
)
```

![streamlit](https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/st.png)

## Features

- 🎨 Beautiful, publication-quality molecular visualizations
- 🔄 Interactive rotation and zoom
- ⚡ Fast rendering with WebGL
- 🎛️ Customizable atom and bond styles
- 📦 Support for XYZ format (use OpenBabel for other formats)
- 🧪 Works in Jupyter Notebook, JupyterLab, and Streamlit
- 🔌 Compatible with ipywidgets ecosystem

## Gallery

<img src="https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/loop.gif" width=500px/>

<img src="https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/img1.png" width=500px/>

<img src="https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/img2.png" width=500px/>

<img src="https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/img3.png" width=500px/>

<img src="https://raw.githubusercontent.com/denphi/speck/master/widget/ipyspeck/img/img4.png" width=500px/>

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build TypeScript and JavaScript
npm run build

# Or build for production
npm run build:prod
```

### Active Development

When actively developing the extension:

```bash
# Watch for changes and rebuild automatically
jupyter lab --watch
```

Note: On first `jupyter lab --watch`, you may need to touch a file to trigger JupyterLab to open.

## License

BSD-3-Clause

## Author

Daniel Mejia (Denphi) - denphi@denphi.com

## Links

- [GitHub Repository](https://github.com/denphi/speck)
- [PyPI Package](https://pypi.org/project/ipyspeck/)
- [Issue Tracker](https://github.com/denphi/speck/issues)
