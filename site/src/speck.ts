// window.Speck: the viewer shared with ipyspeck and stspeck (../../core).
import { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS, LOOKS } from '../../core/lib/viewer';
import '../../core/css/speck.css';

declare function require(module: string): any;
// Element table, for resetting custom element colors.
const elements = require('../../core/lib/elements.js');

(window as any).Speck = { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS, LOOKS, elements };
