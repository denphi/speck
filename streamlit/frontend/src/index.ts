// Streamlit component for the Speck viewer.
//
// Talks to Streamlit through the component postMessage protocol (the same
// messages streamlit-component-lib sends), so no React or Arrow is needed:
//   -> streamlit:componentReady, streamlit:setFrameHeight, streamlit:setComponentValue
//   <- streamlit:render { args }

// The viewer and renderer are shared with ipyspeck (see ../../../core).
import { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS } from '../../../core/lib/viewer';
import '../../../core/css/speck.css';

function send(type: string, data: any = {}) {
  window.parent.postMessage({ isStreamlitMessage: true, apiVersion: 1, type: type, ...data }, '*');
}

const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

// Settings shown now. Python arguments only override a setting when they
// change between reruns, so toolbar choices survive unrelated reruns.
const state: { [key: string]: any } = { data: '', toolbar: true, camera: {}, ...VIEW_DEFAULTS };
let lastArgs: { [key: string]: any } = {};
let nframes = 1;
let returnState = false;
let exportOptions: any = {};
let viewer: SpeckViewer | null = null;

const root = document.getElementById('root') as HTMLDivElement;

function report() {
  if (!returnState || !viewer) return;
  const value: { [key: string]: any } = { camera: viewer.cameraState(), nframes: nframes };
  for (const trait of VIEW_TRAITS) value[trait] = state[trait];
  send('streamlit:setComponentValue', { value: value, dataType: 'json' });
}

function download(png: ArrayBuffer, name: string) {
  const url = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createViewer() {
  viewer = new SpeckViewer(root, {
    get: (trait) => (trait === 'trajectory' ? trajectory : state[trait]),
    set: (changes) => {
      for (const trait in changes) {
        state[trait] = changes[trait];
        (viewer as SpeckViewer).setTrait(trait, changes[trait]);
      }
      report();
    },
    cameraChanged: (camera) => {
      state.camera = camera;
      report();
    },
    framesChanged: (n) => {
      if (n !== nframes) {
        nframes = n;
        report();
      }
    },
    // Camera button: high-resolution, supersampled PNG.
    snapshot: () => {
      (viewer as SpeckViewer)
        .renderImage(exportOptions)
        .then((image) => download(image.png, exportOptions.filename || 'speck.png'))
        .catch((e) => console.error('stspeck export failed', e));
    },
  });
}

// MD frames (bytes from stspeck.from_mdtraj / from_mdanalysis) as a Float32Array.
let trajectory: Float32Array | null = null;
let trajectoryBytes: Uint8Array | null = null;
function sameBytes(a: Uint8Array | null, b: Uint8Array | null) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function setTrajectory(value: any): boolean {
  const bytes: Uint8Array | null =
    value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null;
  if (sameBytes(bytes, trajectoryBytes)) return false;
  trajectoryBytes = bytes;
  // Copy into an aligned buffer (the bytes may sit at any offset).
  trajectory = bytes && bytes.length >= 12 ? new Float32Array(bytes.slice().buffer, 0, Math.floor(bytes.length / 4)) : null;
  return true;
}

// The film to preview (args.film), started once the structure is on screen.
let filmTimer: any = null;
function showFilm(film: any) {
  clearInterval(filmTimer);
  if (!viewer) return;
  if (!film) {
    viewer.stopFilm();
    return;
  }
  const start = () => {
    const v = viewer as SpeckViewer;
    if (!v.loaded) return false;
    clearInterval(filmTimer);
    try {
      v.playFilm(film.film, { ...(film.video || {}), loop: film.loop });
    } catch (e) {
      v.showNotice('Video: ' + ((e as Error).message || e));
    }
    return true;
  };
  if (!start()) filmTimer = setInterval(start, 200);
}

function onRender(args: { [key: string]: any }) {
  const height = args.height || 400;
  root.style.height = height + 'px';
  send('streamlit:setFrameHeight', { height: height });
  returnState = !!args.return_state;
  exportOptions = args.export || {};

  const changed = (key: string) => key in args && !same(args[key], lastArgs[key]);
  const trajectoryChanged = setTrajectory(args.trajectory);
  const dataChanged = changed('data') || trajectoryChanged;
  const newCamera = changed('camera') && args.camera && args.camera.rotation;
  for (const key of ['data', 'toolbar', 'camera', ...VIEW_TRAITS]) {
    if (changed(key)) state[key] = args[key];
  }

  if (!viewer) {
    createViewer();
  } else {
    for (const trait of VIEW_TRAITS) {
      if (changed(trait)) viewer.setTrait(trait, state[trait]);
    }
    if (changed('toolbar')) viewer.updateToolbar();
    if (dataChanged) viewer.loadStructure();
    else if (newCamera) viewer.setCamera(state.camera);
  }
  if (changed('film') || (dataChanged && args.film)) showFilm(args.film);
  lastArgs = args;
}

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data;
  if (message && message.type === 'streamlit:render') {
    onRender(message.args || {});
  }
});

send('streamlit:componentReady');
