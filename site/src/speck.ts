// window.Speck: the viewer shared with ipyspeck and stspeck (../../core).
import { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS, LOOKS, videoSupported } from '../../core/lib/viewer';
import '../../core/css/speck.css';

declare function require(module: string): any;
// Element table, for resetting custom element colors.
const elements = require('../../core/lib/elements.js');
// Structure format detection ('mmcif', 'pdb', 'sdf' or 'xyz').
const formats = require('../../core/lib/formats.js');

(window as any).Speck = { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS, LOOKS, elements, detectFormat: formats.detect, videoSupported };
