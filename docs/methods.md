# How the map was made

The map combines official Hong Kong statistics and geography with estimates for 455 model zones. The 2021 census provides observations at 211 parent areas. The project divides these areas into smaller zones to study neighbourhood differences. A small-zone population is therefore an allocation, including in 2021. A name such as “Kai Tak station area” is a locator for a model polygon.

## From census to population layer

1. **Build the geography.** Start with the 2021 Small Tertiary Planning Unit Groups (STPUGs). The original pipeline split selected parent polygons around rail stations and used residential floor area to distribute the parent counts. The zone table preserves the parent ID and each resulting 2021 population weight. Source: Hong Kong Census and Statistics Department. [Census dataset and boundaries](https://data.gov.hk/en-data/dataset/hk-censtatd-census_geo-2021-population-census-by-stpu).
2. **Project the parent areas.** For each parent, multiply its census population by the Planning Department’s 2026-to-2021 population ratio. Apply the district age-composition changes to five census age bands. For parents crossing districts, combine district changes using the original dwelling-floor-area shares. Scale the bands back to the projected parent total. The published [parent input table](../inputs/census-controls.csv) contains those ratios’ inputs and the resulting district-weighted age multipliers. [Planning Department projections, tables 1, 7 and 15](https://www.pland.gov.hk/pland_en/resources/population_data/pop_dist_proj/index.html).
3. **Calibrate and allocate.** Scale each projected age band to the Census and Statistics Department’s provisional mid-2026 age estimate adjusted to the land-population scope. Round each parent total, distribute it according to its local 2021 population weights, then give any remaining people to the largest fractional remainders. This preserves each rounded parent total. The [age controls](../inputs/land-age-controls.json) and [zone inputs](../inputs/zones.csv) are frozen extracts. [C&SD population by sex and age](https://www.censtatd.gov.hk/en/web_table.html?id=110-01002).
4. **Join values to shapes.** Join by the text zone ID. Compute density using the original model area, and growth against the allocated 2021 count. Where the baseline is zero, the percentage change is missing. Display polygons were simplified by 8 metres in Hong Kong 1980 Grid, then exported in WGS84 longitude/latitude. Their displayed area may differ from the area used for density. [Build script](../scripts/build_map.py).

## What each map layer measures

| Map layer | Output field | Meaning |
| --- | --- | --- |
| Population density | `density` | Estimated 2026 residents per km² of model area. |
| Population | `population` | Estimated 2026 residents in the polygon. `population_2021` is the 2021 allocation. |
| Population change | `growth_pct` | Percentage change from 2021 to 2026. Blank if the 2021 count is zero. |
| Age 65 and over | `elderly_pct` | Estimated percentage of residents aged 65 or older. Undefined where population is zero. |
| Job density | `jobs_density` | Estimated workplace jobs per km². The original model distributed district employment using floorspace by use and population. `jobs` is the estimated count. |
| Weekday arrivals | `trips_in` | Estimated mechanised person trips ending in the area on a weekday. The transport model uses the 2022 Travel Characteristics Survey. Walking-only and cycling-only trips are outside this measure. |
| School places | `school_places` | Estimated kindergarten, primary and secondary places. The original model allocated district places using school locations. University places are separate. |

The CSV also includes household, student and worker allocations, building floor area in m², weekday trip origins, readable zone labels and WGS84 centre coordinates. `area_km2` is rounded for display. Null values in GeoJSON and empty numeric CSV cells indicate an unavailable value. A zone with a valid zero is displayed in the scale. These are historical snapshots. Agreement with a territory control does not independently establish neighbourhood accuracy.

The public build reconstructs population, growth and density and assembles all seven layers from the included inputs. The other thematic values retain the original model’s estimates. The repository includes the prepared inputs needed to recreate this edition. The original full transport assignment and raw building inventory were separate upstream processes. [Planning Department population and employment matrix](https://www.pland.gov.hk/pland_en/resources/population_data/tpedm/2021.html) · [Transport Department Travel Characteristics Survey](https://www.td.gov.hk/filemanager/en/content_5349/tcs2022_eng.pdf) · [Education Bureau statistics](https://www.edb.gov.hk/en/about-edb/publications-stat/figures/index.html).

## Place names and basemap

The search index contains 9,548 stops from Hong Kong Community GTFS. Stop searches pan to a point. Selecting a zone by name or ID opens its statistics. The optional street basemap draws the bundled roads while connecting to the Lands Department and keeps them visible if the service is unavailable. Population, search and other data layers are included with the map. [Hong Kong Community GTFS](https://github.com/wheelstransit/hongkong-community-gtfs) · [Lands Department Vector Map API](https://tools.csdi.gov.hk/csdi-webpage/apidoc/VectorMapAPI).

The [bundled streets](../public/basemap/streets.geojson) come from the original project's Geofabrik Hong Kong OpenStreetMap extract dated 16 September 2026 at 20:21 UTC. Main roads appear at all scales. Local streets appear at zoom 12 and above. The extraction groups roads by their highway tags, joins lines where possible and simplifies the shapes for display. [Geofabrik Hong Kong extracts](https://download.geofabrik.de/asia/china/hong-kong.html) · [Data attribution and reuse](../USE.md).

To rebuild the street layer separately, install `osmium==4.3.2` and `shapely==2.2.0`, then run `python scripts/build_streets.py hong-kong-latest.osm.pbf`. The archived source file has SHA-256 `b9bd45ec3d6f69d50e1c62ce255568ad41d8a00bf7bdd09b48cff51fe4b34723`. A more recent OSM extract produces a more recent network. [Extraction script](../scripts/build_streets.py).
