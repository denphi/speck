const fs = require('fs');
const path = require('path');

// Builds the GitHub Pages site into ../docs: the shared Speck viewer as a
// content-hashed bundle (window.Speck), plus the pages in public/, whose
// "speck.js" references are rewritten to the hashed file name.
const outDir = path.resolve(__dirname, '..', 'docs');

class WritePages {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('WritePages', (compilation) => {
      const bundle = Object.keys(compilation.assets).find((name) => /^speck\..*\.js$/.test(name));
      const pub = path.resolve(__dirname, 'public');
      const copy = (from, to) => {
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
          const src = path.join(from, entry.name), dst = path.join(to, entry.name);
          if (entry.isDirectory()) {
            fs.mkdirSync(dst, { recursive: true });
            copy(src, dst);
          } else if (entry.name.endsWith('.html')) {
            fs.writeFileSync(dst, fs.readFileSync(src, 'utf8').replace(/src="speck\.js"/g, `src="${bundle}"`));
          } else {
            fs.copyFileSync(src, dst);
          }
        }
      };
      copy(pub, outDir);
      // Serve files as-is (no Jekyll processing on GitHub Pages).
      fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    });
  }
}

module.exports = {
  entry: './src/speck.ts',
  output: { filename: 'speck.[contenthash:10].js', path: outDir, clean: true },
  module: {
    rules: [
      { test: /\.ts$/, loader: 'ts-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: { extensions: ['.ts', '.js'], modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'] },
  plugins: [new WritePages()],
  performance: { hints: false },
};
