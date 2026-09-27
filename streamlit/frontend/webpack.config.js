const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'stspeck', 'static');

// Streamlit serves component files with "Cache-Control: public" (no expiry),
// so browsers may keep an old bundle after an upgrade. The bundle name carries
// a content hash and index.html (served no-cache) is written to point at it.
class WriteIndexHtml {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('WriteIndexHtml', (compilation) => {
      const bundle = Object.keys(compilation.assets).find((name) => /^stspeck\..*\.js$/.test(name));
      const template = fs.readFileSync(path.resolve(__dirname, 'public', 'index.html'), 'utf8');
      fs.writeFileSync(path.join(outDir, 'index.html'), template.replace('stspeck.js', bundle));
    });
  }
}

// Bundles the Streamlit component, including the Speck viewer and renderer
// shared with ipyspeck (../../core, built into ../../core/lib), into
// ../stspeck/static.
module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'stspeck.[contenthash:10].js',
    path: outDir,
    clean: true,
  },
  module: {
    rules: [
      { test: /\.ts$/, loader: 'ts-loader', options: { configFile: path.resolve(__dirname, 'tsconfig.json') } },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    // Shared sources live outside this folder; resolve their packages here.
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
  plugins: [new WriteIndexHtml()],
  performance: { hints: false },
};
