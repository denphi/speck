ipyspeck
===============================

## ipypeck

Ipyspeck is a ipywidget wrapping speck to be used on a Jupyter notebook as a regular widget.

## Usage

The ipyspeck widget renders xyz molecules.

```python
import ipyspeck

H2O='''3
Water molecule
O          0.00000        0.00000        0.11779
H          0.00000        0.75545       -0.47116
H          0.00000       -0.75545       -0.47116'''
h2o = ipyspeck.speck.Speck(data=H2O)
h2o
```

Ideally it should be used as part of a container widget (such as Box, VBox, Grid, ...)


```python

import ipywidgets as w
c = w.Box([h2o], layout=w.Layout(width="600px",height="400px"))
c
```

The visualization parameters can be modified
```python
#Modify atoms size
h2o.atomScale = 0.3
#change bonds size
h2o.bondScale = 0.3
#highlight borders
h2o.outline = 0
```

To render molecules on different formats  openbabel can be used to translate them as xyz

```python
import openbabel
import requests
url = "https://files.rcsb.org/ligands/view/CO2_ideal.sdf"
r = requests.get(url)
obConversion = openbabel.OBConversion()
obConversion.SetInAndOutFormats("sdf", "xyz")
mol = openbabel.OBMol()
obConversion.ReadString(mol, r.text)
co2 = obConversion.WriteString(mol)
ipyspeck.speck.Speck(data=co2)
```


# Package Install
---------------

**Prerequisites**
- [node](http://nodejs.org/)

```bash
npm install --save ipyspeck
```
