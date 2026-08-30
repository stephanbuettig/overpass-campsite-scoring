# Rendering

[← back to the README](../README.md)

Reference for the eleven MapLibre layers, the zoom staging, the colour system and the icon mapping.

---

## Layers, in drawing order

Later layers are drawn on top.

| # | Layer | Type | Zoom | What it does |
|---|---|---|---|---|
| 1 | `camp-area` | fill | ≥ 12.3 | the camp polygon, opacity from the score |
| 2 | `camp-outline` | line | ≥ 12.3 | its outline, width from the score |
| 3 | `camp-hitarea` | symbol | ≤ 12.8 | invisible, enlarges the hover target by about 10 px |
| 4 | `camp-star` | symbol | ≤ 12.8 | the star badge, only where a rating exists |
| 5 | `camp-dot` | symbol | ≤ 12.8 | the dot, size from the score |
| 6 | `camp-stars` | symbol | ≤ 12.8 | the rating as a digit inside the dot |
| 7 | `camp-disc` | symbol | ≥ 12.3 | white disc behind the tent |
| 8 | `camp-tent` | symbol | ≥ 12.3 | the tent, size from the score |
| 9 | `poi-disc` | symbol | ≥ 12.3 | white disc behind each POI icon |
| 10 | `poi-icon` | symbol | ≥ 12.3 | the POI glyph, tinted by category |
| 11 | `camp-label` | symbol | ≥ 12.3 | the name |

Points of interest sit above the camp area and the tent, labels above everything.

## Zoom staging

Overview layers carry `maxzoom: 12.8`, detail layers `minzoom: 12.3`. In the overlap both fade, driven by opacity:

```yaml
# leaving
["interpolate", ["linear"], ["zoom"], 12.3, 1, 12.7, 0]
# arriving
["interpolate", ["linear"], ["zoom"], 12.3, 0, 12.7, 1]
```

Dot and tent therefore never appear at full strength together, which was the original complaint that led to this design.

## Sizes

Every size below is drawn at true scale in the README, [what the size means](../README.md#legend-what-the-size-means).

Sprites are 36 × 36 px, so `icon-size: 1.0` renders 36 px on screen. The dot uses a nested expression, zoom outside and score inside:

```yaml
icon-size: ["interpolate", ["linear"], ["zoom"],
   8,    ["max", ["interpolate", ["linear"], ["get","score"], 0, 0.30, 100, 0.80],
                 ["case", ["has","st"], 0.54, 0]],
   11,   ["max", …0.26 … 0.71…, …0.49…],
   12.6, ["max", …0.20 … 0.57…, …0.43…]]
```

Three things are happening in there:

- **The dot shrinks as you zoom in.** Widest view largest, because at low zoom the dot is all there is; by the time real POI icons appear it must not cover them.
- **`max` with a floor for rated places.** A place with a star rating gets a minimum dot size so the digit fits inside it.
- **Star and digit derive from the same expression.** The star is 2.05 × the dot so the dot sits centred in it, the digit is 16.9 × the icon size so it always fills the dot the same way. Change the dot and both follow.

> [!IMPORTANT]
> MapLibre does not allow a zoom expression nested inside another expression. Zoom must be the outermost interpolation, with the data-driven part inside each stop. `["*", <zoom expression>, 0.25]` is invalid and fails validation.

## Colours

Quality classes, resolved from `camp_site` first and `stars` second. The rendered swatches are in the README, [what the colour means](../README.md#legend-what-the-colour-means).

| Class | Colour | From `camp_site` | From `stars` |
|---|---|---|---|
| 0 | `#2563C9` blue | `deluxe` | 4, 4S, 4.5, 5, 5S, 5.5 |
| 1 | `#2E9E52` green | `serviced` | 3, 3S, 3.5 |
| 2 | `#A03CB0` purple | `glamping` | — |
| 3 | `#E8A33D` orange | `standard` | 2, 2S, 2.5 |
| 4 | `#D4562B` red | `basic` | 1, 1S, 1.5 |
| 5 | `#7A8794` grey | `pitch`, `camp_pitch` | — |
| 6 | `#9AA5B1` pale grey | nothing | nothing |

The class is resolved in the transform and written to the feature as `col`, so the style reads `["get", "col"]` instead of repeating a twelve line `case` expression in five layers.

## Drawing order by quality

Two sort keys, because MapLibre uses `symbol-sort-key` for two different things and they want opposite directions.

| Property | Formula | Used by | Rule |
|---|---|---|---|
| `zk` | `(6 − rank) × 1000 + score` | all icon layers | **larger is drawn on top** |
| `sk` | `rank × 1000 + (100 − score)` | `camp-label` | **smaller wins placement** in a collision |

The direction was established by rendering pairs of overlapping markers with known ranks and looking at which one survived, not by reading the specification. Polygons have no sort key at all, so the transform sorts `data.features` with the better classes last.

## Icons

51 values map to sprites from Maki and Temaki, all verified against the sprite manifests that Ultra serves at `/sprites/maki.json` and `/sprites/temaki.json`.

A few worth calling out:

| Value | Sprite | Note |
|---|---|---|
| `sanitary_dump_station` | `temaki:camper_trailer_dump` | exactly the right pictogram, only in Temaki |
| `shower` | `temaki:shower` | Maki has no shower |
| `butcher` | `maki:slaughterhouse` | the closest thing that exists |
| `greengrocer` | `maki:garden-centre` | approximate but readable |
| `deli`, `dairy`, `cheese`, `health_food`, `frozen_food` | `maki:grocery` | no dedicated sprites exist |

Icons are tinted with `icon-color`, which works because Ultra's sprites are SDF. The white disc behind each icon is a second symbol layer using `maki:circle` in white, one size larger.

The icon name is resolved in the transform and written to the feature as `ic`, keeping the 51 entry mapping out of the style.

## Collisions

Every symbol layer sets `icon-overlap: always` and `icon-ignore-placement: true`.

Without the second one, MapLibre assigns placement from the topmost layer downwards, and a camp icon silently suppresses every POI icon underneath it. A playground 25 m from a campsite simply vanished. The symptom looks like missing data, the cause is collision detection.

`camp-label` deliberately keeps collision on, with `text-optional: true`, so labels drop out instead of overlapping. That is what `sk` is for.

## Info card

Rendered by Ultra's Liquid engine, then sanitised with DOMPurify. Inline `style` attributes, emoji, tables and underlines all survive. `<script>` and `javascript:` do not, so the card is static by construction.

The URI allow list is `https`, `http`, `mailto`, `tel`, `callto`, `sms`, `cid`, `xmpp` and `geo`.

**Underlines.** The anchor carries `text-decoration: none` and only the word inside a `<span>` is underlined, so the icon and the space after it stay clean. Setting `text-decoration: none` on a child does not remove a parent's underline in CSS; the decoration has to be applied at the child instead.

**No orphaned icons.** Every icon is followed by `&nbsp;`, so an icon can never end up alone at the end of a line.

**Chip order.** Stars, then red exclusions with a warning sign, then green confirmations with a check mark, then grey facts with no icon at all. Exclusions come before confirmations on purpose: `caravans=no` ends the decision, and it must not sit behind three green chips.

**Navigation.** The transform writes `nav_lat` and `nav_lon` on every object: the centroid of the vertices if it falls inside the geometry, otherwise the bounding box centre, otherwise the first vertex. Checked against 1084 places, none without a point. Every card therefore has a working Google Maps link even when OSM has no address.

## Language

The card carries five label sets. The transform resolves the language once and writes it onto every feature as `lg`, the template selects with a single `case` block whose `assign` statements stay visible in the rest of the template.

```liquid
{%- case tags.lg -%}
{%- when 'fr' -%}{%- assign T_san = 'Sanitaires' -%}…
{%- else -%}{%- assign T_san = 'Sanitary' -%}…
{%- endcase -%}
```

Two facts this depends on, both verified rather than assumed:

- `navigator.language` **is available inside the worker** where Ultra runs the transform, and matches the browser. A Playwright locale override does not reach the worker, which produced a misleading first measurement; the real browser was checked afterwards.
- LiquidJS `assign` inside a `case` block **leaks to the outer scope**, so the labels can be declared once at the top and used everywhere below.

38 `assign` statements × 5 languages, 37 labels plus the decimal separator, cost 7223 characters in the file and 3166 in the shareable link, both measured. Per feature the cost is a single two letter property.

Place names are never translated. OSM `name` is the local name, which is what is written on the sign at the entrance.

## Hover and click

Ultra routes both through the same handler with the same template. Measured in a faithful reproduction of its handlers:

| | on the marker | moving into the card | moving away | after a click |
|---|---|---|---|---|
| `popupOnHover: true` | card shows | card stays | card goes | card goes |
| `popupOnHover: false` | nothing | — | — | **card stays** |

You get hover or you get pinning, not both. The card surviving a move into it is what makes hover usable: the popup is a DOM overlay above the canvas, so the map's `mousemove` never fires while the cursor is on it, and the links are clickable.

---

[← the query](query.md) · [back to the README](../README.md) · [tuning →](tuning.md)
