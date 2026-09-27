// window.Speck: the viewer shared with ipyspeck and stspeck (../../core).
import { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS } from '../../core/lib/viewer';
import '../../core/css/speck.css';

(window as any).Speck = { SpeckViewer, VIEW_DEFAULTS, VIEW_TRAITS };
