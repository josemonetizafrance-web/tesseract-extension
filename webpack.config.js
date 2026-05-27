const path = require('path');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');

const SRC = path.resolve(__dirname, 'src');
const DIST = path.resolve(__dirname, 'dist');

module.exports = (env, argv) => {
  const dev = argv.mode !== 'production';
  return {
    target: 'web',
    entry: {
      'background/background': './src/background/background.js',
      'pages/popup/popup': './src/pages/popup/popup.js',
      'pages/dashboard/dashboard': './src/pages/dashboard/dashboard.js',
      'pages/admin/admin': './src/pages/admin/admin.js',
      'pages/login/login': './src/pages/login/login.js',
    },
    output: {
      path: DIST,
      filename: '[name].js',
      iife: false,
      clean: true,
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          // Content scripts: copy as-is (they share globals via window)
          { from: 'src/content', to: 'content', filter: f => !f.endsWith('.ps1') },
          // Modules: copy as-is
          { from: 'src/modules', to: 'modules' },
          // HTML/CSS assets for pages (JS is bundled separately)
          { from: 'src/pages', to: 'pages', filter: f => !f.endsWith('.js') },
          // Images and other assets
          { from: 'assets', to: 'assets' },
        ],
      }),
    ],
    optimization: {
      minimize: false,
    },
    devtool: dev ? 'source-map' : false,
    stats: {
      entrypoints: false,
      modules: false,
    },
  };
};
