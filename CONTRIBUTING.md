# Contributing

Issues and pull requests are welcome. The project is one file plus its documentation, so the bar is low, but a few things make review quick.

## Before you open a pull request

**Check that the map still draws.** Open [`campsite-scoring.ultra`](campsite-scoring.ultra) in [Overpass Ultra](https://overpass-ultra.us/), press run, and zoom past 12.5 and back. A transform that throws on a single feature produces a blank map with no visible error, so "it loads" is a real test.

**Check the two silent killers.**

| Check | Why |
|---|---|
| The `transform` block is pure ASCII | Ultra encodes it with `btoa`, which is Latin-1 only |
| No `-{3,}` sequence inside `transform` | `---` is the YAML front matter delimiter and will split your file |

**Check the query length.** Encoded, it must stay well under 8000 characters. Overpass answers longer requests with `HTTP 414`, which reaches the browser as `TypeError: Failed to fetch`. Keep prose in the YAML header, never in the OverpassQL body.

**Check new tag values against [taginfo](https://taginfo.openstreetmap.org/).** Several plausible looking values proposed during development turned out not to exist. The file header lists them so they do not come back.

**Rebuild the link** if you changed the file:

```bash
npm install
node tools/make-link.mjs --write
```

`--write` patches the links in the README in place. They are inline links, not reference definitions, and there is nothing left at the bottom of the file to edit by hand.

## What makes a good change

Measurements beat opinions. If you change the scoring, say what it does to the distribution over more than one region. If you change the query, say what it does to the runtime and whether the result set is still the same. The [development log](docs/development-log.md) shows the format: what changed, why, and the number.

If a change alters scores, a before-and-after comparison run **in the same minute** is worth the effort. OSM moves underneath you otherwise.

## What is out of scope

- Anything requiring a server. The whole point is one file and a public Overpass instance.
- Filters that hide places. The design deliberately shows everything and varies the size.
- Reviews or ratings that are not in OSM. If it is not a tag, it does not belong here.

## Reporting a problem

A screenshot and the map position beat a description. If the map is blank, the first suspect is the transform throwing on one feature: open the browser console, then narrow the view until the map comes back and you have found the object.

## Licence

Code contributions are accepted under [MIT](LICENSE). Remember that the map data is OpenStreetMap under ODbL.
