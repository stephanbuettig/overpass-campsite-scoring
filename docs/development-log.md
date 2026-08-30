# Development log

[← back to the README](../README.md)

This is the document to read if you want to build on this map rather than just use it. It records how the concept changed, every bug that was found and how, the assumptions that measurement overturned, and the harness that was built to keep the whole thing honest.

Most of the traps below are not specific to this project. Anyone writing an Overpass Ultra map will walk into several of them.

---

## How the concept changed

### v1 — hard criteria

The first version asked yes-or-no questions. Is there a toilet within 50 m, a shop within 500 m, a playground within 300 m? Matching places got a large tent icon, everything else a small dot.

It worked, and it was wrong in a way that only becomes obvious in use. A filter is a cliff. A place with a supermarket at 210 m looked identical to a place with nothing at all, and a place with three bakeries looked identical to a place with one kiosk. The threshold numbers were also pure invention; nobody had measured whether 500 m was the right number for anything.

### v2 — a weighted score

Replace the cliff with a slope. Points per category, weighted by distance ring, summed to a score, and the score drives the marker size. Nothing is filtered away.

This is the concept that survived. What did not survive was the first calibration: the maximum was 69, on-site sanitary tags could saturate the most important category on their own, and the display still showed a tent for high scorers, which fought with the dot.

### v3 — calibrated against real data

Eight regions were fetched live, 1084 places and 10 696 points of interest, and the scoring was measured rather than assumed. That surfaced the on-site tagging problem, produced the rescale to 100, and drove the display apart into two clean zoom stages.

---

## Bugs

Twelve, in the order they were found. Each one cost real time, and each one has a symptom that does not look like its cause.

### 1. `TypeError: Failed to fetch`, which was actually HTTP 414

**Symptom.** The map sometimes refused to load. The console said `TypeError: Failed to fetch`, which normally means a network problem.

**Cause.** The query had grown to 13 917 URL-encoded characters because the documentation was written as comment blocks inside the OverpassQL body. Overpass answered `HTTP 414 Request-URI Too Large`. That error page carries no CORS headers, so the browser rejected the response before the status was ever visible to the application.

**Fix.** All documentation moved into the YAML header, which is not part of the request. 13 917 → 1536 characters.

**Lesson.** A `Failed to fetch` from Overpass is worth measuring before it is worth debugging.

### 2. The tent icon silently deleted nearby POI

**Symptom.** A playground 25 m from a campsite was simply not drawn. The data was there.

**Cause.** MapLibre assigns symbol placement from the topmost layer downwards. The camp icon claimed the space and every icon underneath it was suppressed.

**Fix.** `icon-ignore-placement: true` on every symbol layer. Found by rendering the case headless and comparing, not by reading code.

### 3. A campsite drawn as an orange playground

**Symptom.** A boat service called *Bootsservice Rick & Rick* appeared as an orange playground label, then switched to a campsite icon at higher zoom.

**Cause.** A campsite that also carries `leisure=playground` matched the POI query as well as the camps query and was emitted twice.

**Fix.** `(.p0; - .camps;)->.poi;` in the query, plus guards in the style during the interim.

### 4. `InvalidCharacterError` from `btoa`

**Symptom.** `Failed to execute 'btoa' on 'WorkerGlobalScope': The string to be encoded contains characters outside of the Latin1 range.`

**Cause.** Exactly twelve `─` box drawing characters in one comment line of the transform. Ultra builds a JavaScript module out of that block inside a worker and encodes it with `btoa`, which is Latin-1 only.

**Fix.** The transform is strictly ASCII, and a check enforces it.

### 5. The fix for bug 4 cut the file in half

**Symptom.** After replacing `──────` with `------`, the parsed document had lost its `style` key entirely.

**Cause.** `---` is the YAML front matter delimiter. The replacement produced that sequence inside the transform, and a naive split returned 16 479 of 28 933 characters.

**Fix.** `=` as the separator character, plus a check that no `-{3,}` sequence exists anywhere in the transform.

### 6. A campsite drawn as two dozen circles

**Symptom.** Nymindegab Familie Camping rendered as a ring of small circles following its outline.

**Cause.** A MapLibre `circle` layer draws one circle **per vertex** of a polygon.

**Fix.** A `symbol` layer with `maki:circle`, which places one symbol at the polygon's centroid.

### 7. The whole map went blank in one region

**Symptom.** No error visible in the interface. Nothing drawn.

**Cause.** *Campingplatz Zum Hexenwäldchen* near the Müritz is mapped as a multipolygon relation. osm2geojson turns that into a `GeometryCollection`, which has no `coordinates` property. The transform threw a `TypeError`, and a transform that throws produces no data at all.

**Fix.** Multipolygon relations are flattened to `MultiPolygon` before anything else runs. One object in 1084 was enough to kill every map that contained it.

**Lesson.** Handle `GeometryCollection` in any Ultra transform. It will appear eventually, and the failure mode is a blank map rather than an error.

### 8. Empty coloured discs among the POI

**Symptom.** Some POI rendered as a plain brown or purple disc with no glyph.

**Cause.** The `convert` statements read the wrong key for two values. `shop=laundry` was read with `t["amenity"]` and `amenity=marketplace` with `t["shop"]`, so both produced an empty value and fell back to a blank circle. 90 objects in the test regions.

**Fix.** Separate `convert` statements for those two.

### 9. `.poi["amenity"~...]` is not valid

**Symptom.** Overpass answered with a parse error.

**Cause.** Filtering a named set requires an element type prefix.

**Fix.** `nwr.poi["amenity"~...]`.

### 10. Dot and tent fighting each other

**Symptom.** At medium zoom the star badge, the dot, the digit and the tent all sat on the same spot.

**Cause.** The layers had independent `minzoom` values and no coordinated switch.

**Fix.** Overview layers with `maxzoom: 12.8`, detail layers with `minzoom: 12.3`, and an opacity cross fade in between. They now never appear together at full strength.

### 11. Blue drawn underneath grey

**Symptom.** A deluxe campsite disappeared behind an unrated one.

**Cause.** The sort key was set in the wrong direction, from an assumption about how `symbol-sort-key` works.

**Fix.** Two overlapping markers with known ranks were rendered headless and inspected. Result: **the larger sort key is drawn on top** for icons, while the **smaller** one wins placement for labels. Two separate properties, `zk` and `sk`.

### 12. Model hallucinations, caught before implementation

Several tag values suggested during research do not exist: `leisure=minigolf`, `leisure=arcade`, `amenity=convenience_store`, `amenity=swimming_pool`, `shop=hypermarket`, `shop=delicatessen`. Each was checked against taginfo before it went in, and none of them survived.

`amenity=dishwashing` is the sad one. A dishwashing station is genuinely useful when camping, the key has five uses worldwide, and there is simply no way to score it.

---

## Assumptions that measurement overturned

### A union of exact values beats a regex. Sometimes.

For the 51 POI values across four keys, one key-and-value regex is far faster than separate queries: 5.5 s against 12.0 s. For the two `tourism` values it is the other way round: a union of exact values is 2.9 s against 3.8 s for the regex.

The rule that emerged: exact values hit the tag index, a regex does not. With few values the index wins. With many values, running `around` once beats running it several times, and that dominates.

### The browser must be the slow part. It is not.

The whole client side, `JSON.parse` plus GeoJSON conversion plus the entire scoring pass over 2830 objects, takes **90 ms**. Every second of perceived load time comes from Overpass.

The scoring itself was optimised from 428 ms to 23 ms with a grid index early on, verified bit-identical against the naive implementation. In hindsight that was 400 ms out of a twelve second wall clock.

### A smaller search radius must be faster. It is not.

600 m and 1000 m take exactly the same time. Overpass's proximity filter costs by the number of coarse tiles the probe points touch, not by the area searched. There is no reason to be stingy with the radius.

### The highest weighted category measured the wrong thing.

Sanitary carries 45 of the 100 points. Places tag their own facilities with `toilets=yes`, `shower=yes` and so on, and originally each of those filled a scoring slot, so three tags saturated the category.

Measured over 1084 places: 17 % saturated it purely from their own tags, and 63 % carried no sanitary tag at all. The most important category was largely measuring tagging diligence. Correlation with the on-site tag count was r = 0.54.

Restricting on-site tags to a single slot brought that to r = 0.41 and raised the interquartile spread from 35 to 38 points.

### More elegant scoring is not better scoring.

Smooth distance decay `1 / (1 + (d/d₀)²)` and geometric diminishing returns were both implemented and measured against the ring model on all eight regions. Neither improved either metric. Rings stayed, because they are equally good and can be explained in one sentence.

### Ten times faster was not on the table.

The target was a tenfold reduction in load time. What the measurements showed:

- a query returning nine objects costs 1.3 s on a public instance
- the browser contributes 90 ms
- one third of the wall clock is transferring uncompressed pretty printed JSON

The achievable gain was 1.18× to 1.32×, and it was taken. Getting further means a private instance or a prepared extract, which is a different project. Saying so with numbers was more useful than delivering a smaller number that was not true.

---

## The verification harness

None of the measurements above are estimates. The following ran in a container alongside the work.

| Tool | Checks |
|---|---|
| `@maplibre/maplibre-gl-style-spec` | every style expression validates, zero errors across eleven layers |
| `featureFilter` over real data | which feature reaches which layer, catches overlap bugs |
| `js-yaml` | the front matter parses and keeps every key |
| ASCII and `-{3,}` scan | the two ways the transform can silently destroy the file |
| Headless Chromium worker | `btoa` plus data-URL module import plus execution, exactly as Ultra does it |
| Playwright + MapLibre 6.6 with Ultra's real sprite sheets | the map as it actually renders, at any zoom |
| LiquidJS + DOMPurify with Ultra's configuration | the info card after sanitising, not before |
| Live Overpass, eight regions | scoring distributions, timings, before-and-after equality |

The rendering harness matters most. Three bugs in this log — the suppressed POI, the polygon circles and the sort direction — were invisible in the code and obvious in a screenshot.

### Proving a change is safe

Before the query rewrite shipped, the old and new versions were run against the same regions **in the same minute**, so OSM edits could not confuse the comparison.

Result over three regions: 354 places, identical count everywhere, identical score for 347 of them. The seven differences were traced to a single deliberate rule change, at most 4 points out of 100. Ten POI disappeared, all of them zoos and theme parks more than 1000 m from any campsite, none of which had ever contributed to a score.

That is the standard worth holding a change to: not "it still looks right", but "here is what changed, here is exactly why, and here is the number".

---

## What is not done

- **Filters.** The score is one number. Someone travelling with a dog, or in a 9 m motorhome, or in winter, wants to weight differently. The weights are one editable block, but there is no interface for it.
- **`caravans=no` is shown, not enforced.** 14 160 objects in OSM say caravans are not allowed. The info card shows a red chip. It does not remove the place from the map.
- **Opening season.** `seasonal` and `opening_hours` are read but not scored. A site closed from October to April scores the same in January as in July.
- **The 1000 m ceiling.** Fine for a town, arbitrary for cycling. Rings and radius are editable, but nothing adapts automatically.
- **No offline mode.** Every pan is a fresh query. A prepared extract would fix both this and the load time.

---

[← tuning](tuning.md) · [back to the README](../README.md)
