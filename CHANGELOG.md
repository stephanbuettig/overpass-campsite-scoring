# Changelog

All notable changes to this project.

## v3 — 2026-08-30

The version in this repository.

### Added
- Info card in German, English, French, Spanish and Italian, following the browser, with a one line override. Costs 8118 characters in the file and a two letter property per feature.
- Points of interest render as their own Maki and Temaki icons on white discs instead of coloured dots. 51 values mapped, all verified against the sprite manifests.
- Invisible hit area layer, enlarging the hover target by about 10 px. Small dots were hard to hit.
- Navigation link on every object. The transform computes a point that is guaranteed to lie inside the geometry, so a Google Maps link works even where OSM has no address.
- Info card: type icon in the title, icons on every field, singular and plural for star ratings, warning chips for `caravans=no`, `tents=no`, `dog=no` and `access=private`.
- Drawing order by quality class. Blue above green above purple above orange above red above grey.

### Changed
- Scoring rescaled from a maximum of 69 to 100. Rank correlation with the old weights: Spearman ρ = 0.999.
- On-site sanitary tags now fill one scoring slot instead of three. Correlation with tagging diligence dropped from r = 0.54 to r = 0.41, spread rose from 35 to 38 points.
- Zoom staging split cleanly. Dot and star up to 12.3, tent and POI from 12.7, cross fade between. They no longer appear together.
- Query rewritten: `tourism` as a value union, attractions folded into the main proximity pass, five `convert` statements without the category tag. 1.18× to 1.32× faster depending on extent.
- Category priority when one object carries several tags now runs sanitary, supply, eating out, attractions. Affects about 1 % of POI.
- Points of interest are drawn above the camp area and the tent.

### Fixed
- **Blank map on multipolygon campsites.** A campsite mapped as a relation arrives as a `GeometryCollection`, which has no `coordinates`. The transform threw and produced no data at all. Found near the Müritz.
- 90 points of interest rendered as empty coloured discs because two `convert` statements read the wrong tag key.
- A campsite that also carries a POI tag was emitted twice and could render as an orange playground carrying the campsite's name.
- Duplicate places: a point inside another camp's polygon with a matching name is drawn once. 8 cases in 1084 places.

## v2 — 2026-08-30

- Replaced the hard radius criteria with a weighted point system, four categories, distance rings, size driven by score.
- Grid index for the scoring, 428 ms → 23 ms, verified bit-identical to the naive computation.
- Fixed `InvalidCharacterError` from `btoa`: the transform must be pure ASCII.
- Fixed a `---` sequence inside the transform splitting the document.

## v1 — 2026-08-30

- First working map. Hard criteria, tent icon for matches, dots for the rest, star badge, colour by quality class.
- Query optimised from 78 s to 20 s on a country sized extent by probing camp nodes instead of polygons.
- Fixed `HTTP 414` arriving as `TypeError: Failed to fetch`: documentation moved out of the query body.
- Fixed the tent icon suppressing nearby POI through MapLibre collision detection.
