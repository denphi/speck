// Copyright (c) Daniel Mejia (Denphi)
// Distributed under the terms of the Modified BSD License.

// Films: previews in the viewer (with a player bar) and video export. A
// film is a list of shots (see film.js); exports render every frame fully
// shaded with ambient occlusion fixed to the molecule, so nothing flickers,
// and encode H.264 MP4 in the browser (video.js) or hand out the frames.

import { LoadPanel } from './progress';

const speckFilm = require('./film.js');
const speckVideo = require('./video.js');
const speckView = require('./view.js');
const speckSystem = require('./system.js');
const speckCartoon = require('./cartoon.js');
const speckSelect = require('./select.js');
const speckRecipes = require('./recipes.js');

// Ready-made videos (see recipes.js): [{name, label, seconds, needs, description}].
export const VIDEO_RECIPES: { name: string; label: string; seconds: number; needs: string | null; description: string }[] =
  speckRecipes.RECIPES;

// Output sizes by name ([width, height]).
export const VIDEO_SIZES: { [name: string]: [number, number] } = {
  '480p': [854, 480],
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
  '4k': [3840, 2160],
  square: [1080, 1080],
  vertical: [1080, 1920],
  portrait: [1080, 1350],
};

const QUALITY_SAMPLES: { [name: string]: number } = { draft: 64, good: 256, best: 512 };

// What the studio needs from the viewer.
export interface StudioContext {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  panel: LoadPanel;
  view(): any;
  renderer(): any;
  system(): any;
  defaults: { [key: string]: any };
  rebuildTraits: string[];
  // Ligand residues, largest first.
  ligands(): { selection: any; atoms: number }[];
  // A short message in the viewer's corner.
  flash(text: string): void;
  queueExport<T>(job: () => Promise<T>): Promise<T>;
  // Pauses (true) or resumes the on-screen loop while an export uses the renderer.
  setExporting(on: boolean): void;
  // Applies settings changes still waiting to be built.
  flush(): void;
  // Back to the on-screen size after an export, and to the on-screen frame
  // and geometry when `rebuild`.
  restoreLive(rebuild: boolean): void;
  // Restart the on-screen shading.
  redraw(): void;
}

export interface FilmOptions {
  size?: string | [number, number];
  width?: number;
  height?: number;
  fps?: number;
  // 'draft', 'good' (default) or 'best': ambient-occlusion samples per frame.
  quality?: string;
  samples?: number;
  aoRes?: number;
  supersample?: number;
  background?: string | string[] | { center: string; edge: string };
  vignette?: number;
  motionBlur?: number;
  shutter?: number;
  credit?: string;
  bitrate?: number;
  transparent?: boolean;
  // true: refit the whole structure; default: keep what is on screen.
  fit?: boolean;
  // Preview only
  loop?: boolean;
  autoplay?: boolean;
  filename?: string;
}

export interface FilmResult {
  mp4: Uint8Array | null;
  width: number;
  height: number;
  frames: number;
  fps: number;
}

class Cancelled extends Error {
  constructor(reason = 'cancelled') {
    super(reason);
  }
}

const ICON_PLAY = '<path stroke="none" d="M 3 1.5 L 14 8 L 3 14.5 Z"/>';
const ICON_PAUSE = '<path stroke="none" d="M 3 1.5 H 6.5 V 14.5 H 3 Z M 9.5 1.5 H 13 V 14.5 H 9.5 Z"/>';
const ICON_DOWNLOAD = '<path d="M 8 1.5 V 10 M 4 6.5 L 8 10.5 L 12 6.5 M 2 14 H 14" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
const ICON_CLOSE = '<path d="M 3 3 L 13 13 M 13 3 L 3 13" fill="none" stroke-width="1.8" stroke-linecap="round"/>';

function svg(path: string): string {
  return '<svg viewBox="0 0 16 16" aria-hidden="true">' + path + '</svg>';
}

function clock(t: number): string {
  const s = Math.max(0, Math.round(t));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// A yield to the browser: an animation frame while the page is visible (so the
// on-screen canvas shows the export's progress), a message otherwise (hidden
// tabs throttle timers and stop animation frames).
function tick(): Promise<void> {
  if (!document.hidden) return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// Film output size: named, [w, h] or width / height; even numbers, at most
// maxSide on the longer side.
export function videoSize(options: FilmOptions, fallback: [number, number], maxSide: number): [number, number] {
  let w: number, h: number;
  const size = options.size;
  if (Array.isArray(size)) {
    [w, h] = size;
  } else if (typeof size === 'string') {
    const named = VIDEO_SIZES[size.toLowerCase()];
    if (!named) throw new Error("unknown size '" + size + "' (use " + Object.keys(VIDEO_SIZES).join(', ') + ' or [width, height])');
    [w, h] = named;
  } else if (options.width || options.height) {
    const aspect = fallback[0] / fallback[1];
    w = options.width || Math.round((options.height as number) * aspect);
    h = options.height || Math.round((options.width as number) / aspect);
  } else {
    [w, h] = VIDEO_SIZES['1080p'];
  }
  if (!(w > 0 && h > 0)) throw new Error('video width and height must be positive');
  if (Math.max(w, h) > maxSide) {
    const f = maxSide / Math.max(w, h);
    w *= f;
    h *= f;
  }
  return [2 * Math.max(1, Math.round(w / 2)), 2 * Math.max(1, Math.round(h / 2))];
}

// Draws the titles of a state (and a credit line) over a picture of size w x h.
function drawOverlays(ctx: CanvasRenderingContext2D, overlays: any[], credit: string, w: number, h: number, dark: boolean) {
  const unit = Math.min(w, h);
  const margin = 0.06 * unit;
  const ink = dark ? '#ffffff' : '#111418';
  const draw = (o: any) => {
    const size = 0.07 * unit * (o.size || 1);
    const sub = o.subtitle ? 0.55 * size : 0;
    const pos = String(o.position || 'bottom-left');
    const align: CanvasTextAlign = /left/.test(pos) ? 'left' : /right/.test(pos) ? 'right' : 'center';
    const x = align === 'left' ? margin : align === 'right' ? w - margin : w / 2;
    const block = size + (sub ? 0.35 * size + sub : 0);
    let top: number;
    if (/^top/.test(pos)) top = margin;
    else if (/^bottom/.test(pos)) top = h - margin - block;
    else top = (h - block) / 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = o.color || ink;
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 0.08 * size;
    ctx.font = '600 ' + size.toFixed(1) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(o.text, x, top);
    if (sub) {
      ctx.globalAlpha *= 0.8;
      ctx.font = '400 ' + sub.toFixed(1) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(o.subtitle, x, top + 1.25 * size);
    }
    ctx.restore();
  };
  overlays.forEach(draw);
  if (credit) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = (0.022 * unit).toFixed(1) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(credit, w - 0.03 * unit, h - 0.025 * unit);
    ctx.restore();
  }
}

// First color of a background, to choose the titles' ink.
function backgroundColor(background: any): string {
  if (Array.isArray(background)) return background[0];
  if (background && typeof background === 'object') return background.center;
  return background || '#ffffff';
}

// Solid, vertical-gradient ([top, ..., bottom]) or radial ({center, edge},
// an ellipse centered a little above the middle) background.
function paintBackground(ctx: CanvasRenderingContext2D, background: any, w: number, h: number) {
  if (background && typeof background === 'object' && !Array.isArray(background)) {
    const cx = w / 2, cy = 0.42 * h;
    const rx = Math.max(cx, w - cx) * Math.SQRT2, ry = Math.max(cy, h - cy) * Math.SQRT2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, background.center || '#ffffff');
    g.addColorStop(1, background.edge || background.center || '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(-cx, (-cy * rx) / ry, w, (h * rx) / ry);
    ctx.restore();
    return;
  }
  const colors = Array.isArray(background) ? background : [background || '#ffffff'];
  if (colors.length > 1) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = colors[0];
  }
  ctx.fillRect(0, 0, w, h);
}

function paintVignette(ctx: CanvasRenderingContext2D, strength: number, w: number, h: number) {
  if (!(strength > 0)) return;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, 0.35 * r, w / 2, h / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,' + Math.min(1, strength).toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// The visible rectangle of a view in rotated (screen-aligned) coordinates.
// The canvas shows the bottom-left part of a square frame of side max(w, h).
function visibleRect(v: any) {
  const res = v.resolution;
  const side = Math.max(res.x, res.y);
  const half = 1 / (2 * v.zoom);
  const w = res.x / (side * v.zoom), h = res.y / (side * v.zoom);
  const cx = v.translation.x - half * (1 - res.x / side);
  const cy = v.translation.y - half * (1 - res.y / side);
  return { left: cx - w / 2, right: cx + w / 2, bottom: cy - h / 2, top: cy + h / 2, width: w, height: h };
}

// Frames `out` (a view at another size and shape, with live's rotation) like
// the on-screen view `live`: when the whole structure is on screen, it is
// fitted to the new shape; otherwise (zoomed in or panned) everything on
// screen stays in the picture, with margins rather than cropping.
export function matchFraming(out: any, live: any, system: any) {
  const fit = { ...live, translation: { ...live.translation } };
  speckView.center(fit, system);
  const a = visibleRect(fit), b = visibleRect(live);
  const tol = 0.03 * Math.max(a.width, a.height);
  const showsAll = a.left >= b.left - tol && a.right <= b.right + tol && a.bottom >= b.bottom - tol && a.top <= b.top + tol;
  if (showsAll) {
    speckView.center(out, system);
    return;
  }
  const cam = speckFilm.fromView(live);
  const w = out.resolution.x, h = out.resolution.y, m = Math.min(w, h);
  speckFilm.toView({ q: cam.q, target: cam.target, span: Math.max((b.width * m) / w, (b.height * m) / h) }, out);
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

interface Preview {
  timeline: any;
  base: any;          // the live view's values before the preview
  touched: Set<string>;
  t: number;
  playing: boolean;
  loop: boolean;
  dirty: boolean;
  frameTouched: boolean;
  options: FilmOptions;
  film: any;
  bar: HTMLDivElement;
  playButton: HTMLButtonElement;
  slider: HTMLInputElement;
  time: HTMLSpanElement;
  titles: HTMLCanvasElement;
}

export class FilmStudio {
  private ctx: StudioContext;
  private built: string | null = null;
  private preview: Preview | null = null;
  private cancelRequested = false;
  private cancelReason = 'cancelled';
  private blendCache: { key: string; a: HTMLCanvasElement; b: HTMLCanvasElement } | null = null;
  private liveKey = '';

  constructor(ctx: StudioContext) {
    this.ctx = ctx;
  }

  get previewing(): boolean {
    return this.preview !== null;
  }

  // --- compiling ------------------------------------------------------------

  // What film.js needs to know, for a view (the camera the film starts from).
  private scene(view: any) {
    const system = this.ctx.system();
    const live = this.ctx.view();
    const defaults = this.ctx.defaults;
    return {
      start: { ...speckFilm.fromView(view), settings: {}, frame: null, overlays: [], blend: null },
      value: (key: string) => {
        if (!(key in defaults)) throw new Error("unknown setting '" + key + "'");
        return view[key];
      },
      selection: (sel: any) => {
        const idx: number[] = speckSelect.indices(system, sel);
        if (!idx.length) return null;
        let x = 0, y = 0, z = 0;
        for (const i of idx) {
          const a = system.atoms[i];
          x += a.x; y += a.y; z += a.z;
        }
        x /= idx.length; y /= idx.length; z /= idx.length;
        let r = 0;
        for (const i of idx) {
          const a = system.atoms[i];
          r = Math.max(r, Math.hypot(a.x - x, a.y - y, a.z - z));
        }
        return { center: [x, y, z], radius: r + 2 };
      },
      frames: system.frames ? system.frames.length : 1,
      center: (() => {
        let x = 0, y = 0, z = 0;
        const n = Math.max(1, system.atoms.length);
        for (const a of system.atoms) {
          x += a.x; y += a.y; z += a.z;
        }
        return [x / n, y / n, z / n];
      })(),
      // Cameras from cameraState() were taken at the on-screen size.
      camera: (c: any) => {
        if (!c || !c.rotation || c.rotation.length !== 16) throw new Error('keyframe camera needs a 16-number rotation');
        return speckFilm.fromView({
          rotation: new Float32Array(c.rotation),
          translation: { x: c.translation ? c.translation[0] : 0, y: c.translation ? c.translation[1] : 0 },
          zoom: c.zoom || live.zoom,
          resolution: live.resolution,
        });
      },
      focusDepth: (sel: any, q: any) => {
        const probe = { ...view };
        speckFilm.toView({ q: q, target: [0, 0, 0], span: 1 }, probe);
        return this.ctx.renderer().selectionDepth(probe, sel);
      },
    };
  }

  // What recipes need to know about the structure.
  private info() {
    const system = this.ctx.system();
    const ligand = this.ctx.ligands()[0];
    return { ligand: ligand ? ligand.selection : null, frames: system && system.frames ? system.frames.length : 1 };
  }

  // Recipes with whether each can be made for the loaded structure.
  recipes() {
    const info = this.info();
    return VIDEO_RECIPES.map((r) => ({ ...r, available: speckRecipes.available(r, info) }));
  }

  // A film as shots. Films are lists of shots, the name of a recipe
  // ('tour'), or {recipe or shots, seconds, target, title, subtitle}.
  resolve(film: any): any[] {
    const spec = typeof film === 'string' ? { recipe: film } : Array.isArray(film) ? { shots: film } : film || {};
    const shots = spec.recipe ? speckRecipes.build(spec.recipe, this.info(), spec) : spec.shots;
    if (!Array.isArray(shots)) {
      throw new Error('a film is a list of shots or the name of a video: ' + VIDEO_RECIPES.map((r) => r.name).join(', '));
    }
    return speckRecipes.withTitle(shots, spec.title, spec.subtitle);
  }

  // Seconds a film lasts (throws on a bad film).
  duration(film: any): number {
    if (!this.ctx.system()) throw new Error('nothing to film yet');
    return speckFilm.compile(this.resolve(film), this.scene(this.ctx.view())).duration;
  }

  // A view showing a state: the base values, the state's settings and camera.
  private viewFor(state: any, base: any, extra?: any): any {
    const v = { ...base, translation: { ...base.translation } };
    Object.assign(v, state.settings);
    if (extra) Object.assign(v, extra);
    speckFilm.toView(state, v);
    speckView.resolve(v);
    return v;
  }

  private geometryKey(view: any, frame: number | null): string {
    return JSON.stringify(this.ctx.rebuildTraits.map((t) => view[t])) + '|' + (frame === null ? view.frame : frame);
  }

  // Rebuilds the geometry when the frame or a geometry setting changed.
  private ensureGeometry(view: any, frame: number | null) {
    const system = this.ctx.system();
    const key = this.geometryKey(view, frame);
    if (key === this.built) return;
    this.built = key;
    speckSystem.setFrame(system, frame === null ? view.frame : frame);
    speckCartoon.applyVisibility(system, view);
    speckSelect.apply(system, view);
    speckSystem.calculateBonds(system, view);
    this.ctx.renderer().setSystem(system, view);
  }

  // --- export ---------------------------------------------------------------

  // Stops the export in progress: it rejects with 'cancelled', or the reason.
  cancel(reason = 'cancelled') {
    this.cancelRequested = true;
    this.cancelReason = reason;
  }

  // Renders a film. With format 'mp4' (default) the frames are encoded into
  // an MP4 in the browser; otherwise each frame's canvas goes to onFrame.
  render(film: any, options: FilmOptions & { format?: string },
         onFrame?: (index: number, count: number, frame: HTMLCanvasElement) => Promise<void> | void): Promise<FilmResult> {
    return this.ctx.queueExport(async () => {
      const ctx = this.ctx;
      this.stop();
      ctx.flush();
      const renderer = ctx.renderer();
      const system = ctx.system();
      const live = ctx.view();
      const liveKey = this.geometryKey(live, null);
      const mp4 = (options.format || 'mp4') === 'mp4';
      if (mp4 && !speckVideo.supported()) {
        throw new Error('this browser cannot encode video (needs WebCodecs: Chrome, Edge, Safari 16.4+ or Firefox 130+)');
      }
      const gl = ctx.canvas.getContext('webgl') as WebGLRenderingContext;
      const maxSide = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0]);
      const [w, h] = videoSize(options, [live.resolution.x, live.resolution.y], maxSide);
      let ss = Math.max(1, Math.round(options.supersample || 1));
      while (ss > 1 && Math.max(w, h) * ss > maxSide) ss--;
      const fps = Math.max(1, Math.min(120, options.fps || 30));

      const base = { ...live, translation: { ...live.translation } };
      base.rotation = new Float32Array(live.rotation);
      base.resolution = { x: w * ss, y: h * ss };
      base.aoRes = options.aoRes || Math.max(1024, live.aoRes);
      base.aoSamples = options.samples || QUALITY_SAMPLES[options.quality || 'good'] || 256;
      base.spf = 128;
      // The film starts from what is on screen (fit: true refits the whole structure).
      if (options.fit === true) {
        speckView.center(base, system);
      } else if (Math.abs(w / h - live.resolution.x / live.resolution.y) >= 0.01) {
        matchFraming(base, live, system);
      }
      const timeline = speckFilm.compile(this.resolve(film), this.scene(base));
      const count = Math.max(1, Math.round(timeline.duration * fps));

      const writer = mp4 ? new speckVideo.VideoWriter({ width: w, height: h, fps: fps, bitrate: options.bitrate }) : null;
      if (writer) await writer.start();

      const out = newCanvas(w, h);
      const layer = newCanvas(w, h);
      const dark = luminance(backgroundColor(options.background)) < 0.45;
      const started = performance.now();
      this.cancelRequested = false;
      this.cancelReason = 'cancelled';
      this.built = liveKey;
      const panel = ctx.panel;
      panel.step('film', 'Rendering video', 0, count + ' frames · ' + w + ' × ' + h + ' · ' + fps + ' fps');
      panel.action('Cancel', () => this.cancel());
      ctx.setExporting(true);
      renderer.setResolution(base.resolution, base.aoRes);
      try {
        for (let k = 0; k < count; k++) {
          if (this.cancelRequested) throw new Cancelled(this.cancelReason);
          if (ctx.system() !== system) throw new Cancelled('a new structure was loaded while the video was being made');
          await this.composeFrame(timeline, k / fps, base, options, fps, out, layer, dark);
          if (writer) await writer.add(out);
          else if (onFrame) await onFrame(k, count, out);
          const elapsed = (performance.now() - started) / 1000;
          const left = (elapsed / (k + 1)) * (count - k - 1);
          panel.update('film', (k + 1) / count,
            'frame ' + (k + 1) + ' / ' + count + ' · ' + clock(left) + ' left' +
            (writer ? ' · ' + (writer.byteLength / 1e6).toFixed(1) + ' MB' : ''));
        }
        let bytes: Uint8Array | null = null;
        if (writer) {
          panel.step('encode', 'Finishing the MP4', null);
          bytes = await writer.finish();
        }
        return { mp4: bytes, width: w, height: h, frames: count, fps: fps };
      } catch (e) {
        if (writer) writer.cancel();
        throw e;
      } finally {
        ctx.setExporting(false);
        ctx.restoreLive(this.built !== liveKey);
        this.built = null;
        this.blendCache = null;
        panel.finish(false);
      }
    });
  }

  // Renders and downloads a film as an MP4 file.
  async download(film: any, options: FilmOptions = {}): Promise<FilmResult> {
    const result = await this.render(film, options);
    const blob = new Blob([result.mp4 as Uint8Array], { type: 'video/mp4' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = options.filename || 'speck.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    this.ctx.flash('Saved ' + link.download + ' (' + (blob.size / 1e6).toFixed(1) + ' MB) to your downloads');
    return result;
  }

  // One output frame at time t: background, the picture (averaged over the
  // shutter with motion blur), vignette and titles.
  private async composeFrame(timeline: any, t: number, base: any, options: FilmOptions, fps: number,
                             out: HTMLCanvasElement, layer: HTMLCanvasElement, dark: boolean) {
    const w = out.width, h = out.height;
    const o = out.getContext('2d') as CanvasRenderingContext2D;
    const l = layer.getContext('2d') as CanvasRenderingContext2D;
    const sub = Math.max(1, Math.round(options.motionBlur || 1));
    const shutter = options.shutter === undefined ? 0.5 : options.shutter;
    l.clearRect(0, 0, w, h);
    for (let j = 0; j < sub; j++) {
      const at = sub > 1 ? t + ((j + 0.5) / sub - 0.5) * (shutter / fps) : t;
      const state = timeline.sample(Math.max(0, Math.min(timeline.duration, at)));
      // Running average of the sub-frames.
      await this.drawState(state, base, l, 1 / (j + 1));
    }
    o.clearRect(0, 0, w, h);
    if (!options.transparent) paintBackground(o, options.background, w, h);
    o.drawImage(layer, 0, 0);
    paintVignette(o, options.vignette || 0, w, h);
    drawOverlays(o, timeline.sample(t).overlays, options.credit || '', w, h, dark);
  }

  // Draws a state into a 2D context with alpha (a crossfade draws both pictures).
  private async drawState(state: any, base: any, target: CanvasRenderingContext2D, alpha: number) {
    const w = target.canvas.width, h = target.canvas.height;
    const draw = (a: number) => {
      target.save();
      target.globalAlpha = a;
      target.imageSmoothingEnabled = true;
      (target as any).imageSmoothingQuality = 'high';
      target.drawImage(this.ctx.canvas, 0, 0, w, h);
      target.restore();
    };
    if (!state.blend) {
      await this.renderView(this.viewFor(state, base), state.frame, () => draw(alpha));
      return;
    }
    // Crossfade: the picture before, then the new settings over it. Both are
    // kept while the camera and settings stay the same (a crossfade usually
    // holds still), so each is rendered once, not twice per frame.
    const key = JSON.stringify([Array.from(state.q), state.target, state.span, state.settings, state.frame, state.blend.settings]);
    let cache = this.blendCache;
    if (!cache || cache.key !== key || cache.a.width !== w || cache.a.height !== h) {
      const a = newCanvas(w, h), b = newCanvas(w, h);
      const into = (c: HTMLCanvasElement) => () => {
        const g = c.getContext('2d') as CanvasRenderingContext2D;
        g.imageSmoothingEnabled = true;
        (g as any).imageSmoothingQuality = 'high';
        g.drawImage(this.ctx.canvas, 0, 0, w, h);
      };
      await this.renderView(this.viewFor(state, base), state.frame, into(a));
      await this.renderView(this.viewFor(state, base, state.blend.settings), state.frame, into(b));
      cache = this.blendCache = { key, a, b };
    }
    target.save();
    target.globalAlpha = alpha;
    target.drawImage(cache.a, 0, 0);
    target.globalAlpha = alpha * state.blend.alpha;
    target.drawImage(cache.b, 0, 0);
    target.restore();
  }

  // Renders a view until its ambient occlusion is complete, then calls draw
  // at once (the WebGL canvas is cleared after the browser shows it).
  private async renderView(view: any, frame: number | null, draw: () => void) {
    const renderer = this.ctx.renderer();
    this.ensureGeometry(view, frame);
    renderer.reset();
    for (let i = 0; i < 2000; i++) {
      if (renderer.renderFixed(view, view.aoSamples)) break;
      await tick();
      if (this.cancelRequested) throw new Cancelled(this.cancelReason);
    }
    renderer.renderFixed(view, view.aoSamples);
    draw();
  }

  // --- preview --------------------------------------------------------------

  // Plays a film in the viewer with a player bar (play / pause, scrubber,
  // download, close). The view returns to how it was when the player closes.
  play(film: any, options: FilmOptions = {}) {
    if (!this.ctx.system()) throw new Error('nothing to film yet');
    this.stop();
    this.ctx.flush();
    const live = this.ctx.view();
    const timeline = speckFilm.compile(this.resolve(film), this.scene(live));
    const base = { ...live, translation: { ...live.translation }, rotation: new Float32Array(live.rotation) };
    const bar = document.createElement('div');
    bar.className = 'ipyspeck-player';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Film preview');
    const button = (label: string, icon: string, run: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.innerHTML = svg(icon);
      b.addEventListener('click', run);
      return b;
    };
    const playButton = button('Pause', ICON_PAUSE, () => this.togglePlay());
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(timeline.duration);
    slider.step = '0.01';
    slider.value = '0';
    slider.setAttribute('aria-label', 'Film time');
    slider.addEventListener('input', () => this.seek(parseFloat(slider.value)));
    const time = document.createElement('span');
    time.className = 'ipyspeck-player-time';
    bar.appendChild(playButton);
    bar.appendChild(slider);
    bar.appendChild(time);
    if (speckVideo.supported()) {
      const save = button('Save video (MP4)', ICON_DOWNLOAD, () => {
        const f = this.preview ? this.preview.film : film;
        const o = this.preview ? this.preview.options : options;
        this.stop();
        this.download(f, o).catch((e) => {
          if (!(e instanceof Cancelled) || e.message !== 'cancelled') {
            this.ctx.panel.fail('Video export failed: ' + (e.message || e));
          }
        });
      });
      save.className = 'ipyspeck-player-save';
      save.insertAdjacentHTML('beforeend', '<span>Save video</span>');
      bar.appendChild(save);
    }
    bar.appendChild(button('Close preview', ICON_CLOSE, () => this.stop()));
    const titles = document.createElement('canvas');
    titles.className = 'ipyspeck-titles';
    this.ctx.el.appendChild(titles);
    this.ctx.el.appendChild(bar);
    this.preview = {
      timeline, base, touched: new Set(), t: 0, playing: options.autoplay !== false,
      loop: options.loop !== false, dirty: true, frameTouched: false, options, film,
      bar, playButton, slider, time, titles,
    };
    this.built = this.geometryKey(live, null);
    this.liveKey = this.built;
    this.updateBar();
  }

  togglePlay() {
    const p = this.preview;
    if (!p) return;
    if (!p.playing && p.t >= p.timeline.duration) p.t = 0;
    p.playing = !p.playing;
    p.dirty = true;
    this.updateBar();
  }

  seek(t: number) {
    const p = this.preview;
    if (!p) return;
    p.t = Math.max(0, Math.min(p.timeline.duration, t));
    p.playing = false;
    p.dirty = true;
    this.updateBar();
  }

  // Closes the player and puts the view back.
  stop() {
    const p = this.preview;
    if (!p) return;
    this.preview = null;
    const live = this.ctx.view();
    live.rotation = p.base.rotation;
    live.translation = p.base.translation;
    live.zoom = p.base.zoom;
    p.touched.forEach((key) => { live[key] = p.base[key]; });
    speckView.resolve(live);
    p.bar.remove();
    p.titles.remove();
    this.ctx.restoreLive(this.built !== this.geometryKey(live, null) || this.built !== this.liveKey);
    this.built = null;
    this.ctx.redraw();
  }

  // Changes an export option of the film being previewed (e.g. its size).
  setOption(key: string, value: any) {
    if (this.preview) this.preview.options = { ...this.preview.options, [key]: value };
  }

  // A setting changed while previewing: it becomes part of the base.
  noteSetting(key: string, value: any) {
    if (this.preview) {
      this.preview.base[key] = value;
      this.preview.dirty = true;
      if (this.ctx.rebuildTraits.indexOf(key) >= 0) this.built = null;
    }
  }

  // Advances the preview by dt ms and applies its state to the live view.
  // Returns 'moving' while playing (render fully shaded frames), 'changed'
  // when the picture changed while paused, '' otherwise.
  frame(dt: number): string {
    const p = this.preview;
    if (!p) return '';
    if (p.playing) {
      p.t += Math.min(dt, 100) / 1000;
      if (p.t >= p.timeline.duration) {
        if (p.loop && p.timeline.duration > 0) p.t %= p.timeline.duration;
        else {
          p.t = p.timeline.duration;
          p.playing = false;
        }
      }
      p.dirty = true;
      this.updateBar();
    }
    if (!p.dirty) return '';
    p.dirty = false;
    const state = p.timeline.sample(p.t);
    const live = this.ctx.view();
    // Settings a crossfade is heading to switch halfway in the preview.
    const settings = state.blend && state.blend.alpha >= 0.5 ? { ...state.settings, ...state.blend.settings } : state.settings;
    for (const key of Object.keys(settings)) p.touched.add(key);
    p.touched.forEach((key) => { live[key] = key in settings ? settings[key] : p.base[key]; });
    speckFilm.toView(state, live);
    speckView.resolve(live);
    if (state.frame !== null) p.frameTouched = true;
    this.ensureGeometry(live, state.frame);
    this.drawTitles(state.overlays);
    return p.playing ? 'moving' : 'changed';
  }

  private drawTitles(overlays: any[]) {
    const p = this.preview;
    if (!p) return;
    const c = p.titles;
    const w = this.ctx.el.clientWidth, h = this.ctx.el.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.clearRect(0, 0, c.width, c.height);
    const bg = backgroundColor(p.options.background);
    // Titles sit above the player bar.
    const bar = (p.bar.offsetHeight + 12) * dpr;
    drawOverlays(g, overlays, p.options.credit || '', c.width, Math.max(1, c.height - bar), luminance(bg) < 0.45);
  }

  private updateBar() {
    const p = this.preview;
    if (!p) return;
    p.slider.value = String(p.t);
    p.time.textContent = clock(p.t) + ' / ' + clock(p.timeline.duration);
    const label = p.playing ? 'Pause' : 'Play';
    if (p.playButton.title !== label) {
      p.playButton.title = label;
      p.playButton.setAttribute('aria-label', label);
      p.playButton.innerHTML = svg(p.playing ? ICON_PAUSE : ICON_PLAY);
    }
  }
}
