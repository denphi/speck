var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');
const speckRenderer = require('./renderer.js');
const speckSystem = require('./system.js');
const speckView = require('./view.js');
const speckInteractions = require('./interactions.js');
const speckPresetViews = require('./presets.js');
const speckColors = require('./colors.js');




// See example.py for the kernel counterpart to this file.


// Custom Model. Custom widgets models must at least provide default values
// for model attributes, including
//
//  - `_view_name`
//  - `_view_module`
//  - `_view_module_version`
//
//  - `_model_name`
//  - `_model_module`
//  - `_model_module_version`
//
//  when different from the base class.

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
var SpeckModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
        _model_name : 'SpeckModel',
        _view_name : 'SpeckView',
        _model_module : 'ipyspeck',
        _view_module : 'ipyspeck',
        _model_module_version : '0.6.2',
        _view_module_version : '0.6.2',
        data : '',
        bonds : true,
        atomScale : 0.24,
        relativeAtomScale: 0.64,
        bondScale: 0.5,
        brightness: 0.5,
        outline: 0.0,
        spf: 32,
        bondThreshold: 1.2,
        bondShade: 0.5,
        atomShade: 0.5,
        dofStrength: 0.0,
        dofPosition: 0.5
    })
});


// Custom View. Renders the widget model.
var SpeckView = widgets.DOMWidgetView.extend({

  initialize: function() {
      this.system = speckSystem.new();
      this.view = speckView.new();
      this.view.resolution.x = 200;
      this.view.resolution.y = 200;
      this.view.bonds = this.model.get('bonds');
      this.view.atomScale= this.model.get('atomScale');
      this.view.relativeAtomScale= this.model.get('relativeAtomScale');
      this.view.bondScale= this.model.get('bondScale');
      this.view.brightness= this.model.get('brightness');
      this.view.outline= this.model.get('outline');
      this.view.spf= this.model.get('spf');
      this.view.bondThreshold= this.model.get('bondThreshold');
      this.view.bondShade= this.model.get('bondShade');
      this.view.atomShade= this.model.get('atomShade');
      this.view.dofStrength= this.model.get('dofStrength');
      this.view.dofPosition= this.model.get('dofPosition');

      this.renderer = null;
      this.needReset = false;
      this.current_schema="speck";

      let self = this;

      self.container = document.createElement('div')
      self.canvas = document.createElement('canvas')
      self.canvas.addEventListener('dblclick', function(){
        self.center();
      });
      self.topbar = document.createElement('div')
      self.topbar.style.top = "0px"
      self.topbar.style.height = "20px"
      self.topbar.style.right = "0px"
      self.topbar.style.position = "absolute"
      self.topbar.style.background = "rgba(255,255,255,0.5)"
      self.topbar.style.flexDirection = "row";
      self.topbar.style.alignContent = "flex-end";
      self.topbar.style.display = "flex";


      self.infoc = document.createElement("div");
      self.infoc.style.fontSize = "10px";
      self.infoc.style.color = "#AAA";
      self.infoc.innerHTML = 'Colors: ' + self.current_schema;



      self.autoscale = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.autoscale.setAttribute('width', "16");
      self.autoscale.setAttribute('height', "16");
      self.autoscale.setAttribute('viewBox', "0 0 16 16");
      self.autoscale.setAttribute('fill', "#AAAAAA");
      self.autoscale.addEventListener('mouseover', function(){
        self.autoscale.setAttribute('fill', "#666666");
      });
      self.autoscale.addEventListener('mouseout', function(){
        self.autoscale.setAttribute('fill', "#AAAAAA");
      });
      self.autoscale.innerHTML = '<g><path d="M 1 5 v -4 h 4 M 15 5 v -4 h -4 M 1 11 v 4 h 4 M 11 15 h 4 v -4 M 5 8 l 3 -3 l 3 3 l -3 3 l -3 -3"></path></g>';
      self.autoscale.addEventListener('click', function(){
        self.center();
      });
      self.autoscalec = document.createElement("div");
      self.autoscalec.style.padding="2px"
      self.autoscalec.append(self.autoscale)

      self.camera = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.camera.setAttribute('width', "16");
      self.camera.setAttribute('height', "16");
      self.camera.setAttribute('viewBox', "0 0 16 16");
      self.camera.setAttribute('fill', "#AAAAAA");
      self.camera.addEventListener('mouseover', function(){
        self.camera.setAttribute('fill', "#666666");
      });
      self.camera.addEventListener('mouseout', function(){
        self.camera.setAttribute('fill', "#AAAAAA");
      });
      self.camera.innerHTML = '<g><path d="M 10.421875 8.773438 C 10.421875 10.09375 9.355469 11.160156 8.039062 11.160156 C 6.71875 11.160156 5.652344 10.09375 5.652344 8.773438 C 5.652344 7.457031 6.71875 6.390625 8.039062 6.390625 C 9.355469 6.390625 10.421875 7.457031 10.421875 8.773438 Z M 10.421875 8.773438"></path><path d="M 14.746094 4.007812 L 12.484375 4.007812 C 12.289062 4.007812 12.117188 3.929688 11.992188 3.785156 C 10.816406 2.457031 10.371094 2.015625 9.882812 2.015625 L 6.320312 2.015625 C 5.828125 2.015625 5.359375 2.460938 4.15625 3.785156 C 4.035156 3.929688 3.835938 4.007812 3.664062 4.007812 L 3.492188 4.007812 L 3.492188 3.664062 C 3.492188 3.492188 3.347656 3.320312 3.148438 3.320312 L 2.066406 3.320312 C 1.894531 3.320312 1.722656 3.464844 1.722656 3.664062 L 1.722656 4.007812 L 1.398438 4.007812 C 0.664062 4.007812 0 4.546875 0 5.285156 L 0 12.609375 C 0 13.347656 0.664062 13.984375 1.398438 13.984375 L 14.722656 13.984375 C 15.460938 13.984375 16 13.320312 16 12.609375 L 16 5.257812 C 16.023438 4.546875 15.484375 4.007812 14.746094 4.007812 Z M 8.210938 12.335938 C 6.121094 12.433594 4.398438 10.714844 4.496094 8.625 C 4.570312 6.804688 6.042969 5.332031 7.886719 5.234375 C 9.976562 5.136719 11.695312 6.855469 11.601562 8.945312 C 11.503906 10.765625 10.027344 12.242188 8.210938 12.335938 Z M 12.042969 6.414062 C 11.75 6.414062 11.503906 6.167969 11.503906 5.875 C 11.503906 5.582031 11.75 5.335938 12.042969 5.335938 C 12.335938 5.335938 12.585938 5.582031 12.585938 5.875 C 12.585938 6.167969 12.335938 6.414062 12.042969 6.414062 Z M 12.042969 6.414062 "></path></g>';
      self.camera.addEventListener('click', function(){
        self.saveSnapshot();
      });
      self.camerac = document.createElement("div");
      self.camerac.style.padding="2px"
      self.camerac.append(self.camera)

      self.palette = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.palette.setAttribute('width', "16");
      self.palette.setAttribute('height', "16");
      self.palette.setAttribute('viewBox', "0 0 16 16");
      self.palette.setAttribute('fill', "#AAAAAA");
      self.palette.addEventListener('mouseover', function(){
        self.palette.setAttribute('fill', "#666666");
      });
      self.palette.addEventListener('mouseout', function(){
        self.palette.setAttribute('fill', "#AAAAAA");
      });
      self.palette.innerHTML = '<g><path d="M 7.984375 0.015625 C 3.601562 0.015625 0 3.617188 0 8 C 0 12.382812 3.601562 15.984375 7.984375 15.984375 C 8.742188 15.984375 9.320312 15.402344 9.320312 14.648438 C 9.320312 14.300781 9.175781 13.980469 8.96875 13.75 C 8.738281 13.519531 8.617188 13.226562 8.617188 12.851562 C 8.617188 12.09375 9.199219 11.515625 9.953125 11.515625 L 11.550781 11.515625 C 13.992188 11.515625 15.992188 9.511719 15.992188 7.070312 C 15.972656 3.210938 12.367188 0.015625 7.984375 0.015625 Z M 3.105469 8 C 2.351562 8 1.773438 7.417969 1.773438 6.664062 C 1.773438 5.914062 2.351562 5.332031 3.105469 5.332031 C 3.859375 5.332031 4.441406 5.914062 4.441406 6.664062 C 4.441406 7.417969 3.863281 8 3.105469 8 Z M 5.777344 4.457031 C 5.023438 4.457031 4.445312 3.875 4.445312 3.121094 C 4.445312 2.367188 5.023438 1.789062 5.777344 1.789062 C 6.53125 1.789062 7.113281 2.367188 7.113281 3.121094 C 7.085938 3.878906 6.535156 4.457031 5.777344 4.457031 Z M 10.195312 4.457031 C 9.4375 4.457031 8.859375 3.875 8.859375 3.121094 C 8.859375 2.367188 9.441406 1.789062 10.195312 1.789062 C 10.945312 1.789062 11.527344 2.367188 11.527344 3.121094 C 11.527344 3.878906 10.945312 4.457031 10.195312 4.457031 Z M 12.863281 8 C 12.105469 8 11.527344 7.417969 11.527344 6.664062 C 11.527344 5.914062 12.109375 5.332031 12.863281 5.332031 C 13.617188 5.332031 14.195312 5.914062 14.195312 6.664062 C 14.195312 7.417969 13.617188 8 12.863281 8 Z M 12.863281 8"/></g>';
      self.palette.addEventListener('click', function(){
        self.switchColorSchema();
        self.infoc.innerHTML = 'Colors: ' + self.current_schema;
      });
      self.palettec = document.createElement("div");
      self.palettec.style.padding="2px"
      self.palettec.append(self.palette)

      self.front = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.front.setAttribute('width', "16");
      self.front.setAttribute('height', "16");
      self.front.setAttribute('viewBox', "0 0 16 16");
      self.front.setAttribute('fill', "#AAAAAA");
      self.front.setAttribute('stroke', "#AAAAAA");
      self.front.addEventListener('mouseover', function(){
        self.front.setAttribute('fill', "#666666");
        self.front.setAttribute('stroke', "#666666");
      });
      self.front.addEventListener('mouseout', function(){
        self.front.setAttribute('fill', "#AAAAAA");
        self.front.setAttribute('stroke', "#AAAAAA");
      });
      self.front.innerHTML = '<g><path d="M 0 5 h 10 v 10 h -10 v -10" fill="none"/><path d="M 4 0 h 10 l -4 4 h -10 l -4 4" stroke="none"/><path d="M 11 5 l 4 -4 v 10 l -4 4 v -10" stroke="none"/></g>';
      self.front.addEventListener('click', function(){
        self.frontview();
      });
      self.frontc = document.createElement("div");
      self.frontc.style.padding="2px"
      self.frontc.append(self.front)

      self.top = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.top.setAttribute('width', "16");
      self.top.setAttribute('height', "16");
      self.top.setAttribute('viewBox', "0 0 16 16");
      self.top.setAttribute('fill', "#AAAAAA");
      self.top.setAttribute('stroke', "#AAAAAA");
      self.top.addEventListener('mouseover', function(){
        self.top.setAttribute('fill', "#666666");
        self.top.setAttribute('stroke', "#666666");
      });
      self.top.addEventListener('mouseout', function(){
        self.top.setAttribute('fill', "#AAAAAA");
        self.top.setAttribute('stroke', "#AAAAAA");
      });
      self.top.innerHTML = '<g><path d="M 0 5 h 10 v 10 h -10 v -10" stroke="none"/><path d="M 4 0 h 10 l -4 4 h -10 l -4 4" fill="none"/><path d="M 11 5 l 4 -4 v 10 l -4 4 v -10" stroke="none"/></g>';
      self.top.addEventListener('click', function(){
        self.topview();
      });
      self.topc = document.createElement("div");
      self.topc.style.padding="2px"
      self.topc.append(self.top)

      self.right = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.right.setAttribute('width', "16");
      self.right.setAttribute('height', "16");
      self.right.setAttribute('viewBox', "0 0 16 16");
      self.right.setAttribute('fill', "#AAAAAA");
      self.right.setAttribute('stroke', "#AAAAAA");
      self.right.addEventListener('mouseover', function(){
        self.right.setAttribute('fill', "#666666");
        self.right.setAttribute('stroke', "#666666");
      });
      self.right.addEventListener('mouseout', function(){
        self.right.setAttribute('fill', "#AAAAAA");
        self.right.setAttribute('stroke', "#AAAAAA");
      });
      self.right.innerHTML = '<g><path d="M 0 5 h 10 v 10 h -10 v -10" stroke="none"/><path d="M 4 0 h 10 l -4 4 h -10 l -4 4" stroke="none"/><path d="M 11 5 l 4 -4 v 10 l -4 4 v -10" fill="none"/></g>';
      self.right.addEventListener('click', function(){
        self.rightview();
      });
      self.rightc = document.createElement("div");
      self.rightc.style.padding="2px"
      self.rightc.append(self.right)

      self.sti = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.sti.setAttribute('width', "16");
      self.sti.setAttribute('height', "16");
      self.sti.setAttribute('viewBox', "0 0 16 16");
      self.sti.setAttribute('fill', "#AAAAAA");
      self.sti.setAttribute('stroke', "#AAAAAA");
      self.sti.addEventListener('mouseover', function(){
        self.sti.setAttribute('fill', "#666666");
        self.sti.setAttribute('stroke', "#666666");
      });
      self.sti.addEventListener('mouseout', function(){
        self.sti.setAttribute('fill', "#AAAAAA");
        self.sti.setAttribute('stroke', "#AAAAAA");
      });
      self.sti.innerHTML = '<g><circle cx="4" cy="4" r="2"/><circle cx="10" cy="2" r="1"/><circle cx="10" cy="12" r="3"/><path d="M 5 5 l 3 4 M 6 3 l 3 -1" ></path></g>';
      self.sti.addEventListener('click', function(){
        self.stickball();
        self.updateModel()
      });
      self.stic = document.createElement("div");
      self.stic.style.padding="2px"
      self.stic.append(self.sti)


      self.too = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.too.setAttribute('width', "16");
      self.too.setAttribute('height', "16");
      self.too.setAttribute('viewBox', "0 0 16 16");
      self.too.setAttribute('fill', "#AAAAAA");
      self.too.setAttribute('stroke', "#AAAAAA");
      self.too.addEventListener('mouseover', function(){
        self.too.setAttribute('fill', "#666666");
        self.too.setAttribute('stroke', "#666666");
      });
      self.too.addEventListener('mouseout', function(){
        self.too.setAttribute('fill', "#AAAAAA");
        self.too.setAttribute('stroke', "#AAAAAA");
      });
      self.too.innerHTML = '<g><circle cx="4" cy="4" r="1"/><circle cx="10" cy="2" r="1"/><circle cx="10" cy="12" r="1"/><path d="M 4 5 l 5 6 M 5 3 l 4 -1" ></path></g>';
      self.too.addEventListener('click', function(){
        self.toon();
        self.updateModel()
      });
      self.tooc = document.createElement("div");
      self.tooc.style.padding="2px"
      self.tooc.append(self.too)

      self.lic = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.lic.setAttribute('width', "16");
      self.lic.setAttribute('height', "16");
      self.lic.setAttribute('viewBox', "0 0 16 16");
      self.lic.setAttribute('fill', "#AAAAAA");
      self.lic.setAttribute('stroke', "#AAAAAA");
      self.lic.addEventListener('mouseover', function(){
        self.lic.setAttribute('fill', "#666666");
        self.lic.setAttribute('stroke', "#666666");
      });
      self.lic.addEventListener('mouseout', function(){
        self.lic.setAttribute('fill', "#AAAAAA");
        self.lic.setAttribute('stroke', "#AAAAAA");
      });
      self.lic.innerHTML = '<g><circle cx="4" cy="4" r="2" fill="none"/><circle cx="10" cy="2" r="1" fill="none"/><circle cx="10" cy="12" r="3" fill="none"/><path d="M 5 5 l 3 4 M 6 3 l 3 -1" ></path></g>';
      self.lic.addEventListener('click', function(){
        self.licorice()
        self.updateModel();
      });
      self.licc = document.createElement("div");
      self.licc.style.padding="2px"
      self.licc.append(self.lic)

      self.fil = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      self.fil.setAttribute('width', "16");
      self.fil.setAttribute('height', "16");
      self.fil.setAttribute('viewBox', "0 0 16 16");
      self.fil.setAttribute('fill', "#AAAAAA");
      self.fil.setAttribute('stroke', "#AAAAAA");
      self.fil.addEventListener('mouseover', function(){
        self.fil.setAttribute('fill', "#666666");
        self.fil.setAttribute('stroke', "#666666");
      });
      self.fil.addEventListener('mouseout', function(){
        self.fil.setAttribute('fill', "#AAAAAA");
        self.fil.setAttribute('stroke', "#AAAAAA");
      });
      self.fil.innerHTML = '<g><circle cx="4" cy="4" r="2"/><circle cx="10" cy="2" r="1"/><circle cx="10" cy="12" r="3"/></g>';
      self.fil.addEventListener('click', function(){
        self.fill();
        self.updateModel();
      });
      self.filc = document.createElement("div");
      self.filc.style.padding="2px"
      self.filc.append(self.fil)


      self.container.append(self.canvas)

      self.topbar.append(self.infoc)

      self.topbar.append(self.stic)
      self.topbar.append(self.tooc)
      self.topbar.append(self.licc)
      self.topbar.append(self.filc)

      self.topbar.append(self.frontc)
      self.topbar.append(self.topc)
      self.topbar.append(self.rightc)

      self.topbar.append(self.palettec)
      self.topbar.append(self.camerac)

      self.topbar.append(self.autoscalec)

      self.el.append(self.topbar)
      self.el.append(self.container)
      self.el.style.width="100%"
      self.el.style.height="100%"

      speckInteractions({
        container : self.container,
        scrollZoom : true,
        getRotation : function (){return self.view.rotation},
        setRotation : function (t){self.view.rotation = t},
        getTranslation : function (){return self.view.translation},
        setTranslation : function ( t ){self.view.translation=t},
        getZoom : function (){return self.view.zoom},
        setZoom : function (t ){self.view.zoom=t},
        refreshView : function(){self.needReset=true;}
      })
    },

    saveSnapshot: function(){
      this.renderer.render(this.view);
      var imgURL = this.canvas.toDataURL("image/png");
      var a = document.createElement('a');
      a.href = imgURL;
      a.download = "speck.png";
      document.body.appendChild(a);
      a.click();
    },

    setAtomsColor:function (atoms){
      for (const atom in atoms){
        if (atom in this.view.elements){
          this.view.elements[atom].color = atoms[atom];
          this.needReset = true;
        }
      }
      if (this.needReset){
        speckSystem.calculateBonds(this.system, this.view);
        this.renderer.setSystem(this.system, this.view);
      }
    },

    setColorSchema:function( schema ){
      if (schema in speckColors){
        this.current_schema = schema;
        this.setAtomsColor(speckColors[schema]);
      }
    },

    switchColorSchema:function(){
      let update_color = false;
      let first_color = undefined;
      for (color in speckColors){
        if (first_color == undefined)
          first_color = color;
        if (update_color) {
          this.setColorSchema(color);
          return;
        }
        if (color == this.current_schema){
          update_color = true;
        }
      }
      this.setColorSchema(first_color);
    },

    stickball: function() {
        this.needReset = true;
        this.view.atomScale = 0.24;
        this.view.relativeAtomScale = 0.64;
        this.view.bondScale = 0.5;
        this.view.bonds = true;
        this.view.bondThreshold = 1.2;
        this.view.brightness = 0.5,
        this.view.outline = 0.0;
        this.view.spf = 32;
        this.view.bondShade = 0.5;
        this.view.atomShade = 0.5;
        this.view.dofStrength = 0.0;
        this.view.dofPosition = 0.5;
        this.view.ao = 0.75;
        this.view.spf = 32;
        this.view.outline = 0;
    },

    toon: function() {
        this.stickball()
        this.view.atomScale = 0.1;
        this.view.relativeAtomScale = 0;
        this.view.bondScale = 1;
        this.view.bonds = true;
        this.view.bondThreshold=  1.2;
    },

    fill: function() {
        this.stickball()
        this.view.atomScale = 0.6;
        this.view.relativeAtomScale = 1.0;
        this.view.bonds = false;
    },

    licorice:  function() {
        this.stickball()
        this.view.ao = 0;
        this.view.spf = 0;
        this.view.outline = 1;
        this.view.bonds = true;
    },

    updateModel:  function() {
      this.model.set('bonds', this.view.bonds);
      this.model.set('atomScale', this.view.atomScale);
      this.model.set('relativeAtomScale', this.view.relativeAtomScale);
      this.model.set('bondScale', this.view.bondScale);
      this.model.set('brightness', this.view.brightness);
      this.model.set('outline', this.view.outline);
      this.model.set('spf', this.view.spf);
      this.model.set('bondShade', this.view.bondShade);
      this.model.set('atomShade', this.view.atomShade);
      this.model.set('dofStrength', this.view.dofStrength);
      this.model.set('dofPosition', this.view.dofPosition);
      this.model.save_changes();
    },
    loadStructure: function() {
        let self = this;
        self.system = undefined;
        var data = self.xyz(self.model.get('data'))[0]
        if (data){
          self.system = speckSystem.new();
          for (var i = 0; i < data.length; i++) {
              var a = data[i];
              var x = a.position[0];
              var y = a.position[1];
              var z = a.position[2];
              speckSystem.addAtom(self.system, a.symbol, x,y,z);
          }
          self.center();
        }
    },

    center: function(){
      let self = this;
      if (self.system){
        speckSystem.center(self.system);
        speckSystem.calculateBonds(self.system, self.view);
        this.renderer.setSystem(self.system, self.view);
        speckView.center(self.view, self.system);
        self.needReset = true;
      }
    },

    topview: function(){
      let self = this;
      if (self.system){
        speckView.rotateX(self.view, Math.PI/2);
        self.center();
      }
    },

    frontview: function(){
      let self = this;
      if (self.system){
        speckView.rotateX(self.view, 0);
        self.center();
      }
    },

    rightview: function(){
      let self = this;
      if (self.system){
        speckView.rotateY(self.view, -Math.PI/2);
        self.center();
      }
    },

    xyz: function(data) {
      var lines = data.split('\n');
      var natoms = parseInt(lines[0]);
      var nframes = Math.floor(lines.length/(natoms+2));
      var trajectory = []
      for(var i = 0; i < nframes; i++) {
          var atoms = [];
          for(var j = 0; j < natoms; j++) {
              var line = lines[i*(natoms+2)+j+2].split(/\s+/);
              var atom = {};
              var k = 0;
              while (line[k] == "") k++;
              atom.symbol = line[k++];
              atom.position = [parseFloat(line[k++]), parseFloat(line[k++]), parseFloat(line[k++])];
              atoms.push(atom);
          }
          trajectory.push(atoms);
      }
      return trajectory;
    },

    reflow: function() {
      let self = this;
      var ww = self.container.parentElement.clientWidth;
      var wh = self.container.parentElement.clientHeight;
      if (ww == 0)
        ww = self.view.resolution.x;
      if (wh == 0)
        wh = self.view.resolution.y;
      if (self.view.resolution.x == ww && self.view.resolution.y == wh)
        return;
      self.container.style.height = wh + "px";
      self.container.style.width = ww + "px";
      self.container.style.left = 0 + "px";
      self.container.style.top = 0 + "px";
      self.view.resolution.x=ww;
      self.view.resolution.y=wh;
      self.renderer = new speckRenderer(self.canvas, self.view.resolution, self.view.aoRes);
    },

    loop: function() {
       let self = this;
       if (self.needReset) {
            self.renderer.reset();
            self.needReset = false;
        }
        self.renderer.render(self.view);
        requestAnimationFrame(function(){self.loop()});
    },

    handleCustomMessage: function(message) {
      if ("do" in message){
        if (message.do == "frontView"){
          this.frontview();
        } else if (message.do == "topView"){
            this.topview();
        } else if (message.do == "rightView"){
            this.rightview();
        } else if (message.do == "changeAtomsColor"){
            this.setAtomsColor(message.atoms);
        } else if (message.do == "changeColorSchema"){
            this.setColorSchema(message.schema)
        } else if (message.do == "switchColorSchema"){
            this.switchColorSchema();
        }
      }
    },

    render: function() {
        let self = this;
        this.model.on('change:data', this.loadStructure, this);
        this.model.on('change:bonds', function(){this.view.bonds = this.model.get('bonds');this.needReset = true;}, this);
        this.model.on('change:atomScale', function(){this.view.atomScale = this.model.get('atomScale');this.needReset = true;}, this);
        this.model.on('change:relativeAtomScale', function(){this.view.relativeAtomScale = this.model.get('relativeAtomScale');this.needReset = true;}, this);
        this.model.on('change:bondScale', function(){this.view.bondScale = this.model.get('bondScale');this.needReset = true;}, this);
        this.model.on('change:brightness', function(){this.view.brightness = this.model.get('brightness');this.needReset = true;}, this);
        this.model.on('change:outline', function(){this.view.outline = this.model.get('outline');this.needReset = true;}, this);
        this.model.on('change:spf', function(){this.view.spf = this.model.get('spf');this.needReset = true;}, this);
        this.model.on('change:bondThreshold', function(){this.view.bondThreshold = this.model.get('bondThreshold');this.loadStructure();}, this);
        this.model.on('change:bondShade', function(){this.view.bondShade = this.model.get('bondShade');this.needReset = true;}, this);
        this.model.on('change:atomShade', function(){this.view.atomShade = this.model.get('atomShade');this.needReset = true;}, this);
        this.model.on('change:dofStrength', function(){this.view.dofStrength = this.model.get('dofStrength');this.needReset = true;}, this);
        this.model.on('change:dofPosition', function(){this.view.dofPosition = this.model.get('dofPosition');this.needReset = true;}, this);
        this.model.on('msg:custom', this.handleCustomMessage, this);
    },

    /**
      * Respond to lumino/phosphor events (supports both ipywidgets 7 and 8+)
      */
     processPhosphorMessage: function (msg) {
       SpeckView.__super__.processPhosphorMessage.apply(this, arguments);
       this._handleMessage(msg);
     },

     processLuminoMessage: function (msg) {
       SpeckView.__super__.processLuminoMessage.apply(this, arguments);
       this._handleMessage(msg);
     },

     _handleMessage: function (msg) {
       let self = this;
       switch (msg.type) {
         case "before-attach":
           window.addEventListener("resize", function () {
              self.reflow();
              self.loadStructure();
           });
           break;
           case "after-attach":
             // Rendering actual figure in the after-attach event allows
             // Plotly.js to size the figure to fill the available element
             self.reflow()
             self.loop();
             self.loadStructure();
             break;
           case "resize":
             self.reflow();
             self.center();
             break;
       }
     },
});


module.exports = {
    SpeckModel: SpeckModel,
    SpeckView: SpeckView
};
