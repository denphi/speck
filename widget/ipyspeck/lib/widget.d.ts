import { DOMWidgetModel, DOMWidgetView, ISerializers } from '@jupyter-widgets/base';
import '../css/widget.css';
export declare class SpeckModel extends DOMWidgetModel {
    defaults(): {
        _model_name: string;
        _model_module: any;
        _model_module_version: any;
        _view_name: string;
        _view_module: any;
        _view_module_version: any;
        data: string;
        bonds: boolean;
        atomScale: number;
        relativeAtomScale: number;
        bondScale: number;
        brightness: number;
        outline: number;
        spf: number;
        bondThreshold: number;
        bondShade: number;
        atomShade: number;
        dofStrength: number;
        dofPosition: number;
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
    private system;
    private view;
    private renderer;
    private needReset;
    private current_schema;
    private container;
    private canvas;
    private topbar;
    initialize(parameters: any): void;
    render(): void;
    processLuminoMessage(msg: any): void;
    _handleMessage(msg: any): void;
    handleCustomMessage(message: any): void;
    loadStructure(): void;
    center(): void;
    topview(): void;
    frontview(): void;
    rightview(): void;
    setAtomsColor(atoms: any): void;
    setColorSchema(schema: string): void;
    switchColorSchema(): void;
    xyz(data: string): any[][];
    reflow(): void;
    loop(): void;
}
