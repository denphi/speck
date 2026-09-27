import { Application, IPlugin } from '@lumino/application';
import { Widget } from '@lumino/widgets';
/**
 * The example plugin.
 */
declare const examplePlugin: IPlugin<Application<Widget>, void>;
export default examplePlugin;
