import { DOMWidgetModel, DOMWidgetView, ISerializers } from '@jupyter-widgets/base';
import '../../core/css/speck.css';
export declare class SpeckModel extends DOMWidgetModel {
    defaults(): {
        _model_name: string;
        _model_module: any;
        _model_module_version: any;
        _view_name: string;
        _view_module: any;
        _view_module_version: any;
        data: string;
        _data: null;
        _trajectory: null;
        toolbar: boolean;
        camera: {};
        nframes: number;
    };
    static serializers: ISerializers;
    static model_name: string;
    static model_module: any;
    static model_module_version: any;
    static view_name: string;
    static view_module: any;
    static view_module_version: any;
}
export declare class SpeckView extends DOMWidgetView {
    private viewer;
    private applyingCamera;
    private text;
    private textTicket;
    private decodeData;
    private trajectory;
    private reloadData;
    render(): void;
    remove(): any;
    handleCustomMessage(message: any): void;
}
