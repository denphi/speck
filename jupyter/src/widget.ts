// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.

import {
  DOMWidgetModel,
  DOMWidgetView,
  ISerializers,
} from '@jupyter-widgets/base';

import { MODULE_NAME, MODULE_VERSION } from './version';
// The viewer and renderer are shared with stspeck (see ../../core).
import { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS } from '../../core/lib/viewer';
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

  render() {
    this.viewer = new SpeckViewer(this.el, {
      get: (trait) => this.model.get(trait),
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

    this.model.on('change:data', () => this.viewer.loadStructure(), this);
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
