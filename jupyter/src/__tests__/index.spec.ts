// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.

import { createTestModel } from './utils';

import { SpeckModel } from '..';
import { VIEW_DEFAULTS, VIEW_TRAITS } from '../../../core/lib/viewer';

describe('SpeckModel', () => {
  it('is createable with the viewer defaults', () => {
    const model = createTestModel(SpeckModel);
    expect(model).toBeInstanceOf(SpeckModel);
    for (const trait of VIEW_TRAITS) {
      expect(model.get(trait)).toEqual(VIEW_DEFAULTS[trait]);
    }
    expect(model.get('data')).toEqual('');
    expect(model.get('toolbar')).toBe(true);
    expect(model.get('nframes')).toBe(1);
  });

  it('keeps state passed at creation', () => {
    const model = createTestModel(SpeckModel, { cartoon: true, surfaceOpacity: 0.35, highlight: { resName: 'HEM' } });
    expect(model.get('cartoon')).toBe(true);
    expect(model.get('surfaceOpacity')).toBe(0.35);
    expect(model.get('highlight')).toEqual({ resName: 'HEM' });
    expect(model.get('surface')).toBe(false);
  });

  it('mirrors every viewer setting as a model attribute', () => {
    const defaults = SpeckModel.prototype.defaults() as { [key: string]: any };
    for (const trait of VIEW_TRAITS) {
      expect(trait in defaults).toBe(true);
    }
  });
});
