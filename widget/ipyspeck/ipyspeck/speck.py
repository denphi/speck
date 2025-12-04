import ipywidgets as widgets
from traitlets import Unicode, Bool, Float, validate, TraitError


@widgets.register
class Speck(widgets.DOMWidget):
    """
    A class used to represent an Speck molecule

    ...

    Attributes
    ----------
    _view_name : str
        (DOMWidget) Name of the widget view class in front-end
    _model_name :dofStrength
        Name of the widget model class in front-end
    _view_module : str
        (DOMWidget) Name of the front-end module containing widget view
    _model_module : str
        (DOMWidget) Name of the front-end module containing widget model
    _view_module_version : str
        (DOMWidget) Version of the front-end module containing widget view
    _model_module_version : str
        (DOMWidget) Version of the front-end module containing widget model
    data : str
        xyz model, default(True)
    bonds : bool
        Enable visualizations of bonds?, default(True)
    atomScale : float
        Atom radius, size of spheres, default(0.24)
    relativeAtomScale : float
        Relative atom radius, default(0.64)
    bondScale : float
        bonds size, size of the tubes connecting atoms, default(0.5)
    brightness : float
        brightness, default(0.5)
    outline : float
        Outline strength, default(0.0)
    spf : float
        Samples per frame, default(32)
    bondThreshold : float
        Bonding radius, defines the max distance for atoms to be connected,
        default(1.2)
    bondShade : float
        bonds shade, default(0.5)
    atomShade : float
        Atoms shade, default(0.5)
    dofStrength : float
        Depth of field strength, default(0.0)
    dofPosition : float
        Depth of field position, default(0.5)

    Methods
    -------
    frontview()
        Change to front camera / view
    topview()
        Change to top camera / view
    rightview()
        Change to right camera / view
    setAtomColor(atom, color)
        Set the 'color' of all atoms with the name 'atom'
    setAtomsColor(atoms)
        Set multiple colors to atoms
    setColorSchema(schema)
        Set the color Schema
    switchColorSchema()
        Switch to the next available schema
    """

    _view_name = Unicode('SpeckView').tag(sync=True)
    _model_name = Unicode('SpeckModel').tag(sync=True)
    _view_module = Unicode('ipyspeck').tag(sync=True)
    _model_module = Unicode('ipyspeck').tag(sync=True)
    _view_module_version = Unicode('^0.7.0').tag(sync=True)
    _model_module_version = Unicode('^0.7.0').tag(sync=True)
    data = Unicode('').tag(sync=True)
    bonds = Bool(True).tag(sync=True)
    atomScale = Float(0.24).tag(sync=True)
    relativeAtomScale = Float(0.64).tag(sync=True)
    bondScale = Float(0.5).tag(sync=True)
    brightness = Float(0.5).tag(sync=True)
    outline = Float(0.0).tag(sync=True)
    spf = Float(32).tag(sync=True)
    bondThreshold = Float(1.2).tag(sync=True)
    bondShade = Float(0.5).tag(sync=True)
    atomShade = Float(0.5).tag(sync=True)
    dofStrength = Float(0.0).tag(sync=True)
    dofPosition = Float(0.5).tag(sync=True)

    @validate('data')
    def _valid_data(self, proposal):
        if False:
            raise TraitError('Invalid XYZ')
        return proposal['value']

    def frontview(self):
        """Rotates the molecule model to visualize the front view"""
        self.send({"do": "frontView"})

    def topview(self):
        """Rotates the molecule model to visualize the top view"""
        self.send({"do": "topView"})

    def rightview(self):
        """Rotates the molecule model to visualize the rigth view"""
        self.send({"do": "rightView"})

    def setAtomColor(self, atom, color):
        """Set the color of atom types

        Parameters
        ----------
        atom : str
            Atom Name
        color : list
            A list with 3 rgb normalized values [0 - 1]
        """
        self.setAtomsColor({atom: color})

    def setAtomsColor(self, atoms):
        """Set the color of multiple atom types

        Parameters
        ----------
        atoms : dict
            A dictionary with tuples key as str and value rgb normalized values
            [0 - 1]
        """
        for atom, rgb in atoms.items():
            if not isinstance(atom, str):
                raise Exception(
                    "atom names should be str,  '" + type(atom) + "' passed"
                )
            if len(rgb) != 3:
                raise Exception("RGB values should contain exactly 3 elements")
            for i in range(3):
                if rgb[i] < 0 or rgb[i] > 1:
                    raise Exception("RGB values should be [0 - 1] range")
        self.send({"do": "changeAtomsColor", "atoms": atoms})

    def setColorSchema(self, schema):
        """Set the color schema used by Speck, overwrites any custom change in
           atom color

        Parameters
        ----------
        schema : str
            name of the schema/palette to use
        """
        self.send({"do": "changeColorSchema", "schema": schema})

    def switchColorSchema(self):
        """Switch to the next available color schema """
        self.send({"do": "changeColorSchema"})
