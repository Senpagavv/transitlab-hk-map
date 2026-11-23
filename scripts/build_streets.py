"""Extract the optional local street backdrop from a Geofabrik Hong Kong OSM file."""

import argparse
import json
from pathlib import Path

import osmium
from shapely.geometry import LineString, MultiLineString
from shapely.ops import linemerge


MAIN = {"motorway", "trunk", "primary", "secondary"}
LOCAL = {"tertiary", "residential", "unclassified", "living_street"}
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "basemap" / "streets.geojson"


class RoadReader(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.lines = {"main": [], "local": []}

    def way(self, way):
        highway = way.tags.get("highway", "").removesuffix("_link")
        if highway not in MAIN and highway not in LOCAL:
            return
        if any(not node.location.valid() for node in way.nodes):
            return
        points = [(node.lon, node.lat) for node in way.nodes]
        if len(points) >= 2:
            self.lines["main" if highway in MAIN else "local"].append(points)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("osm_file", type=Path)
    args = parser.parse_args()
    reader = RoadReader()
    reader.apply_file(str(args.osm_file), locations=True)
    features = []
    for road_class, lines in reader.lines.items():
        if not lines:
            raise ValueError(f"No roads found for class {road_class}")
        merged = linemerge(MultiLineString(lines))
        paths = [merged] if isinstance(merged, LineString) else merged.geoms
        coordinates = []
        for path in paths:
            line = path.simplify(0.00005, preserve_topology=False)
            points = [[round(x, 5), round(y, 5)] for x, y in line.coords]
            if len(points) >= 2 and any(p != points[0] for p in points[1:]):
                coordinates.append(points)
        features.append(
            {
                "type": "Feature",
                "properties": {"class": road_class},
                "geometry": {"type": "MultiLineString", "coordinates": coordinates},
            }
        )
    data = {"type": "FeatureCollection", "features": features}
    OUTPUT.parent.mkdir(exist_ok=True, parents=True)
    OUTPUT.write_text(
        json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n"
    )
    print(f"{len(features)} road classes, {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
