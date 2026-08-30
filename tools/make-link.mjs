#!/usr/bin/env node
// Builds the one click URLs for Overpass Ultra, and optionally rewrites the
// links already sitting in README.md.
//
//   npm install
//   node tools/make-link.mjs                     print both URLs
//   node tools/make-link.mjs --write             also patch README.md
//   node tools/make-link.mjs 12.5 47.8 12.1      different start view
//
// The whole .ultra document travels inside the URL fragment. Fragments are
// never sent to a server, so the only limit is the browser.
//
// The links are written INLINE, not as Markdown reference definitions. GitHub
// renders with cmark-gfm, which stops expanding reference links once about
// 85 000 characters of destinations have been produced for one document. With
// a 28 000 character URL that is three uses, and every further one is left as
// literal text. Inline links have no such budget. Measured, not assumed.

import fs from 'node:fs';
import path from 'node:path';
import lz from 'lz-string';

const args = process.argv.slice(2);
const write = args.includes('--write');
const [zoom = '11.00', lat = '56.0000', lon = '8.2000'] = args.filter(a => a !== '--write');

const wurzel = path.join(import.meta.dirname, '..');
const doc = fs.readFileSync(path.join(wurzel, 'campsite-scoring.ultra'), 'utf8');
const q = lz.compressToEncodedURIComponent(doc);

if (lz.decompressFromEncodedURIComponent(q) !== doc) {
  console.error('round trip failed, aborting');
  process.exit(1);
}

const m = `m=${zoom}/${lat}/${lon}`;
const karte  = `https://overpass-ultra.us/#run&map&${m}&q=${q}`;
const editor = `https://overpass-ultra.us/#run&${m}&q=${q}`;

console.error(`document ${doc.length} chars, compressed ${q.length} chars`);

if (!write) {
  console.log('map only :', karte);
  console.log();
  console.log('editor   :', editor);
  console.log();
  console.error('pass --write to patch README.md in place');
  process.exit(0);
}

const readmePfad = path.join(wurzel, 'README.md');
let readme = fs.readFileSync(readmePfad, 'utf8');
let nKarte = 0, nEditor = 0;
readme = readme.replace(/https:\/\/overpass-ultra\.us\/#run(&map)?&m=[^)\s]+/g, (treffer, mapModus) => {
  if (mapModus) { nKarte++; return karte; }
  nEditor++; return editor;
});
fs.writeFileSync(readmePfad, readme);
console.error(`README.md patched: ${nKarte} map links, ${nEditor} editor links`);

if (nKarte + nEditor === 0) {
  console.error('warning: no links found, did the README change?');
  process.exit(1);
}
