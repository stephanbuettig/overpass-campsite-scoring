#!/usr/bin/env node
// Structural checks for campsite-scoring.ultra.
//
//   npm install js-yaml @maplibre/maplibre-gl-style-spec osm2geojson-ultra
//   node tools/verify.mjs [path/to/some-overpass-response.json ...]
//
// Without arguments it runs the checks that need no data. Pass raw Overpass
// JSON responses to also exercise the transform against real features.

import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import * as spec from '@maplibre/maplibre-gl-style-spec';
const file = path.join(import.meta.dirname, '..', 'campsite-scoring.ultra');
const raw = fs.readFileSync(file, 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if(!m){ console.log('FAIL: front matter not recognised'); process.exit(1); }
const [_, head, ql] = m;
const doc = yaml.load(head);
console.log('YAML keys:', Object.keys(doc).join(', '));
const t = doc.transform, st = doc.style, pt = doc.popupTemplate;
console.log('transform %d chars, popupTemplate %d, layers %d', t.length, pt.length, st.layers.length);

// 1. Latin1 fuer btoa
const bad = [...t].filter(c=>c.charCodeAt(0)>255);
console.log('1. btoa      chars beyond Latin-1 in transform:', bad.length, bad.length?JSON.stringify(bad.slice(0,5)):'ok');
// 2. keine --- Folge
console.log('2. delimiter runs of 3+ hyphens in transform:', (t.match(/-{3,}/g)||[]).length);
// 3. Style
const full={version:8, sources:{ultra:{type:'geojson',data:{type:'FeatureCollection',features:[]}}},
 glyphs:'x/{fontstack}/{range}.pbf', sprite:'y', layers:st.layers.map(l=>({...l,source:'ultra'}))};
const errs = spec.validateStyleMin(full);
console.log('3. style     errors:', errs.length); errs.forEach(e=>console.log('     ', e.message));
// 4. Abfragelaenge
console.log('4. query     %d chars raw, %d URL encoded (GET limit is around 8000)', ql.trim().length, encodeURIComponent(ql.trim()).length);
// 5. Transform ausfuehrbar, genau wie Ultra es laedt
const b64 = Buffer.from(t,'latin1').toString('base64');
const mod = await import('data:text/javascript;base64,'+b64);
console.log('5. module    default export is a function:', typeof mod.default === 'function');
// 6. Against real data, if any Overpass JSON responses were given
const dateien = process.argv.slice(2);
if (dateien.length === 0) {
  console.log('6. data      no files given, skipping');
} else {
  const o2g = (await import('osm2geojson-ultra'));
  const conv = o2g.default || o2g;
  let features = 0, camps = 0, ohneIcon = 0, fehlend = 0;
  for (const f of dateien) {
    const gj = conv(JSON.parse(fs.readFileSync(f, 'utf8')));
    const out = mod.default(gj);
    const c = out.features.filter(x => x.properties && x.properties.score != null);
    features += out.features.length;
    camps += c.length;
    ohneIcon += out.features.filter(x => x.properties && x.properties.c && !x.properties.ic).length;
    fehlend += c.filter(x => !(x.properties.col && x.properties.zk != null && x.properties.nav_lat != null)).length;
  }
  console.log('6. data      %d features, %d places, POI without icon %d, places missing a field %d',
    features, camps, ohneIcon, fehlend);

  // 7. Which feature reaches which layer
  const gj = conv(JSON.parse(fs.readFileSync(dateien[0], 'utf8')));
  mod.default(gj);
  console.log('7. layers    feature counts for %s', dateien[0]);
  for (const l of st.layers) {
    if (!l.filter) { console.log('     %s (no filter)', l.id.padEnd(14)); continue; }
    const fil = spec.featureFilter(l.filter, 'layers[0].filter');
    const n = gj.features.filter(x => fil.filter({zoom:14}, {
      type: x.geometry.type === 'Point' ? 1 : (x.geometry.type.includes('Polygon') ? 3 : 2),
      properties: x.properties
    })).length;
    console.log('     %s %d', l.id.padEnd(14), n);
  }
}
