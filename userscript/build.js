import * as esbuild from 'esbuild';

const banner = `// ==UserScript==
// @name         Gemini Watermark Remover
// @namespace    https://github.com/journey-ad
// @version      1.0.0
// @description  Automatically removes watermarks from Gemini AI generated images
// @author       journey-ad
// @match        https://gemini.google.com/app/*
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==
`;

await esbuild.build({
  entryPoints: ['index.js'],
  bundle: true,
  outfile: 'dist/gemini-watermark-remover.user.js',
  format: 'iife',
  banner: { js: banner },
  loader: {
    '.png': 'dataurl'
  }
});

console.log('✓ Build complete: gemini-watermark-remover.user.js');
