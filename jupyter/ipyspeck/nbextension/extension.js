// Entry point loaded by the classic Notebook (see ipyspeck.json). It maps the
// "ipyspeck" module name used by the widget models to the bundled index.js.
define(function() {
    "use strict";

    window['requirejs'].config({
        map: {
            '*': {
                'ipyspeck': 'nbextensions/ipyspeck/index',
            },
        }
    });

    // Export the required load_ipython_extension function
    return {
        load_ipython_extension : function() {}
    };
});
