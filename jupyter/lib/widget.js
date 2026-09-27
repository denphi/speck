"use strict";
// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeckView = exports.SpeckModel = void 0;
const base_1 = require("@jupyter-widgets/base");
const version_1 = require("./version");
// The viewer and renderer are shared with stspeck (see ../../core).
const viewer_1 = require("../../core/lib/viewer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inflate = require('../../core/lib/inflate.js');
require("../../core/css/speck.css");
class SpeckModel extends base_1.DOMWidgetModel {
    defaults() {
        return Object.assign(Object.assign(Object.assign({}, super.defaults()), { _model_name: SpeckModel.model_name, _model_module: SpeckModel.model_module, _model_module_version: SpeckModel.model_module_version, _view_name: SpeckModel.view_name, _view_module: SpeckModel.view_module, _view_module_version: SpeckModel.view_module_version, data: '', _data: null, _trajectory: null, toolbar: true, camera: {}, nframes: 1 }), viewer_1.VIEW_DEFAULTS);
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
// Jupyter adapter around SpeckViewer. The viewer sizes itself with a
// ResizeObserver, so the view does not depend on Phosphor/Lumino lifecycle
// messages (which differ between ipywidgets 7 and 8).
class SpeckView extends base_1.DOMWidgetView {
    constructor() {
        super(...arguments);
        this.applyingCamera = false;
        // The structure text, decoded from the gzipped `_data` buffer.
        this.text = '';
        this.textTicket = 0;
    }
    // Decodes `_data` (older saved widget states carry a plain `data` string).
    decodeData() {
        const ticket = ++this.textTicket;
        const raw = this.model.get('_data');
        let done;
        if (raw && raw.byteLength > 0) {
            const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
            const large = bytes.length > 500e3;
            if (large) {
                this.viewer.progress('decompress', 'Unpacking the structure from Python (' + (bytes.length / 1e6).toFixed(1) + ' MB)');
            }
            done = inflate.gunzipText(bytes).then((text) => {
                if (large)
                    this.viewer.progressDone('decompress', (text.length / 1e6).toFixed(1) + ' MB of text');
                return text;
            });
        }
        else {
            done = Promise.resolve(this.model.get('data') || '');
        }
        return done.then((text) => {
            if (ticket !== this.textTicket)
                return false;
            this.text = text;
            return true;
        });
    }
    // Coordinates from set_trajectory() / from_mdtraj() as a Float32Array.
    trajectory() {
        const raw = this.model.get('_trajectory');
        if (!raw || raw.byteLength < 12)
            return null;
        const buffer = raw instanceof ArrayBuffer ? raw : raw.buffer;
        const offset = raw instanceof ArrayBuffer ? 0 : raw.byteOffset;
        const count = Math.floor(raw.byteLength / 4);
        // Float32Array views need 4-byte alignment; copy otherwise.
        return offset % 4 === 0
            ? new Float32Array(buffer, offset, count)
            : new Float32Array(buffer.slice(offset, offset + 4 * count));
    }
    reloadData() {
        this.decodeData().then((current) => {
            if (current)
                this.viewer.loadStructure();
        });
    }
    render() {
        this.viewer = new viewer_1.SpeckViewer(this.el, {
            get: (trait) => (trait === 'data' ? this.text : trait === 'trajectory' ? this.trajectory() : this.model.get(trait)),
            set: (changes) => {
                for (const trait in changes) {
                    this.model.set(trait, changes[trait]);
                }
                this.model.save_changes();
            },
            cameraChanged: (camera) => {
                this.applyingCamera = true;
                this.model.set('camera', camera);
                this.model.save_changes();
                this.applyingCamera = false;
            },
            framesChanged: (nframes) => {
                if (this.model.get('nframes') !== nframes) {
                    this.model.set('nframes', nframes);
                    this.model.save_changes();
                }
            },
        });
        // The browser extension should match the Python package. Classic Notebook
        // loads whatever copy Jupyter serves, e.g. a stale one in ~/.local.
        const expected = String(this.model.get('_view_module_version') || '').replace(/^[\^~]/, '');
        if (expected && expected !== version_1.MODULE_VERSION) {
            this.viewer.showNotice('ipyspeck ' + expected + ' is installed in Python, but the browser loaded version ' + version_1.MODULE_VERSION +
                '. Restart the Jupyter server and reload the page; if this stays, remove the old ipyspeck ' +
                'folder under share/jupyter (Python shows where).');
        }
        this.reloadData();
        this.model.on('change:_data change:data', () => this.reloadData(), this);
        this.model.on('change:_trajectory', () => this.viewer.loadStructure(), this);
        for (const trait of viewer_1.VIEW_TRAITS) {
            this.model.on('change:' + trait, () => this.viewer.setTrait(trait, this.model.get(trait)), this);
        }
        this.model.on('change:toolbar', () => this.viewer.updateToolbar(), this);
        this.model.on('change:camera', () => {
            if (!this.applyingCamera) {
                this.viewer.setCamera(this.model.get('camera'));
            }
        }, this);
        this.model.on('msg:custom', this.handleCustomMessage, this);
    }
    remove() {
        this.viewer.destroy();
        return super.remove();
    }
    handleCustomMessage(message) {
        const viewer = this.viewer;
        switch (message.do) {
            case 'frontView':
                return viewer.frontview();
            case 'topView':
                return viewer.topview();
            case 'rightView':
                return viewer.rightview();
            case 'center':
                return viewer.center();
            case 'changeAtomsColor':
                return viewer.setAtomsColor(message.atoms);
            case 'changeColorSchema':
                return message.schema === undefined ? viewer.switchColorSchema() : viewer.setColorSchema(message.schema);
            case 'switchColorSchema':
                return viewer.switchColorSchema();
            case 'snapshot':
                return viewer.snapshot();
            case 'saveImage':
                // Replies go back to Python with the PNG as a binary buffer.
                viewer.renderImage(message).then((image) => this.model.send({ event: 'image', id: message.id, width: image.width, height: image.height }, {}, [
                    image.png,
                ]), (e) => this.model.send({ event: 'image', id: message.id, error: String(e) }, {}));
                return;
            case 'saveAnimation':
                viewer
                    .renderAnimation(message, (index, count, image) => this.model.send({ event: 'frame', id: message.id, index: index, count: count, width: image.width, height: image.height }, {}, [image.png]))
                    .catch((e) => this.model.send({ event: 'frame', id: message.id, error: String(e) }, {}));
                return;
        }
    }
}
exports.SpeckView = SpeckView;
//# sourceMappingURL=widget.js.map