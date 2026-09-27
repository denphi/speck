// jsdom lacks DragEvent, which Lumino references when it loads.
if (typeof window.DragEvent === 'undefined') {
  window.DragEvent = class DragEvent extends window.MouseEvent {};
}
