// TypeScript unit tests for the widget model (src/__tests__). Rendering is
// covered by browser end-to-end tests, since jsdom has no WebGL.
module.exports = {
  testEnvironment: 'jsdom',
  testRegex: 'src/__tests__/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true, strict: false, types: ['jest', 'node'] } }],
    '^.+\\.js$': 'babel-jest',
  },
  // Jupyter and Lumino packages ship ES modules; let Babel transform them.
  transformIgnorePatterns: ['/node_modules/(?!(@jupyter-widgets|@jupyterlab|@lumino|@jupyter|lib0|yjs|y-protocols)/)'],
  setupFiles: ['<rootDir>/src/__tests__/setup.js'],
  moduleNameMapper: { '\\.css$': 'identity-obj-proxy' },
  // lib/ holds compiled output; core/lib is the shared viewer.
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
};
