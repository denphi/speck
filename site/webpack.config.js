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
      for (const file of fs.readdirSync(pub)) {
        let text = fs.readFileSync(path.join(pub, file), 'utf8');
        if (file.endsWith('.html')) text = text.replace(/src="speck\.js"/g, `src="${bundle}"`);
        fs.writeFileSync(path.join(outDir, file), text);
      }
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
