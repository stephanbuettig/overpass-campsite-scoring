# The Overpass query

[← back to the README](../README.md)

Reference for the OverpassQL half of the file, plus every performance measurement taken while getting it there.

---

## The query, statement by statement

```overpassql
[out:json][timeout:120][bbox:{{bbox}}];
```
Ultra substitutes `{{bbox}}` with the current map view and re-runs on every `moveend`.

```overpassql
(nwr["tourism"="camp_site"]; nwr["tourism"="caravan_site"];)->.camps;
```
Two exact value lookups, unioned. This beats a regex over the same two values by about 1 s on a large extent, because each exact value hits the tag index directly.

```overpassql
(.camps; >;)->.cd;
node.cd->.probe;
```
Recurse down to every node of every camp, then keep only the nodes. These become the probe points for the proximity search. Recursion is effectively free, measured at under 0.1 s.

```overpassql
nwr[~"^(amenity|shop|leisure|tourism)$"~"^(toilets|shower|…|aquarium)$"](around.probe:1000)->.p0;
```
One key-and-value regex against everything within 1000 m of any camp node. One `around` pass for all 51 values across four keys. Splitting this into separate queries per key more than doubles the time, because `around` then runs several times.

```overpassql
(.p0; - .camps;)->.poi;
```
Subtract the camps themselves. Without this a campsite that also carries `leisure=playground` is emitted twice, once as a camp and once as a green playground icon carrying the campsite's name. That bug was real and took a while to find.

```overpassql
nwr.poi["tourism"~"^(theme_park|zoo|aquarium)$"]->.pt;
nwr.poi["leisure"~"…"]->.pl;
nwr.poi["amenity"~"^(restaurant|fast_food|…)$"]->.pg;
nwr.poi["shop"~"…"]->.ps;
nwr.poi["amenity"~"^(toilets|…|marketplace)$"]->.pn;
```
Five subsets, cheap because they run on a set that is already small.

```overpassql
.camps out geom;
.pt convert node ::id=id(), ::geom=center(geom()), n=t["name"], v=t["…"], o=t["opening_hours"];
out geom;
… four more convert and out pairs …
```
Camps come out with full geometry, because the map draws their outline and the scoring measures from their boundary. Points of interest are converted to bare nodes carrying only name, value and opening hours. That is 208 bytes per POI against 318 for a raw `out center` with all tags.

The order of the five output statements is the category priority, lowest first. Where one object lands in two sets, the last statement wins, so sanitary beats supply beats eating out beats attractions.

## Where the time goes

Measured on the Zealand extent, 65 × 100 km, 278 places and 2530 points of interest.

| Stage | Time |
|---|---|
| Network round trip | 0.24 s |
| Server floor, even for a query returning nine objects | 1.1 s |
| Fetching the camps | 1.6 s |
| `around` filter for the points of interest | 2.5 s |
| Serialising and transferring 754 KB | 4.7 s |
| Browser: `JSON.parse` + osm2geojson + the whole scoring pass | **0.09 s** |

The browser is not the bottleneck and never was. Roughly one third of the wall clock is the Overpass instance's fixed overhead, one third is the actual work, and one third is pushing uncompressed pretty printed JSON across the wire.

> [!NOTE]
> Overpass sends the response **uncompressed**, even when the client asks for gzip. It is also pretty printed, one JSON key per line. That is why payload size translates almost directly into seconds.

## Results

| Extent | Before | After | Factor |
|---|---|---|---|
| Danish west coast | 3.1 s | 2.4 s | 1.32 |
| Lake Garda | 3.7 s | 2.9 s | 1.27 |
| Zealand | 12.0 s | 10.1 s | 1.18 |

Median of three runs each, against `overpass.openstreetmap.fr`.

### What produced the gain

1. **`tourism` as a value union rather than a regex, and without `theme_park`, `zoo` and `aquarium`.** The camps query alone went from 8.0 s to 2.9 s on Zealand. The attractions were previously fetched across the whole view even though they only score within 1000 m of a camp; they now come from the same `around` pass as everything else.
2. **One `around` instead of four.** Folding `tourism` into the main key regex removed three separate proximity passes.
3. **Five `convert` statements without the category tag.** The category is derived in the browser from the value, which is unambiguous because no value appears in two categories.

## Measured and rejected

Everything below was implemented and timed before being thrown away.

| Idea | Result |
|---|---|
| Three separate key queries instead of one key regex | 12.0 s instead of 5.5 s |
| `around` directly on the camp areas rather than their nodes | 10.9 s instead of 5.5 s |
| Regex instead of a value union for `tourism` | 3.8 s instead of 2.9 s |
| Radius 600 m instead of 1000 m | no difference at all |
| Per statement bbox instead of the global setting | no difference |
| Raw `out center` with all tags instead of `convert` | 318 instead of 208 bytes per POI |
| XML instead of JSON | 667 KB instead of 754 KB, but no reliable time gain in the browser |
| `nw` instead of `nwr` for the POI | about 0.5 s faster, loses 5 relations out of 2519. Not worth the data loss |
| Probing camp centroids instead of every node | the derived set cannot be used as an `around` target |

The radius result is the interesting one. Overpass's proximity filter costs the same whether you ask for 600 m or 1000 m, because the work is proportional to the number of coarse tiles the probe points touch, not to the area searched. There is no point being stingy with the radius.

## Server choice

Measured from a normal residential connection, not from a data centre.

| Server | Camps query | Full query on Zealand |
|---|---|---|
| `overpass.openstreetmap.fr` | 3.1 s | 9.3 s / 10.3 s |
| `overpass-api.de` | 3.4 s | 14.9 s, then HTTP 429 |
| `overpass.kumi.systems` | unreachable | unreachable |
| `overpass.private.coffee` | unreachable | unreachable |

France it is. The `server:` line in the file header is one line to change if that ever stops being true.

## Query length

2031 characters raw, 2847 URL encoded. Ultra sends the query as a GET request, and the practical limit before an instance answers `HTTP 414 Request-URI Too Large` is around 8000.

> [!WARNING]
> A 414 does not look like a 414 in the browser. The error page carries no CORS headers, so `fetch` rejects it before the status is ever visible, and what you see is `TypeError: Failed to fetch`. If the map stops loading after you added a long comment, check the encoded query length first. This cost an afternoon.
>
> Keep documentation in the YAML header, not in the OverpassQL body. The header is not part of the request.

## Why ten times faster is not available

A query returning nine objects costs 1.3 s on a public instance. That is the floor: dispatcher, query planning, bbox setup. Below it there is nothing to optimise, and the remaining work is genuinely proportional to the data.

Going meaningfully faster means leaving the public infrastructure:

- **Your own Overpass instance.** A Europe extract fits comfortably on a modern server. Removes the queue, the rate limit and most of the fixed overhead.
- **A prepared extract.** Run the query once per night against an offline database, publish the result as vector tiles or a GeoJSON per region. The map then loads in milliseconds and is one day stale.

Both are real projects rather than a query rewrite, which is why neither is in this repository.

---

[← the point system](scoring.md) · [back to the README](../README.md) · [rendering →](rendering.md)
