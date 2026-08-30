# The point system

[← back to the README](../README.md)

Reference for how a place gets its number. Everything described here lives in the `transform` block of [`campsite-scoring.ultra`](../campsite-scoring.ultra) and runs in the browser, in about 90 ms for a large view.

---

## The formula

For each campsite or caravan site, and for each of the four categories:

1. Collect every matching point of interest within the category's outermost ring.
2. Turn each distance into a factor with the ring table: full weight inside the first ring, 0.6 inside the second, 0.3 inside the third, 0 beyond.
3. Sort the factors descending, keep the best `BEST_N` (three), sum them.
4. Divide by `BEST_N` and cap at 1. That is the category's share.
5. Multiply by the category maximum.

The four category results add up to the score, an integer from 0 to 100.

```
score = Σ  min(1, (Σ best 3 ring factors) / 3) × max_points
      categories
```

Distances are measured from **every support point of the site geometry**, so a POI is scored against the nearest point of the boundary, not against a centroid. A 600 m long campsite is not punished for having its middle far from the bakery at its gate.

## Categories

| Key | Category | Max | Colour | Ring 1 (×1.0) | Ring 2 (×0.6) | Ring 3 (×0.3) |
|---|---|---|---|---|---|---|
| `san` | Sanitary | 45 | `#734a08` | 150 m | 350 m | 600 m |
| `ver` | Food supply | 25 | `#ac39ac` | 150 m | 400 m | 1000 m |
| `gas` | Eating out | 18 | `#C77400` | 200 m | 500 m | 1000 m |
| `att` | Attractions | 12 | `#0d7a52` | 250 m | 550 m | 1000 m |

The four ring sets drawn to the same scale: [README, how the score works](../README.md#how-the-score-works).

Colours are the OSM Carto values for amenity brown, shop purple, gastronomy orange and leisure green, read out of `style/amenity-points.mss`. They are the colours people already associate with those things on the standard OSM map.

### Which tags count

Every value below was checked against [taginfo](https://taginfo.openstreetmap.org/) before it went in. No value appears in two categories, which is what lets the transform derive the category from the bare value.

**Sanitary** — `amenity` = `toilets`, `shower`, `drinking_water`, `sanitary_dump_station`, `water_point`, `public_bath`; `shop=laundry`

**Food supply** — `shop` = `supermarket`, `convenience`, `bakery`, `butcher`, `greengrocer`, `deli`, `dairy`, `cheese`, `seafood`, `pastry`, `confectionery`, `beverages`, `alcohol`, `health_food`, `frozen_food`, `farm`, `grocery`, `general`, `kiosk`; `amenity=marketplace`

**Eating out** — `amenity` = `restaurant`, `fast_food`, `cafe`, `ice_cream`, `biergarten`, `pub`, `bar`, `food_court`

**Attractions** — `leisure` = `playground`, `miniature_golf`, `water_park`, `swimming_area`, `sports_centre`, `fitness_centre`, `fitness_station`, `sauna`, `amusement_arcade`, `adult_gaming_centre`, `beach_resort`, `bowling_alley`, `horse_riding`; `tourism` = `theme_park`, `zoo`, `aquarium`

### Deliberately excluded

| Value | Reason |
|---|---|
| `leisure=swimming_pool` | 3.0 M uses, 59.5 % explicitly `access=private`. Those are garden pools, not an offer to campers. |
| `leisure=pitch` | 2.8 M uses. Every ball court and every school yard. Too vague to mean anything. |
| `shop=clothes`, `mall`, `department_store`, `wholesale` | Not food supply. Explicitly out of scope. |

### Values that do not exist

Several plausible looking tags were proposed during development and turned out to be invented. They are listed in the file header so nobody adds them back.

| Proposed | Reality |
|---|---|
| `leisure=minigolf` | the real value is `leisure=miniature_golf` |
| `leisure=arcade` | the real value is `leisure=amusement_arcade` |
| `amenity=convenience_store` | the real value is `shop=convenience` |
| `amenity=swimming_pool` | does not exist |
| `shop=hypermarket`, `shop=delicatessen` | do not exist |
| `amenity=dishwashing` | the key has five uses worldwide, unusable |

That last one matters: a dishwashing station is genuinely useful when you are camping, and it simply is not mapped. There is no way to score it.

## On site sanitary

A place that carries `toilets=yes`, `shower=yes` and `drinking_water=yes` on its own object gets **one** slot of value 1.0 in the sanitary category, not three.

This was originally three slots, and the effect was ugly. Measured over 1084 places in eight regions:

- 17 % of all places saturated the highest weighted category purely from their own tags
- 63 % carried no sanitary tag at all

In other words, the most important category was largely measuring how diligently a place had been tagged. Correlation between the total score and the number of on-site tags was **r = 0.54**.

After the change to a single slot: **r = 0.41**, and the interquartile spread of scores rose from 35 to 38 points. Both moves are in the right direction, and the rule stays easy to explain.

The tags that count as on-site: `toilets`, `shower`, `drinking_water`, `sanitary_dump_station`, `washing_machine`, `laundry`. The last two are near dead in OSM (2456 and 831 uses worldwide as keys) and cost nothing to keep.

## Measured distributions

Eight contrasting regions, 1084 places, 10 696 points of interest, all fetched live.

| Region | Places | p25 | Median | p75 | p90 | Max |
|---|---|---|---|---|---|---|
| Lake Garda | 122 | 43 | 65 | 83 | 90 | 97 |
| Baltic Sea, Rügen | 65 | 36 | 60 | 75 | 81 | 100 |
| Müritz lakes | 110 | 25 | 48 | 68 | 77 | 95 |
| Bernese Oberland | 61 | 24 | 45 | 64 | 79 | 88 |
| Danish west coast | 122 | 9 | 31 | 45 | 69 | 93 |
| Eifel | 138 | 14 | 30 | 55 | 75 | 95 |
| Provence coast | 188 | 15 | 26 | 49 | 63 | 100 |
| Zealand | 278 | 3 | 15 | 30 | 55 | 88 |

The spread between regions is real, not an artefact. Zealand contains several hundred Danish *teltpladser*, primitive shelter sites in forests with no facilities at all, and they correctly score zero. Lake Garda is wall to wall infrastructure.

Because the icon size mapping is absolute rather than relative to the current view, a Danish map looks sparser than an Italian one. That is honest: the places really do have less around them.

## Plausibility

The top of each region, with the category breakdown, reads the way a motorhome traveller would rank them. Harbour pitches win, because a harbour is exactly the combination this scoring rewards: sanitary block, shops, restaurants and something to look at, all within a few hundred metres.

Danish west coast, top five:

| Score | san | ver | gas | att | Name |
|---|---|---|---|---|---|
| 89 | 45 | 16 | 18 | 10 | Ringkøbing Havn |
| 85 | 45 | 15 | 18 | 7 | Hvide Sande Havn |
| 85 | 45 | 10 | 18 | 12 | Bork Havn |
| 83 | 45 | 15 | 16 | 8 | Tungevej Hvide Sande |
| 83 | 39 | 17 | 16 | 12 | Bork Havn Camping |

Bottom of the same region: `No Teltplads`, `Thorager Camping`, `Bækhuse fisk og ferie camping`, all at zero, all genuinely isolated.

## Alternatives that were tested

Four scoring variants were implemented and measured against each other on all eight regions, judged on two numbers: the interquartile spread of the scores (more spread means the map discriminates better) and the correlation with the number of on-site tags (lower means the score measures surroundings rather than tagging effort).

| Variant | Mean IQR | Mean r |
|---|---|---|
| Original, on-site fills all three slots | 35.1 | 0.54 |
| **On-site fills one slot** | **37.5** | **0.41** |
| Plus geometric diminishing returns instead of best-of-three | 37.4 | 0.43 |
| Plus a smooth distance curve instead of rings | 37.6 | 0.44 |
| Plus a partial on-site bonus | 37.4 | 0.43 |

The smooth curve `1 / (1 + (d/d₀)²)` is more elegant on paper and measurably no better. Rings won because they perform identically and can be explained to anyone in one sentence. The single change that mattered was the on-site slot.

## Why 100 and not 69

The weights were originally 10, 6, 4 and 3, with a cap of 3 per category, giving a maximum of 69. Rescaling to 45, 25, 18 and 12 preserves the intended ratios almost exactly and makes the popup readable without a mental conversion.

Rank correlation between the old weights and the new ones, over all eight regions: **Spearman ρ = 0.999**. The ordering is the same, only the number changed.

## Duplicate places

Some campsites exist in OSM twice, once as an area and once as a node inside it. A point that sits inside another camp's polygon is dropped when it has no name or when its name matches the enclosing area.

Measured over 1084 places: **8 such points**, of which 7 were genuine duplicates. A motorhome harbour with its own name inside a larger campsite is kept, because it is a separate offer.

## Multiple tags on one object

An object with `shop=bakery` **and** `amenity=cafe` belongs in two categories but is drawn once. The output order of the query decides which one wins, and the last statement wins.

The order reads attractions, eating out, food supply, sanitary, so the more important category takes it. A bakery that also serves coffee counts as a bakery, which is what a camper wants at seven in the morning.

This affects about 1 % of points of interest, and moves the score of about 3 % of places by at most 4 points out of 100.

---

[← back to the README](../README.md) · [the query →](query.md)
