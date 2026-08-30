#!/usr/bin/env node
// Rebuilds the one click URL for Overpass Ultra.
//
//   npm install lz-string
//   node tools/make-link.mjs [zoom] [lat] [lon]
//
// The whole .ultra document travels inside the URL fragment. Fragments are
// never sent to a server, so the only limit is the browser, and browsers
// handle far more than the ~28 kB this produces.

import fs from 'node:fs';
import path from 'node:path';
import lz from 'lz-string';

const [, , zoom = '11.00', lat = '56.0000', lon = '8.2000'] = process.argv;
const file = path.join(import.meta.dirname, '..', 'campsite-scoring.ultra');
const doc = fs.readFileSync(file, 'utf8');
const q = lz.compressToEncodedURIComponent(doc);

if (lz.decompressFromEncodedURIComponent(q) !== doc) {
  console.error('round trip failed, aborting');
  process.exit(1);
}

const base = 'https://overpass-ultra.us/#';
const m = `m=${zoom}/${lat}/${lon}`;

console.log('map only :', `${base}run&map&${m}&q=${q}`);
console.log();
console.log('editor   :', `${base}run&${m}&q=${q}`);
console.log();
console.error(`document ${doc.length} chars, compressed ${q.length} chars`);
