"use strict";
// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeckView = exports.SpeckModel = void 0;
const base_1 = require("@jupyter-widgets/base");
const version_1 = require("./version");
// Import the existing Speck JavaScript modules
const speckRenderer = require('./renderer.js');
const speckSystem = require('./system.js');
const speckView = require('./view.js');
const speckInteractions = require('./interactions.js');
const speckColors = require('./colors.js');
// Import the CSS
require("../css/widget.css");
class SpeckModel extends base_1.DOMWidgetModel {
    defaults() {
        return Object.assign(Object.assign({}, super.defaults()), { _model_name: SpeckModel.model_name, _model_module: SpeckModel.model_module, _model_module_version: SpeckModel.model_module_version, _view_name: SpeckModel.view_name, _view_module: SpeckModel.view_module, _view_module_version: SpeckModel.view_module_version, data: '', bonds: true, atomScale: 0.24, relativeAtomScale: 0.64, bondScale: 0.5, brightness: 0.5, outline: 0.0, spf: 32, bondThreshold: 1.2, bondShade: 0.5, atomShade: 0.5, dofStrength: 0.0, dofPosition: 0.5 });
    }
}
exports.SpeckModel = SpeckModel;
SpeckModel.serializers = Object.assign({}, base_1.DOMWidgetModel.serializers);
SpeckModel.model_name = 'SpeckModel';
SpeckModel.model_module = version_1.MODULE_NAME;
SpeckModel.model_module_version = version_1.MODULE_VERSION;
SpeckModel.view_name = 'SpeckView';
SpeckModel.view_module = version_1.MODULE_NAME;
SpeckModel.view_module_version = version_1.MODULE_VERSION;
class SpeckView extends base_1.DOMWidgetView {
    initialize(parameters) {
        super.initialize(parameters);
        this.system = speckSystem.new();
        this.view = speckView.new();
        this.view.resolution.x = 200;
        this.view.resolution.y = 200;
        this.view.bonds = this.model.get('bonds');
        this.view.atomScale = this.model.get('atomScale');
        this.view.relativeAtomScale = this.model.get('relativeAtomScale');
        this.view.bondScale = this.model.get('bondScale');
        this.view.brightness = this.model.get('brightness');
        this.view.outline = this.model.get('outline');
        this.view.spf = this.model.get('spf');
        this.view.bondThreshold = this.model.get('bondThreshold');
        this.view.bondShade = this.model.get('bondShade');
        this.view.atomShade = this.model.get('atomShade');
        this.view.dofStrength = this.model.get('dofStrength');
        this.view.dofPosition = this.model.get('dofPosition');
        this.renderer = null;
        this.needReset = false;
        this.current_schema = 'speck';
    }
    render() {
        const self = this;
        self.container = document.createElement('div');
        self.canvas = document.createElement('canvas');
        self.canvas.addEventListener('dblclick', function () {
            self.center();
        });
        self.topbar = document.createElement('div');
        self.topbar.style.top = '0px';
        self.topbar.style.height = '20px';
        self.topbar.style.right = '0px';
        self.topbar.style.position = 'absolute';
        self.topbar.style.background = 'rgba(255,255,255,0.5)';
        self.topbar.style.flexDirection = 'row';
        self.topbar.style.alignContent = 'flex-end';
        self.topbar.style.display = 'flex';
        self.container.appendChild(self.canvas);
        self.el.appendChild(self.topbar);
        self.el.appendChild(self.container);
        self.el.style.width = '100%';
        self.el.style.height = '100%';
        speckInteractions({
            container: self.container,
            scrollZoom: true,
            getRotation: function () {
                return self.view.rotation;
            },
            setRotation: function (t) {
                self.view.rotation = t;
            },
            getTranslation: function () {
                return self.view.translation;
            },
            setTranslation: function (t) {
                self.view.translation = t;
            },
            getZoom: function () {
                return self.view.zoom;
            },
            setZoom: function (t) {
                self.view.zoom = t;
            },
            refreshView: function () {
                self.needReset = true;
            },
        });
        // Set up model change listeners
        this.model.on('change:data', this.loadStructure, this);
        this.model.on('change:bonds', () => {
            this.view.bonds = this.model.get('bonds');
            this.needReset = true;
        });
        this.model.on('change:atomScale', () => {
            this.view.atomScale = this.model.get('atomScale');
            this.needReset = true;
        });
        this.model.on('msg:custom', this.handleCustomMessage, this);
    }
    processLuminoMessage(msg) {
        super.processLuminoMessage(msg);
        this._handleMessage(msg);
    }
    _handleMessage(msg) {
        const self = this;
        switch (msg.type) {
            case 'before-attach':
                window.addEventListener('resize', function () {
                    self.reflow();
                    self.loadStructure();
                });
                break;
            case 'after-attach':
                self.reflow();
                self.loop();
                self.loadStructure();
                break;
            case 'resize':
                self.reflow();
                self.center();
                break;
        }
    }
    handleCustomMessage(message) {
        if ('do' in message) {
            if (message.do === 'frontView') {
                this.frontview();
            }
            else if (message.do === 'topView') {
                this.topview();
            }
            else if (message.do === 'rightView') {
                this.rightview();
            }
            else if (message.do === 'changeAtomsColor') {
                this.setAtomsColor(message.atoms);
            }
            else if (message.do === 'changeColorSchema') {
                this.setColorSchema(message.schema);
            }
            else if (message.do === 'switchColorSchema') {
                this.switchColorSchema();
            }
        }
    }
    loadStructure() {
        const data = this.xyz(this.model.get('data'))[0];
        if (data) {
            this.system = speckSystem.new();
            for (let i = 0; i < data.length; i++) {
                const a = data[i];
                speckSystem.addAtom(this.system, a.symbol, a.position[0], a.position[1], a.position[2]);
            }
            this.center();
        }
    }
    center() {
        if (this.system) {
            speckSystem.center(this.system);
            speckSystem.calculateBonds(this.system, this.view);
            this.renderer.setSystem(this.system, this.view);
            speckView.center(this.view, this.system);
            this.needReset = true;
        }
    }
    topview() {
        if (this.system) {
            speckView.rotateX(this.view, Math.PI / 2);
            this.center();
        }
    }
    frontview() {
        if (this.system) {
            speckView.rotateX(this.view, 0);
            this.center();
        }
    }
    rightview() {
        if (this.system) {
            speckView.rotateY(this.view, -Math.PI / 2);
            this.center();
        }
    }
    setAtomsColor(atoms) {
        for (const atom in atoms) {
            if (atom in this.view.elements) {
                this.view.elements[atom].color = atoms[atom];
                this.needReset = true;
            }
        }
        if (this.needReset) {
            speckSystem.calculateBonds(this.system, this.view);
            this.renderer.setSystem(this.system, this.view);
        }
    }
    setColorSchema(schema) {
        if (schema in speckColors) {
            this.current_schema = schema;
            this.setAtomsColor(speckColors[schema]);
        }
    }
    switchColorSchema() {
        let update_color = false;
        let first_color;
        for (const color in speckColors) {
            if (first_color === undefined)
                first_color = color;
            if (update_color) {
                this.setColorSchema(color);
                return;
            }
            if (color === this.current_schema) {
                update_color = true;
            }
        }
        if (first_color)
            this.setColorSchema(first_color);
    }
    xyz(data) {
        const lines = data.split('\n');
        const natoms = parseInt(lines[0]);
        const nframes = Math.floor(lines.length / (natoms + 2));
        const trajectory = [];
        for (let i = 0; i < nframes; i++) {
            const atoms = [];
            for (let j = 0; j < natoms; j++) {
                const line = lines[i * (natoms + 2) + j + 2].split(/\s+/);
                const atom = {};
                let k = 0;
                while (line[k] === '')
                    k++;
                atom.symbol = line[k++];
                atom.position = [parseFloat(line[k++]), parseFloat(line[k++]), parseFloat(line[k++])];
                atoms.push(atom);
            }
            trajectory.push(atoms);
        }
        return trajectory;
    }
    reflow() {
        let ww = this.container.parentElement.clientWidth;
        let wh = this.container.parentElement.clientHeight;
        if (ww === 0)
            ww = this.view.resolution.x;
        if (wh === 0)
            wh = this.view.resolution.y;
        if (this.view.resolution.x === ww && this.view.resolution.y === wh)
            return;
        this.container.style.height = wh + 'px';
        this.container.style.width = ww + 'px';
        this.container.style.left = '0px';
        this.container.style.top = '0px';
        this.view.resolution.x = ww;
        this.view.resolution.y = wh;
        this.renderer = new speckRenderer(this.canvas, this.view.resolution, this.view.aoRes);
    }
    loop() {
        if (this.needReset) {
            this.renderer.reset();
            this.needReset = false;
        }
        this.renderer.render(this.view);
        requestAnimationFrame(() => this.loop());
    }
}
exports.SpeckView = SpeckView;
//# sourceMappingURL=widget.js.map