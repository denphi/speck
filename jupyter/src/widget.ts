// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.

import {
  DOMWidgetModel,
  DOMWidgetView,
  ISerializers,
} from '@jupyter-widgets/base';

import { MODULE_NAME, MODULE_VERSION } from './version';
// The viewer and renderer are shared with stspeck (see ../../core).
import { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS, videoSupported } from '../../core/lib/viewer';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inflate = require('../../core/lib/inflate.js');
import '../../core/css/speck.css';

export class SpeckModel extends DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: SpeckModel.model_name,
      _model_module: SpeckModel.model_module,
      _model_module_version: SpeckModel.model_module_version,
      _view_name: SpeckModel.view_name,
      _view_module: SpeckModel.view_module,
      _view_module_version: SpeckModel.view_module_version,
      data: '',
      _data: null,
      _trajectory: null,
      toolbar: true,
      camera: {},
      nframes: 1,
      ...VIEW_DEFAULTS,
    };
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
  };

  static model_name = 'SpeckModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'SpeckView';
  static view_module = MODULE_NAME;
  static view_module_version = MODULE_VERSION;
}

// Jupyter adapter around SpeckViewer. The viewer sizes itself with a
// ResizeObserver, so the view does not depend on Phosphor/Lumino lifecycle
// messages (which differ between ipywidgets 7 and 8).
export class SpeckView extends DOMWidgetView {
  private viewer: SpeckViewer;
  private applyingCamera = false;
  // The structure text, decoded from the gzipped `_data` buffer.
  private text = '';
  private textTicket = 0;

  // Decodes `_data` (older saved widget states carry a plain `data` string).
  private decodeData(): Promise<boolean> {
    const ticket = ++this.textTicket;
    const raw = this.model.get('_data');
    let done: Promise<string>;
    if (raw && raw.byteLength > 0) {
      const bytes =
        raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      const large = bytes.length > 500e3;
      if (large) {
        this.viewer.progress('decompress', 'Unpacking the structure from Python (' + (bytes.length / 1e6).toFixed(1) + ' MB)');
      }
      done = inflate.gunzipText(bytes).then((text: string) => {
        if (large) this.viewer.progressDone('decompress', (text.length / 1e6).toFixed(1) + ' MB of text');
        return text;
      });
    } else {
      done = Promise.resolve(this.model.get('data') || '');
    }
    return done.then((text: string) => {
      if (ticket !== this.textTicket) return false;
      this.text = text;
      return true;
    });
  }

  // Coordinates from set_trajectory() / from_mdtraj() as a Float32Array.
  private trajectory(): Float32Array | null {
    const raw = this.model.get('_trajectory');
    if (!raw || raw.byteLength < 12) return null;
    const buffer: ArrayBuffer = raw instanceof ArrayBuffer ? raw : raw.buffer;
    const offset = raw instanceof ArrayBuffer ? 0 : raw.byteOffset;
    const count = Math.floor(raw.byteLength / 4);
    // Float32Array views need 4-byte alignment; copy otherwise.
    return offset % 4 === 0
      ? new Float32Array(buffer, offset, count)
      : new Float32Array(buffer.slice(offset, offset + 4 * count));
  }

  private reloadData() {
    this.decodeData().then((current) => {
      if (current) this.viewer.loadStructure();
    });
  }

  render() {
    this.viewer = new SpeckViewer(this.el, {
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
    if (expected && expected !== MODULE_VERSION) {
      this.viewer.showNotice(
        'ipyspeck ' + expected + ' is installed in Python, but the browser loaded version ' + MODULE_VERSION +
          '. Restart the Jupyter server and reload the page; if this stays, remove the old ipyspeck ' +
          'folder under share/jupyter (Python shows where).'
      );
    }

    this.reloadData();
    this.model.on('change:_data change:data', () => this.reloadData(), this);
    this.model.on('change:_trajectory', () => this.viewer.loadStructure(), this);
    for (const trait of VIEW_TRAITS) {
      this.model.on('change:' + trait, () => this.viewer.setTrait(trait, this.model.get(trait)), this);
    }
    this.model.on('change:toolbar', () => this.viewer.updateToolbar(), this);
    this.model.on(
      'change:camera',
      () => {
        if (!this.applyingCamera) {
          this.viewer.setCamera(this.model.get('camera'));
        }
      },
      this
    );
    this.model.on('msg:custom', this.handleCustomMessage, this);
  }

  remove() {
    this.viewer.destroy();
    return super.remove();
  }

  // Renders a film for save_video(): an MP4 encoded here, sent back in
  // chunks, or (other formats, or no WebCodecs) the PNG frames.
  private saveVideo(message: any) {
    const viewer = this.viewer;
    const id = message.id;
    const fail = (e: any) => {
      const text = String((e && e.message) || e);
      this.model.send({ event: 'video', id: id, error: text }, {});
      if (text !== 'cancelled') viewer.progressFailed('Video export failed: ' + text);
    };
    const mp4 = message.format === 'mp4' && videoSupported();
    const options = { ...message, format: mp4 ? 'mp4' : 'frames' };
    viewer
      .renderFilm(message.film, options, (index, count, canvas) =>
        new Promise<void>((resolve) =>
          canvas.toBlob((blob) => {
            (blob as Blob).arrayBuffer().then((png) => {
              this.model.send({ event: 'frame', id: id, index: index, count: count }, {}, [png]);
              resolve();
            });
          }, 'image/png')
        )
      )
      .then((result) => {
        if (!result.mp4) return;
        const bytes = result.mp4;
        const CHUNK = 4 << 20;
        const count = Math.max(1, Math.ceil(bytes.length / CHUNK));
        for (let i = 0; i < count; i++) {
          const part = bytes.slice(i * CHUNK, (i + 1) * CHUNK);
          this.model.send({ event: 'video', id: id, index: i, count: count }, {}, [part.buffer]);
        }
      }, fail);
  }

  handleCustomMessage(message: any) {
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
        viewer.renderImage(message).then(
          (image) =>
            this.model.send({ event: 'image', id: message.id, width: image.width, height: image.height }, {}, [
              image.png,
            ]),
          (e) => this.model.send({ event: 'image', id: message.id, error: String(e) }, {})
        );
        return;
      case 'playFilm':
        try {
          viewer.playFilm(message.film, message.options || {});
        } catch (e) {
          viewer.showNotice('Film preview: ' + ((e as Error).message || e));
        }
        return;
      case 'stopFilm':
        return viewer.stopFilm();
      case 'saveVideo':
        this.saveVideo(message);
        return;
      case 'saveAnimation':
        viewer
          .renderAnimation(message, (index, count, image) =>
            this.model.send(
              { event: 'frame', id: message.id, index: index, count: count, width: image.width, height: image.height },
              {},
              [image.png]
            )
          )
          .catch((e) => this.model.send({ event: 'frame', id: message.id, error: String(e) }, {}));
        return;
    }
  }
}
