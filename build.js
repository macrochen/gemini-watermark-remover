import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const userscriptBanner = `// ==UserScript==
// @name         Gemini NanoBanana Watermark Remover
// @name:zh-CN   Gemini NanoBanana 图片水印移除
// @namespace    https://github.com/journey-ad
// @version      0.1.3
// @description  Automatically removes watermarks from Gemini AI generated images
// @description:zh-CN 自动移除 Gemini AI 生成图像中的水印
// @icon         https://www.google.com/s2/favicons?domain=gemini.google.com
// @author       journey-ad
// @license      MIT
// @match        https://gemini.google.com/app
// @match        https://gemini.google.com/app/*
// @match        https://gemini.google.com/u/*/app
// @match        https://gemini.google.com/u/*/app/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==
`;

async function buildHtml() {
  console.log('Building: dist/index.html');
  try {
    const templatePath = 'src/templates/layout.html';
    let html = await readFile(templatePath, 'utf-8');

    // Simple regex to find includes: <!-- INCLUDE: filename.html -->
    const includePattern = /<!--\s*INCLUDE:\s*([a-zA-Z0-9_.-]+)\s*-->/g;
    
    // Process includes asynchronously
    const replacements = [];
    let match;
    while ((match = includePattern.exec(html)) !== null) {
      replacements.push({
        placeholder: match[0],
        filename: match[1]
      });
    }

    for (const item of replacements) {
      const partialPath = join('src/templates/partials', item.filename);
      try {
        const content = await readFile(partialPath, 'utf-8');
        html = html.replace(item.placeholder, content);
      } catch (err) {
        console.warn(`Warning: Partial ${item.filename} not found.`);
      }
    }

    await writeFile('dist/index.html', html);
  } catch (err) {
    console.error('HTML Build Failed:', err);
  }
}

async function build() {
  console.log(`Start Build... ${process.env.NODE_ENV === 'production' ? 'production' : 'development'}\r\n`);

  // Build website - app.js
  console.log('Building: dist/app.js');
  await esbuild.build({
    entryPoints: ['src/app.js'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/app.js',
    loader: { '.png': 'dataurl' },
    publicPath: '/',
    minify: process.env.NODE_ENV === 'production'
  });

  // Build website - i18n.js
  console.log('Building: dist/i18n.js');
  await esbuild.build({
    entryPoints: ['src/i18n.js'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/i18n.js',
    minify: process.env.NODE_ENV === 'production'
  });

  // Build userscript
  console.log('Building: dist/userscript/gemini-watermark-remover.user.js');
  await mkdir('dist/userscript', { recursive: true });
  await esbuild.build({
    entryPoints: ['src/userscript/index.js'],
    bundle: true,
    format: 'iife',
    outfile: 'dist/userscript/gemini-watermark-remover.user.js',
    banner: { js: userscriptBanner },
    loader: { '.png': 'dataurl' },
    minify: false
  });

  // Copy static files
  console.log('Copying: src/i18n -> dist/i18n');
  await cp('src/i18n', 'dist/i18n', { recursive: true });
  console.log('Copying: public -> dist');
  await cp('public', 'dist', { recursive: true }); 
  
  // Copy CSS
  console.log('Copying: src/assets/styles.css -> dist/styles.css');
  await cp('src/assets/styles.css', 'dist/styles.css');

  // Build HTML (After copy, to ensure index.html from template overwrites public/index.html)
  await buildHtml();

  console.log('\r\n✓ Build complete');
}

build().catch(console.error);
