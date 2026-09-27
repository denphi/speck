// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.

// Framework-independent Speck viewer, shared by the Jupyter widget (ipyspeck)
// and the Streamlit component (stspeck).

const speckRenderer = require('./renderer.js');
const speckSystem = require('./system.js');
const speckView = require('./view.js');
const speckInteractions = require('./interactions.js');
const speckColors = require('./colors.js');
const speckPDB = require('./pdb.js');
const speckCartoon = require('./cartoon.js');
const speckSelect = require('./select.js');
const speckXYZ = require('./xyz.js');
const speckElements = require('./elements.js');

// Model traits mirrored into the Speck view, with their defaults (these match
// the Python traits in ipyspeck/speck.py).
export const VIEW_DEFAULTS: { [key: string]: any } = {
  // atoms and bonds
  bonds: true,
  atomScale: 0.24,
  relativeAtomScale: 0.64,
  bondScale: 0.5,
  bondThreshold: 1.2,
  bondShade: 0.5,
  atomShade: 0.5,
  ligands: true,
  // colors
  colorScheme: 'speck',
  atomColors: {},
  // highlighting
  highlight: {},
  highlightColor: '',
  highlightScale: 1.0,
  ghost: 0.0,
  // lighting and effects
  ao: 0.75,
  aoRes: 256,
  aoSamples: 1024,
  spf: 32,
  brightness: 0.5,
  outline: 0.0,
  outlineWidth: 1.0,
  outlineColor: '#000000',
  shadows: 0.0,
  shadowSoftness: 1.5,
  rim: 0.0,
  fog: 0.0,
  fogColor: '#ffffff',
  saturation: 1.0,
  tonemap: false,
  fxaa: 1,
  dofStrength: 0.0,
  dofPosition: 0.5,
  dofFocus: {},
  // materials
  specular: 0.0,
  gloss: 0.5,
  metallic: 0.0,
  metallicAtoms: 'all',
  // cartoon
  cartoon: false,
  cartoonColor: 'ss',
  cartoonAtoms: 'ligands',
  cartoonHelixWidth: 2.6,
  cartoonSheetWidth: 2.4,
  cartoonThickness: 0.6,
  cartoonTubeRadius: 0.3,
  cartoonQuality: 8,
  cartoonShade: 0.2,
  // surface
  surface: false,
  surfaceColor: 'element',
  surfaceAtoms: 'polymer',
  surfaceProbe: 1.4,
  surfaceResolution: 0.5,
  surfaceShade: 0.1,
  surfaceOpacity: 1.0,
  // unit cell and trajectory
  unitCell: false,
  cellColor: '#666666',
  cellRadius: 0.12,
  frame: 0,
  // interaction
  autoRotate: false,
};
export const VIEW_TRAITS = Object.keys(VIEW_DEFAULTS);

// Changes to these need new geometry; the rest only restart the progressive
// AO accumulation.
const REBUILD_TRAITS = [
  'bonds',
  'bondThreshold',
  'ligands',
  'cartoon',
  'cartoonColor',
  'cartoonAtoms',
  'cartoonHelixWidth',
  'cartoonSheetWidth',
  'cartoonThickness',
  'cartoonTubeRadius',
  'cartoonQuality',
  'surface',
  'surfaceColor',
  'surfaceAtoms',
  'surfaceProbe',
  'surfaceResolution',
  'highlight',
  'highlightColor',
  'highlightScale',
  'ghost',
  'unitCell',
  'cellColor',
  'cellRadius',
];

// Toolbar styles: geometry only, so they combine with any look.
const PRESETS: { [key: string]: { [key: string]: any } } = {
  stickball: { atomScale: 0.24, relativeAtomScale: 0.64, bondScale: 0.5, bonds: true },
  spacefill: { atomScale: 0.6, relativeAtomScale: 1.0, bonds: false },
  licorice: { atomScale: 0.1, relativeAtomScale: 0, bondScale: 1, bonds: true },
};

// Looks: lighting and material presets (the same as apply_preset() in
// Python). Each one starts from 'default', so no setting is left behind.
export const LOOKS: { [key: string]: { [key: string]: any } } = {
  default: {
    ao: 0.75, brightness: 0.5, atomShade: 0.5, bondShade: 0.5, cartoonShade: 0.2, surfaceShade: 0.1,
    outline: 0.0, outlineWidth: 1.0, outlineColor: '#000000', specular: 0.0, gloss: 0.5, metallic: 0.0,
    metallicAtoms: 'all', shadows: 0.0, rim: 0.0, fog: 0.0, saturation: 1.0, tonemap: false, dofStrength: 0.0,
  },
  matte: { ao: 0.9, brightness: 0.55 },
  glossy: { specular: 0.6, gloss: 0.65, rim: 0.2, tonemap: true },
  toon: { ao: 0.3, outline: 1.0, outlineWidth: 1.5, atomShade: 0.3, cartoonShade: 0.1 },
  cover: {
    ao: 1.0, brightness: 0.55, specular: 0.5, gloss: 0.6, shadows: 0.6, rim: 0.35, fog: 0.35, saturation: 1.15,
    tonemap: true, outline: 0.2, atomShade: 0.25, cartoonShade: 0.05,
  },
  metal: { metallic: 1.0, metallicAtoms: 'metals', gloss: 0.75, specular: 0.6, atomShade: 0.1, tonemap: true },
  glass: { surface: true, surfaceOpacity: 0.35, surfaceColor: '#e8e4dc', specular: 0.4, gloss: 0.7, cartoon: true },
};
const LOOK_LABELS: { [key: string]: string } = {
  default: 'Default', matte: 'Matte', glossy: 'Glossy', toon: 'Toon (outlines)', cover: 'Cover (shadows, fog)',
  metal: 'Metal', glass: 'Glass surface',
};

type MenuSection = (title: string, items: [string, string][], current: string, pick: (v: string) => void) => void;

// 16x16 icons; drawn with currentColor so CSS controls the state colors.
const ICONS: { [key: string]: string } = {
  stickball:
    '<circle cx="4" cy="4" r="2"/><circle cx="10" cy="2" r="1"/><circle cx="10" cy="12" r="3"/>' +
    '<path d="M 5 5 l 3 4 M 6 3 l 3 -1"/>',
  spacefill: '<circle cx="4" cy="4" r="2"/><circle cx="10" cy="2" r="1"/><circle cx="10" cy="12" r="3"/>',
  licorice:
    '<circle cx="4" cy="4" r="1"/><circle cx="10" cy="2" r="1"/><circle cx="10" cy="12" r="1"/>' +
    '<path d="M 4 5 l 5 6 M 5 3 l 4 -1"/>',
  toon:
    '<circle cx="4" cy="4" r="2" fill="none"/><circle cx="10" cy="2" r="1" fill="none"/>' +
    '<circle cx="10" cy="12" r="3" fill="none"/><path d="M 5 5 l 3 4 M 6 3 l 3 -1"/>',
  cartoon:
    '<path d="M 1 12 C 3 12 3 4 5.5 4 S 8 12 10.5 12 S 13 6 14 4" fill="none" stroke-width="2.4" stroke-linecap="round"/>',
  surface:
    '<path d="M 4.5 2.5 C 7.5 0 12.5 1.5 13.5 5 C 16 8 13.5 14 9.5 13.5 C 6.5 15.5 1 13.5 1.8 9.5 C 0 6.5 1.8 3.5 4.5 2.5 Z" stroke="none"/>',
  ligands:
    '<path d="M 5.5 2 L 9.5 2 L 11.5 5.5 L 9.5 9 L 5.5 9 L 3.5 5.5 Z" fill="none" stroke-width="1.4"/>' +
    '<path d="M 9.5 9 L 11.5 12.5" fill="none" stroke-width="1.4"/><circle cx="12" cy="13.5" r="1.8" stroke="none"/>',
  // View cube: the same isometric cube with the face you will look at filled.
  front:
    '<path d="M 2 4.8 L 8 8 L 8 14.4 L 2 11.2 Z" stroke="none"/>' +
    '<path d="M 8 1.6 L 14 4.8 L 8 8 L 2 4.8 Z M 2 4.8 L 8 8 L 8 14.4 L 2 11.2 Z M 8 8 L 14 4.8 L 14 11.2 L 8 14.4 Z" fill="none" stroke-width="1.2" stroke-linejoin="round"/>',
  top:
    '<path d="M 8 1.6 L 14 4.8 L 8 8 L 2 4.8 Z" stroke="none"/>' +
    '<path d="M 8 1.6 L 14 4.8 L 8 8 L 2 4.8 Z M 2 4.8 L 8 8 L 8 14.4 L 2 11.2 Z M 8 8 L 14 4.8 L 14 11.2 L 8 14.4 Z" fill="none" stroke-width="1.2" stroke-linejoin="round"/>',
  right:
    '<path d="M 8 8 L 14 4.8 L 14 11.2 L 8 14.4 Z" stroke="none"/>' +
    '<path d="M 8 1.6 L 14 4.8 L 8 8 L 2 4.8 Z M 2 4.8 L 8 8 L 8 14.4 L 2 11.2 Z M 8 8 L 14 4.8 L 14 11.2 L 8 14.4 Z" fill="none" stroke-width="1.2" stroke-linejoin="round"/>',
  center:
    '<path d="M 1 5 v -4 h 4 M 15 5 v -4 h -4 M 1 11 v 4 h 4 M 11 15 h 4 v -4 M 5 8 l 3 -3 l 3 3 l -3 3 l -3 -3" fill="none"/>',
  // Sparkle: looks (lighting and material presets)
  looks:
    '<path stroke="none" d="M 6.5 1 L 7.9 5.1 L 12 6.5 L 7.9 7.9 L 6.5 12 L 5.1 7.9 L 1 6.5 L 5.1 5.1 Z"/>' +
    '<path stroke="none" d="M 12.5 9.5 L 13.2 11.3 L 15 12 L 13.2 12.7 L 12.5 14.5 L 11.8 12.7 L 10 12 L 11.8 11.3 Z"/>',
  // Circular arrow around a dot: auto-rotate
  spin:
    '<path d="M 13.2 5.2 A 6 6 0 1 0 14 9" fill="none" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path stroke="none" d="M 15.2 1.8 L 14.8 7 L 10.2 4.6 Z"/>' +
    '<circle cx="8" cy="8" r="1.6" stroke="none"/>',
  // Lens aperture: depth of field on / off
  dof:
    '<circle cx="8" cy="8" r="6.6" fill="none" stroke-width="1.3"/>' +
    '<path d="M 8 1.4 L 11.3 7 M 13.7 4.7 L 9.9 10.4 M 13.7 11.3 L 6.6 11 M 8 14.6 L 4.7 9 M 2.3 11.3 L 6.1 5.6 M 2.3 4.7 L 9.4 5" fill="none" stroke-width="1.2"/>',
  // Crosshair target (distinct from the corner brackets of "center").
  focus:
    '<circle cx="8" cy="8" r="4.6" fill="none" stroke-width="1.4"/>' +
    '<path d="M 8 0.8 V 3.4 M 8 12.6 V 15.2 M 0.8 8 H 3.4 M 12.6 8 H 15.2" fill="none" stroke-width="1.4"/>' +
    '<circle cx="8" cy="8" r="1.3" stroke="none"/>',
  palette:
    '<path stroke="none" d="M 8 0 C 3.6 0 0 3.6 0 8 C 0 12.4 3.6 16 8 16 C 8.7 16 9.3 15.4 9.3 14.6 C 9.3 14.3 9.2 14 9 13.7 ' +
    'C 8.7 13.5 8.6 13.2 8.6 12.9 C 8.6 12.1 9.2 11.5 10 11.5 L 11.6 11.5 C 14 11.5 16 9.5 16 7.1 C 16 3.2 12.4 0 8 0 Z ' +
    'M 3.1 8 C 2.4 8 1.8 7.4 1.8 6.7 C 1.8 5.9 2.4 5.3 3.1 5.3 C 3.9 5.3 4.4 5.9 4.4 6.7 C 4.4 7.4 3.9 8 3.1 8 Z ' +
    'M 5.8 4.5 C 5 4.5 4.4 3.9 4.4 3.1 C 4.4 2.4 5 1.8 5.8 1.8 C 6.5 1.8 7.1 2.4 7.1 3.1 C 7.1 3.9 6.5 4.5 5.8 4.5 Z ' +
    'M 10.2 4.5 C 9.4 4.5 8.9 3.9 8.9 3.1 C 8.9 2.4 9.4 1.8 10.2 1.8 C 10.9 1.8 11.5 2.4 11.5 3.1 C 11.5 3.9 10.9 4.5 10.2 4.5 Z ' +
    'M 12.9 8 C 12.1 8 11.5 7.4 11.5 6.7 C 11.5 5.9 12.1 5.3 12.9 5.3 C 13.6 5.3 14.2 5.9 14.2 6.7 C 14.2 7.4 13.6 8 12.9 8 Z"/>',
  camera:
    '<path stroke="none" d="M 14.7 4 L 12.5 4 C 12.3 4 12.1 3.9 12 3.8 C 10.8 2.5 10.4 2 9.9 2 L 6.3 2 C 5.8 2 5.4 2.5 4.2 3.8 ' +
    'C 4 3.9 3.8 4 3.7 4 L 1.4 4 C 0.7 4 0 4.5 0 5.3 L 0 12.6 C 0 13.3 0.7 14 1.4 14 L 14.7 14 C 15.5 14 16 13.3 16 12.6 ' +
    'L 16 5.3 C 16 4.5 15.5 4 14.7 4 Z M 8 12.3 C 6.1 12.3 4.5 10.7 4.5 8.8 C 4.5 6.8 6.1 5.2 8 5.2 C 9.9 5.2 11.6 6.8 ' +
    '11.6 8.8 C 11.6 10.7 9.9 12.3 8 12.3 Z M 8 6.4 C 6.7 6.4 5.7 7.5 5.7 8.8 C 5.7 10.1 6.7 11.2 8 11.2 C 9.4 11.2 10.4 10.1 ' +
    '10.4 8.8 C 10.4 7.5 9.4 6.4 8 6.4 Z"/>',
};

// Everything the viewer needs from its host (the Jupyter widget model, a
// Streamlit component, a plain page...).
export interface ViewerHost {
  // Current value of a setting.
  get(trait: string): any;
  // The user changed settings from the viewer's own UI (toolbar buttons). The
  // host stores them and calls viewer.setTrait for each.
  set(changes: { [trait: string]: any }): void;
  // The camera settled after an interaction or a view change.
  cameraChanged?(camera: any): void;
  // The number of frames in the loaded data.
  framesChanged?(nframes: number): void;
  // Replaces the camera button's default (download the on-screen image).
  snapshot?(): void;
}

export interface RenderedImage {
  png: ArrayBuffer;
  width: number;
  height: number;
}

// Interactive Speck viewer inside a DOM element. It sizes itself with a
// ResizeObserver, so it does not depend on any framework's lifecycle.
export class SpeckViewer {
  readonly el: HTMLElement;
  private host: ViewerHost;
  private system: any = null;
  private view: any;
  private renderer: any = null;
  private needReset = false;
  private focusMode = false;
  private focusButton: HTMLElement | null = null;
  private colorButton: HTMLElement | null = null;
  private lookButton: HTMLElement | null = null;
  private menuEl!: HTMLDivElement;
  private menuOwner: HTMLElement | null = null;
  private menuBuild: ((section: MenuSection) => void) | null = null;
  private lastFrameTime = 0;
  private spinSamples = 32;
  private lastDofStrength = 1.0;
  private spinFrames = 0;
  private spinTime = 0;
  private pressAt: { x: number; y: number } | null = null;
  private canvas: HTMLCanvasElement;
  private toolbarEl!: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private toggles: { [trait: string]: HTMLElement } = {};
  private resizeObserver: any = null;
  private removeInteractions: (() => void) | null = null;
  private frame = 0;
  private snapshotRequested = false;
  private cameraTimer: any = null;
  private exportQueue: Promise<void> = Promise.resolve();
  private reflowHandler = () => this.reflow();

  constructor(el: HTMLElement, host: ViewerHost) {
    this.el = el;
    this.host = host;
    this.view = speckView.new();
    for (const trait of VIEW_TRAITS) {
      this.view[trait] = host.get(trait);
    }
    this.applyElementColors();

    el.classList.add('ipyspeck-widget');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ipyspeck-canvas';
    this.canvas.addEventListener('dblclick', () => this.center());
    // Tap to focus: in focus mode, or with Alt/Option held. A drag rotates.
    this.canvas.addEventListener('pointerdown', (e) => {
      this.pressAt = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('click', (e) => {
      const press = this.pressAt;
      this.pressAt = null;
      if (!(this.focusMode || e.altKey)) return;
      if (press && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 4) return;
      const box = this.canvas.getBoundingClientRect();
      this.focusAt((e.clientX - box.left) / box.width, 1 - (e.clientY - box.top) / box.height);
    });
    // Keyboard: arrows rotate (Shift pans), + / - zoom, 0 recenters, F focuses at the center.
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Molecule viewer. Arrow keys rotate, Shift+arrows pan, + and - zoom, 0 recenters.');
    this.canvas.addEventListener('keydown', (e) => this.onKey(e));
    el.appendChild(this.canvas);
    this.buildToolbar();

    this.removeInteractions = speckInteractions({
      container: this.canvas,
      scrollZoom: true,
      getRotation: () => this.view.rotation,
      setRotation: (t: any) => {
        this.view.rotation = t;
      },
      getTranslation: () => this.view.translation,
      setTranslation: (t: any) => {
        this.view.translation = t;
      },
      getZoom: () => this.view.zoom,
      setZoom: (t: any) => this.zoomTo(t),
      refreshView: () => {
        this.needReset = true;
        this.scheduleCameraSync();
      },
    });

    const ResizeObserverImpl = (window as any).ResizeObserver;
    if (ResizeObserverImpl) {
      this.resizeObserver = new ResizeObserverImpl(() => this.reflow());
      this.resizeObserver.observe(el);
    } else {
      window.addEventListener('resize', this.reflowHandler);
    }
    // Also covers the case where the element already has its size.
    requestAnimationFrame(() => this.reflow());
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    clearTimeout(this.cameraTimer);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    window.removeEventListener('resize', this.reflowHandler);
    document.removeEventListener('pointerdown', this.closeMenuHandler);
    if (this.removeInteractions) {
      this.removeInteractions();
    }
    // Browsers only allow a few live WebGL contexts; release ours.
    const gl = this.canvas.getContext('webgl') as any;
    const lose = gl ? gl.getExtension('WEBGL_lose_context') : null;
    if (lose) {
      lose.loseContext();
    }
    this.renderer = null;
  }

  // --- toolbar -------------------------------------------------------------

  private buildToolbar() {
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'ipyspeck-toolbar';
    this.toolbarEl.setAttribute('role', 'toolbar');
    this.toolbarEl.setAttribute('aria-label', 'Molecule viewer');
    // Keep toolbar clicks from rotating or zooming the molecule.
    this.toolbarEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.toolbarEl.addEventListener('dblclick', (e) => e.stopPropagation());

    const styles = this.addGroup();
    this.addButton(styles, 'stickball', 'Ball and stick', () => this.host.set(PRESETS.stickball));
    this.addButton(styles, 'spacefill', 'Space filling', () => this.host.set(PRESETS.spacefill));
    this.addButton(styles, 'licorice', 'Licorice', () => this.host.set(PRESETS.licorice));
    this.lookButton = this.addButton(styles, 'looks', 'Looks', () => this.toggleLookMenu());
    this.lookButton.setAttribute('aria-haspopup', 'menu');
    this.lookButton.setAttribute('aria-expanded', 'false');

    const representations = this.addGroup();
    this.toggles.cartoon = this.addButton(representations, 'cartoon', 'Cartoon', () => this.toggle('cartoon'));
    this.toggles.surface = this.addButton(representations, 'surface', 'Molecular surface', () => this.toggle('surface'));
    this.toggles.ligands = this.addButton(representations, 'ligands', 'Ligands', () => this.toggle('ligands'));

    const views = this.addGroup();
    this.addButton(views, 'front', 'Front view', () => this.frontview());
    this.addButton(views, 'top', 'Top view', () => this.topview());
    this.addButton(views, 'right', 'Right view', () => this.rightview());
    this.addButton(views, 'center', 'Recenter (double-click)', () => this.center());
    this.toggles.autoRotate = this.addButton(views, 'spin', 'Auto-rotate', () => this.toggle('autoRotate'));

    const output = this.addGroup();
    this.focusButton = this.addButton(output, 'focus', 'Tap to focus (or Alt-click)', () => this.toggleFocusMode());
    this.toggles.dofStrength = this.addButton(output, 'dof', 'Depth of field (macro)', () => this.toggleDepthOfField());
    this.colorButton = this.addButton(output, 'palette', 'Colors', () => this.toggleColorMenu());
    this.colorButton.setAttribute('aria-haspopup', 'menu');
    this.colorButton.setAttribute('aria-expanded', 'false');
    this.addButton(output, 'camera', 'Save PNG', () => (this.host.snapshot ? this.host.snapshot() : this.snapshot()));

    this.el.appendChild(this.toolbarEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'ipyspeck-status';
    this.el.appendChild(this.statusEl);

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'ipyspeck-menu';
    this.menuEl.setAttribute('role', 'menu');
    this.menuEl.style.display = 'none';
    this.menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.menuEl.addEventListener('dblclick', (e) => e.stopPropagation());
    this.menuEl.addEventListener('keydown', (e) => this.onMenuKey(e));
    this.el.appendChild(this.menuEl);
    document.addEventListener('pointerdown', this.closeMenuHandler);
    this.updateToolbar();
  }

  setStatus(text: string) {
    this.statusEl.textContent = text;
    this.statusEl.style.display = text ? '' : 'none';
  }

  private addGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'ipyspeck-toolbar-group';
    this.toolbarEl.appendChild(group);
    return group;
  }

  private addButton(group: HTMLElement, icon: string, title: string, onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ipyspeck-button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" aria-hidden="true" focusable="false">' +
      ICONS[icon] +
      '</svg>';
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    group.appendChild(button);
    return button;
  }

  updateToolbar() {
    this.toolbarEl.style.display = this.host.get('toolbar') === false ? 'none' : '';
    for (const trait in this.toggles) {
      const on = !!this.host.get(trait);
      this.toggles[trait].classList.toggle('active', on);
      this.toggles[trait].setAttribute('aria-pressed', String(on));
    }
    if (this.focusButton) {
      this.focusButton.setAttribute('aria-pressed', String(this.focusMode));
    }
  }

  private toggle(trait: string) {
    this.host.set({ [trait]: !this.host.get(trait) });
  }

  // --- settings ---------------------------------------------------------------

  // Applies a changed setting (the host has already stored the new value).
  setTrait(trait: string, value: any) {
    this.view[trait] = value;
    speckView.resolve(this.view);
    if (trait === 'frame' && this.system) {
      speckSystem.setFrame(this.system, this.view.frame);
      this.rebuild();
    }
    if (trait === 'autoRotate' && !value) {
      this.scheduleCameraSync();
    }
    if (trait === 'colorScheme' || trait === 'atomColors') {
      this.applyElementColors();
      this.rebuild();
    }
    if (trait === 'aoRes' && this.renderer) {
      this.renderer.setResolution(this.view.resolution, this.view.aoRes);
    }
    if (REBUILD_TRAITS.indexOf(trait) >= 0) {
      this.rebuild();
    }
    if (trait in this.toggles) {
      this.updateToolbar();
    }
    this.needReset = true;
  }

  // --- structure ------------------------------------------------------------

  loadStructure() {
    if (!this.renderer) {
      return;
    }
    const text = this.host.get('data') || '';
    const isPDB = speckPDB.isPDB(text);
    const parsed = isPDB ? speckPDB.parse(text) : speckXYZ.parse(text);
    if (parsed.atoms.length === 0) {
      return;
    }
    this.system = speckSystem.new();
    for (const a of parsed.atoms) {
      speckSystem.addAtom(this.system, a.symbol, a.x, a.y, a.z, isPDB ? a : undefined);
    }
    this.system.helices = parsed.helices || [];
    this.system.sheets = parsed.sheets || [];
    this.system.frames = parsed.frames;
    this.system.cell = parsed.cell;
    speckSystem.center(this.system);
    if (this.view.frame > 0) {
      speckSystem.setFrame(this.system, this.view.frame);
    }
    if (this.host.framesChanged) {
      this.host.framesChanged(parsed.frames.length);
    }
    const camera = this.host.get('camera');
    if (camera && camera.rotation) {
      this.rebuild();
      this.setCamera(camera);
    } else {
      this.center();
    }
  }

  rebuild() {
    if (this.system && this.renderer) {
      speckCartoon.applyVisibility(this.system, this.view);
      speckSelect.apply(this.system, this.view);
      speckSystem.calculateBonds(this.system, this.view);
      this.renderer.setSystem(this.system, this.view);
      this.needReset = true;
    }
  }

  center() {
    if (this.system && this.renderer) {
      speckSystem.center(this.system);
      this.rebuild();
      speckView.center(this.view, this.system);
      this.needReset = true;
      this.scheduleCameraSync();
    }
  }

  // --- camera ---------------------------------------------------------------

  cameraState() {
    return {
      rotation: Array.from(this.view.rotation as Float32Array).map((v: number) => Math.round(v * 1e6) / 1e6),
      translation: [this.view.translation.x, this.view.translation.y],
      zoom: this.view.zoom,
    };
  }

  // Report the camera once interaction settles (not on every frame).
  private scheduleCameraSync() {
    clearTimeout(this.cameraTimer);
    this.cameraTimer = setTimeout(() => {
      if (this.host.cameraChanged) {
        this.host.cameraChanged(this.cameraState());
      }
    }, 300);
  }

  setCamera(camera: any) {
    if (!camera || !camera.rotation || camera.rotation.length !== 16) {
      return;
    }
    this.view.rotation = new Float32Array(camera.rotation);
    if (camera.translation) {
      this.view.translation = { x: camera.translation[0], y: camera.translation[1] };
    }
    if (camera.zoom) {
      this.view.zoom = camera.zoom;
    }
    speckView.resolve(this.view);
    this.needReset = true;
  }

  // The canvas shows the bottom-left part of a square frame of side
  // max(width, height); zoom about the visible center so wide or tall
  // viewers do not drift while zooming.
  private zoomTo(zoom: number) {
    const res = this.view.resolution;
    const side = Math.max(res.x, res.y);
    const before = 1 / this.view.zoom;
    this.view.zoom = zoom;
    speckView.resolve(this.view);
    const grow = 1 / this.view.zoom - before;
    this.view.translation = {
      x: this.view.translation.x + (grow / 2) * (1 - res.x / side),
      y: this.view.translation.y + (grow / 2) * (1 - res.y / side),
    };
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

  // --- focus ----------------------------------------------------------------

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    this.canvas.classList.toggle('focusing', this.focusMode);
    if (this.focusButton) {
      this.focusButton.classList.toggle('active', this.focusMode);
      this.focusButton.setAttribute('aria-pressed', String(this.focusMode));
    }
  }

  // Depth of field off, or back on at the last strength used (1.0 at first).
  toggleDepthOfField() {
    const strength = this.host.get('dofStrength');
    if (strength > 0) {
      this.lastDofStrength = strength;
      this.host.set({ dofStrength: 0 });
    } else {
      this.host.set({ dofStrength: this.lastDofStrength });
    }
  }

  // --- keyboard -------------------------------------------------------------

  private onKey(e: KeyboardEvent) {
    const step = 30; // pixels of an equivalent drag
    const arrows: { [key: string]: [number, number] } = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (e.key in arrows) {
      const [dx, dy] = arrows[e.key];
      if (e.shiftKey) {
        const inverseZoom = 0.001 / this.view.zoom;
        const t = this.view.translation;
        this.view.translation = { x: t.x - dx * inverseZoom, y: t.y + dy * inverseZoom };
      } else {
        speckView.rotate(this.view, dx, dy);
      }
    } else if (e.key === '+' || e.key === '=') {
      this.zoomTo(this.view.zoom / 0.9);
    } else if (e.key === '-' || e.key === '_') {
      this.zoomTo(this.view.zoom * 0.9);
    } else if (e.key === '0') {
      this.center();
      e.preventDefault();
      return;
    } else if (e.key === 'f' || e.key === 'F') {
      if (!this.focusAt(0.5, 0.5)) {
        this.setStatus('Nothing at the center to focus on');
        setTimeout(() => this.setStatus(''), 1500);
      }
      e.preventDefault();
      return;
    } else {
      return;
    }
    e.preventDefault();
    speckView.resolve(this.view);
    this.needReset = true;
    this.scheduleCameraSync();
  }

  // Focuses at a point of the canvas (fx, fy in [0, 1] from the bottom-left):
  // the depth under it becomes the focal plane. Returns false over the
  // background. Turns depth of field on if it was off.
  focusAt(fx: number, fy: number): boolean {
    if (!this.renderer || !this.system) return false;
    const depth = this.renderer.pickDepth(this.view, fx, fy);
    if (depth === null) return false;
    const changes: { [trait: string]: any } = { dofPosition: Math.round(depth * 1e4) / 1e4, dofFocus: {} };
    if (!(this.view.dofStrength > 0)) changes.dofStrength = this.lastDofStrength;
    this.host.set(changes);
    this.showReticle(fx, fy);
    return true;
  }

  private showReticle(fx: number, fy: number) {
    const r = document.createElement('div');
    r.className = 'ipyspeck-reticle';
    r.style.left = fx * this.canvas.clientWidth + 'px';
    r.style.top = (1 - fy) * this.canvas.clientHeight + 'px';
    this.el.appendChild(r);
    setTimeout(() => r.remove(), 900);
  }

  // --- menus ----------------------------------------------------------------

  private closeMenuHandler = (e: Event) => {
    if (this.menuOwner && !this.menuEl.contains(e.target as Node) && !this.menuOwner.contains(e.target as Node)) {
      this.closeMenu(false);
    }
  };

  private closeMenu(refocus: boolean) {
    const owner = this.menuOwner;
    this.menuEl.style.display = 'none';
    this.menuOwner = null;
    this.menuBuild = null;
    if (owner) {
      owner.setAttribute('aria-expanded', 'false');
      if (refocus) owner.focus();
    }
  }

  // Opens (or closes, if already open) a popup menu below a toolbar button.
  private toggleMenu(owner: HTMLElement | null, label: string, build: (section: MenuSection) => void) {
    const wasOpen = this.menuOwner === owner;
    if (this.menuOwner) this.closeMenu(false);
    if (wasOpen || !owner) return;
    this.menuOwner = owner;
    this.menuBuild = build;
    this.menuEl.setAttribute('aria-label', label);
    this.renderMenu();
    this.menuEl.style.display = '';
    owner.setAttribute('aria-expanded', 'true');
    // Below the button, right-aligned with it, kept inside the viewer.
    const box = this.el.getBoundingClientRect();
    const b = owner.getBoundingClientRect();
    const width = this.menuEl.offsetWidth;
    const left = Math.max(6, Math.min(b.right - box.left - width, box.width - width - 6));
    this.menuEl.style.left = left + 'px';
    this.menuEl.style.right = 'auto';
    this.menuEl.style.top = b.bottom - box.top + 4 + 'px';
    const first = (this.menuEl.querySelector('.active') || this.menuEl.querySelector('button')) as HTMLElement | null;
    if (first) first.focus();
  }

  private renderMenu() {
    const menu = this.menuEl;
    const build = this.menuBuild;
    if (!build) return;
    menu.innerHTML = '';
    build((title, items, current, pick) => {
      if (title) {
        const h = document.createElement('div');
        h.className = 'ipyspeck-menu-title';
        h.setAttribute('role', 'presentation');
        h.textContent = title;
        menu.appendChild(h);
      }
      for (const [value, label] of items) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ipyspeck-menu-item' + (value === current ? ' active' : '');
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(value === current));
        item.setAttribute('aria-label', title ? title + ': ' + label : label);
        item.dataset.value = title + ':' + value;
        item.textContent = label;
        item.addEventListener('click', () => {
          pick(value);
          this.renderMenu();
          const again = this.menuEl.querySelector('[data-value="' + title + ':' + value + '"]') as HTMLElement | null;
          if (again) again.focus();
        });
        menu.appendChild(item);
      }
    });
  }

  // Up / Down / Home / End move between items, Escape closes.
  private onMenuKey(e: KeyboardEvent) {
    const items = Array.from(this.menuEl.querySelectorAll('button')) as HTMLElement[];
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (at + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      this.closeMenu(e.key === 'Escape');
      return;
    } else return;
    e.preventDefault();
    if (items[next]) items[next].focus();
  }

  // --- looks ----------------------------------------------------------------

  // A look's settings; from the toolbar, depth of field (a camera choice,
  // e.g. just set by tap to focus) is kept.
  private lookSettings(name: string): { [key: string]: any } {
    const look: { [key: string]: any } = { ...LOOKS.default, ...LOOKS[name] };
    delete look.dofStrength;
    return look;
  }

  // The look whose settings all match the current ones, or ''.
  currentLook(): string {
    for (const name in LOOKS) {
      const look = this.lookSettings(name);
      if (Object.keys(look).every((k) => this.host.get(k) === look[k])) return name;
    }
    return '';
  }

  applyLook(name: string) {
    if (name in LOOKS) this.host.set(this.lookSettings(name));
  }

  toggleLookMenu() {
    this.toggleMenu(this.lookButton, 'Looks', (section) =>
      section('', Object.keys(LOOKS).map((k) => [k, LOOK_LABELS[k]] as [string, string]), this.currentLook(),
        (v) => this.applyLook(v)));
  }

  // --- colors ---------------------------------------------------------------

  // Color schemes for what is shown: cartoon and surface schemes (synced as
  // cartoonColor / surfaceColor) and the element palettes for atoms.
  toggleColorMenu() {
    this.toggleMenu(this.colorButton, 'Colors', (section) => {
      const residue: [string, string][] = [
        ['ss', 'Secondary structure'], ['chain', 'Chain'], ['rainbow', 'Rainbow N→C'], ['plddt', 'AlphaFold confidence'],
      ];
      if (this.host.get('cartoon')) {
        section('Cartoon', residue, this.host.get('cartoonColor'), (v) => this.host.set({ cartoonColor: v }));
      }
      if (this.host.get('surface')) {
        section('Surface', [['element', 'Element'], ...residue, ['#eef2f8', 'Glass white']],
          this.host.get('surfaceColor'), (v) => this.host.set({ surfaceColor: v }));
      }
      const palettes: { [name: string]: string } = { speck: 'Speck', jmol: 'Jmol', rasmol: 'RasMol', newcpk: 'New CPK' };
      section('Atoms', Object.keys(speckColors).map((k) => [k, palettes[k] || k] as [string, string]),
        this.host.get('colorScheme'), (v) => this.setColorSchema(v));
    });
  }

  // Element colors = the colorScheme palette, then the atomColors overrides
  // ('#rrggbb' or [r, g, b] in 0 - 1).
  private applyElementColors() {
    const palette = speckColors[this.view.colorScheme] || speckColors.speck;
    const custom = this.view.atomColors || {};
    for (const symbol in this.view.elements) {
      const base = palette[symbol] || speckElements[symbol].color;
      this.view.elements[symbol].color = speckSelect.parseColor(custom[symbol], base).slice();
    }
  }

  // Adds per-element colors to atomColors (synced with the host).
  setAtomsColor(atoms: any) {
    this.host.set({ atomColors: { ...(this.host.get('atomColors') || {}), ...atoms } });
  }

  // Switches palette and clears the atomColors overrides.
  setColorSchema(schema: string) {
    if (schema in speckColors) {
      this.host.set({ colorScheme: schema, atomColors: {} });
    }
  }

  switchColorSchema() {
    const schemas = Object.keys(speckColors);
    const next = schemas[(schemas.indexOf(this.host.get('colorScheme')) + 1) % schemas.length];
    this.setColorSchema(next);
  }

  // Downloads the on-screen image.
  snapshot() {
    // Read the canvas right after a frame is drawn (the drawing buffer is not
    // preserved between frames).
    this.snapshotRequested = true;
  }

  // --- export --------------------------------------------------------------

  get ready(): boolean {
    return this.system !== null && this.renderer !== null;
  }

  // Renders the current scene offscreen, waits until ambient occlusion has
  // converged and returns the PNG bytes. Options: width / height (px, the
  // other side keeps the on-screen aspect) or scale, supersample, aoRes,
  // samples, transparent, background. `prepare` can adjust the cloned view.
  renderImage(options: any, prepare?: (view: any) => void): Promise<RenderedImage> {
    return this.queueExport(() => {
      this.setStatus('Rendering image…');
      return this.renderOffscreen(options, prepare);
    });
  }

  // Turntable (a full turn about the vertical axis in options.frames steps) or
  // trajectory (options.mode === 'trajectory') animation; onFrame receives
  // each PNG as it is rendered.
  renderAnimation(options: any, onFrame: (index: number, count: number, image: RenderedImage) => void): Promise<void> {
    return this.queueExport(async () => {
      const trajectory = options.mode === 'trajectory';
      const nframes = this.system.frames ? this.system.frames.length : 1;
      const count = trajectory ? nframes : Math.max(1, options.frames || 60);
      const startFrame = this.view.frame;
      const frameOptions = { samples: 256, supersample: 1, scale: 1, ...options };
      try {
        for (let k = 0; k < count; k++) {
          this.setStatus('Rendering frame ' + (k + 1) + ' / ' + count + '…');
          if (trajectory) {
            speckSystem.setFrame(this.system, k);
            speckCartoon.applyVisibility(this.system, this.view);
            speckSelect.apply(this.system, this.view);
            speckSystem.calculateBonds(this.system, this.view);
          }
          const angle = (2 * Math.PI * k) / count;
          const image = await this.renderOffscreen(frameOptions, (view: any) => {
            if (!trajectory) {
              speckView.turn(view, angle);
            }
          });
          onFrame(k, count, image);
        }
      } finally {
        if (trajectory) {
          speckSystem.setFrame(this.system, startFrame);
          this.rebuild();
        }
      }
    });
  }

  // One export at a time; the status label shows progress.
  private queueExport<T>(job: () => Promise<T>): Promise<T> {
    const run = this.exportQueue.then(async () => {
      if (!this.ready) {
        throw new Error('nothing to render yet');
      }
      try {
        return await job();
      } finally {
        this.setStatus('');
      }
    });
    this.exportQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async renderOffscreen(options: any, prepare?: (view: any) => void): Promise<RenderedImage> {
    const cssWidth = this.el.clientWidth || this.view.resolution.x;
    const cssHeight = this.el.clientHeight || this.view.resolution.y;
    const scale = options.scale || 2;
    let width = Math.round(options.width || (options.height ? (cssWidth * options.height) / cssHeight : cssWidth * scale));
    let height = Math.round(options.height || (options.width ? (cssHeight * options.width) / cssWidth : cssHeight * scale));

    const canvas = document.createElement('canvas');
    const probe = canvas.getContext('webgl') as WebGLRenderingContext;
    // The renderer keeps about 20 square textures of the largest side, so the
    // largest side (after supersampling) is capped well below GPU limits.
    const maxSide = Math.min(4096, probe.getParameter(probe.MAX_TEXTURE_SIZE), probe.getParameter(probe.MAX_VIEWPORT_DIMS)[0]);
    if (Math.max(width, height) > maxSide) {
      const f = maxSide / Math.max(width, height);
      width = Math.floor(width * f);
      height = Math.floor(height * f);
    }
    let supersample = Math.max(1, Math.round(options.supersample === undefined ? 2 : options.supersample));
    while (supersample > 1 && Math.max(width, height) * supersample > maxSide) {
      supersample--;
    }

    const view = speckView.clone(this.view);
    view.resolution = { x: width * supersample, y: height * supersample };
    view.aoRes = options.aoRes || Math.max(1024, this.view.aoRes);
    view.aoSamples = options.samples || 1024;
    view.spf = Math.max(this.view.spf, 64);
    // Same framing as on screen when the aspect ratio matches; otherwise fit.
    if (Math.abs(width / height - cssWidth / cssHeight) > 0.01) {
      speckView.center(view, this.system);
    }
    if (prepare) {
      prepare(view);
    }

    const renderer = new speckRenderer(canvas, view.resolution, view.aoRes);
    const out = document.createElement('canvas');
    try {
      renderer.setSystem(this.system, view);
      renderer.reset();
      // Each frame adds AO samples; yield between frames to keep the page alive.
      for (let i = 0; i < 400; i++) {
        renderer.render(view);
        if (view.spf <= 0 || view.ao <= 0 ? i >= 4 : renderer.getAOProgress() >= 1) {
          break;
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      // Draw once more and copy right away (the WebGL buffer is not preserved).
      renderer.render(view);
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d') as CanvasRenderingContext2D;
      if (!options.transparent) {
        ctx.fillStyle = options.background || '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, width, height);
    } finally {
      const lose = probe.getExtension('WEBGL_lose_context');
      if (lose) {
        lose.loseContext();
      }
    }
    const blob: Blob = await new Promise((resolve) => out.toBlob((b) => resolve(b as Blob), 'image/png'));
    return { png: await blob.arrayBuffer(), width: width, height: height };
  }

  // --- rendering -------------------------------------------------------------

  private reflow() {
    const width = this.el.clientWidth;
    const height = this.el.clientHeight;
    if (width === 0 || height === 0) {
      // Not attached or hidden yet.
      return;
    }
    // Render at the display's pixel density (capped) for sharp images.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const x = Math.round(width * dpr);
    const y = Math.round(height * dpr);
    if (this.renderer && this.view.resolution.x === x && this.view.resolution.y === y) {
      return;
    }
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.view.resolution = { x: x, y: y };
    if (this.renderer === null) {
      this.renderer = new speckRenderer(this.canvas, this.view.resolution, this.view.aoRes);
      this.loadStructure();
      this.frame = requestAnimationFrame(() => this.loop());
    } else {
      this.renderer.setResolution(this.view.resolution, this.view.aoRes);
      if (this.system) {
        speckView.center(this.view, this.system);
      }
      this.rebuild();
    }
    this.needReset = true;
  }

  private loop() {
    if (!this.renderer) {
      return;
    }
    const now = performance.now();
    const dt = this.lastFrameTime ? now - this.lastFrameTime : 16;
    this.lastFrameTime = now;
    if (this.view.autoRotate && this.system) {
      // 20 degrees per second, independent of the frame rate. Each frame is
      // fully shaded with AO samples; their number is re-chosen from the mean
      // frame time every 30 frames (8 - 96, aiming at ~50 fps) and otherwise
      // kept steady, since a change shows as a small step in brightness.
      speckView.turn(this.view, (Math.min(dt, 100) / 1000) * (Math.PI / 9));
      speckView.resolve(this.view);
      this.spinFrames++;
      this.spinTime += dt;
      if (this.spinFrames === 30) {
        const mean = this.spinTime / 30;
        if (mean > 24) this.spinSamples = Math.max(8, Math.round(this.spinSamples * 0.7));
        else if (mean < 17.5) this.spinSamples = Math.min(96, this.spinSamples + 8);
        this.spinFrames = 0;
        this.spinTime = 0;
      }
      this.renderer.renderMoving(this.view, this.spinSamples);
      this.needReset = true; // progressive refinement resumes when the spin stops
    } else {
      if (this.needReset) {
        this.renderer.reset();
        this.needReset = false;
      }
      this.renderer.render(this.view);
    }
    if (this.snapshotRequested) {
      this.snapshotRequested = false;
      const link = document.createElement('a');
      link.href = this.canvas.toDataURL('image/png');
      link.download = 'speck.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    this.frame = requestAnimationFrame(() => this.loop());
  }
}
