# Tuning

[← back to the README](../README.md)

How to change the map without breaking it. Every recipe below names the exact block to edit, and the check to run afterwards.

---

## The file

One file, four parts, separated by `---`:

```
---
# comments, the documentation
server:          which Overpass instance
popupOnHover:    hover card or click card
popupTemplate:   the info card, Liquid
transform:       the scoring, JavaScript
style:           the MapLibre layers
---
the OverpassQL query
```

Open it in [Overpass Ultra][ultra], edit, press run. There is no build step.

## Change the weights

In `transform`, first block:

```js
var CAT = {
  san: { max: 45, rings: [[150, 1.0], [350, 0.6], [600, 0.3]] },
  ver: { max: 25, rings: [[150, 1.0], [400, 0.6], [1000, 0.3]] },
  gas: { max: 18, rings: [[200, 1.0], [500, 0.6], [1000, 0.3]] },
  att: { max: 12, rings: [[250, 1.0], [550, 0.6], [1000, 0.3]] }
};
```

Keep the four maxima adding up to 100 and the info card stays truthful without any other edit; it reads the maxima from these numbers.

Some worked examples:

| You want | Change |
|---|---|
| Travelling with a dog, playgrounds irrelevant | `att: { max: 5 }`, `ver: { max: 32 }` |
| Wild camping, everything is further away | widen every ring, e.g. `[[400, 1.0], [900, 0.6], [2000, 0.3]]` |
| Cycling, 2 km is nothing | same, plus raise the `around` radius in the query to match |
| Only sanitary matters | `san: { max: 100 }` and the other three to `0` |

> [!WARNING]
> If you widen a ring beyond 1000 m you must also raise `around.probe:1000` in the query. The transform can only score what the query fetched. The radius costs nothing in query time, so be generous.

## Change how many hits count

```js
var BEST_N = 3;
```

`BEST_N = 1` makes it "is there one at all", which turns the map binary. `BEST_N = 5` rewards dense town centres more. Three is a compromise: enough to distinguish a real high street from a single kiosk, few enough that a city does not saturate everything.

## Add a category

Four places to touch, in this order.

1. **The query.** Add the values to the big key regex, and add a subset plus a `convert` and `out` pair. Put the new statement at the position in the output order that matches its priority; the last statement wins where an object matches several sets.
2. **`CAT`** in the transform, with a maximum and rings. Rebalance the others so the sum stays 100.
3. **`CATEGORY`** in the transform, mapping each new value to the new key. No value may appear in two categories, that is what makes the classification unambiguous.
4. **`ICON`** in the transform, one sprite per value. Check the name against `https://overpass-ultra.us/sprites/maki.json` and `/sprites/temaki.json` before you trust it.

Then add the colour to `poi-icon`'s `icon-color` match, and a branch in the info card.

> [!TIP]
> Check every new tag value against [taginfo](https://taginfo.openstreetmap.org/) first. Several plausible looking values proposed during development turned out not to exist at all. The header of the file lists them.

## Change the colours

Quality classes live in `CLASSES` in the transform:

```js
var CLASSES = [
  { rank: 0, colour: '#2563C9', camp: ['deluxe'], starValues: ['5','5S','5.5','4.5','4','4S'] },
  …
];
```

`rank` drives both the colour and the drawing order, so reordering the array reorders which class is drawn on top.

Category colours for the POI icons are in the `poi-icon` layer, `icon-color`.

## Change the zoom at which it switches

Three numbers, in the style:

- `maxzoom: 12.8` on the overview layers
- `minzoom: 12.3` on the detail layers
- the two opacity ramps, `12.3 → 12.7`

Keep the ramp inside the min/max window or a layer will pop.

## Change the marker sizes

`P` at the top of the size expressions defines three zoom stops as `(zoom, size at score 0, size at score 100, minimum for rated places)`. Star and digit derive from it automatically. Sprites are 36 px at `icon-size: 1.0`.

## Change the card language

```js
var UI = 'auto';   // follows the browser
var UI = 'de';     // de, en, fr, es, it
```

Adding a sixth language means one `{%- when 'xx' -%}` block in the template with 37 `assign` statements, and adding the code to `UI_LANGS` in the transform. The body of the template does not change at all.

## Hover card or pinned card

```yaml
popupOnHover: true    # card follows the cursor, no pinning
popupOnHover: false   # card appears on click and stays
```

There is no setting that gives both. See [rendering.md](rendering.md#hover-and-click) for the measurements.

## Change the server

```yaml
server: https://overpass.openstreetmap.fr/api/
```

Note the trailing `/api/`, Ultra appends `interpreter` itself. If you run your own instance, this is the only line that changes, and it is also the single biggest performance lever available.

## Rebuild the one click link

```bash
npm install lz-string
node tools/make-link.mjs 11.00 56.0000 8.2000
```

Prints both the map-only and the editor URL. Run it after every edit, otherwise the link in the README still carries the old document.

## Checks worth running after an edit

| Check | Why |
|---|---|
| The map still draws | the transform throws on one bad feature and the whole map goes blank, silently |
| Zoom past 12.5 and back | catches broken min/max or opacity ramps |
| Hover a place with no name and no tags | catches template branches that assume a field exists |
| Encoded query length under ~8000 | otherwise HTTP 414 arrives as `TypeError: Failed to fetch` |
| The transform is pure ASCII | Ultra encodes it with `btoa`, which is Latin-1 only |
| No `---` inside the transform | that sequence is the YAML front matter delimiter and will cut your file in half |

The last two are not theoretical. Both happened. See the [development log](development-log.md).

---

[← rendering](rendering.md) · [back to the README](../README.md) · [development log →](development-log.md)

[ultra]: https://overpass-ultra.us/
