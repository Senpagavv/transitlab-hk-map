"""Rebuild the published 455-zone map and CSV. Requires Python 3.10+."""

import csv
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "inputs"
OUT = ROOT / "public/data"
BANDS = ("age_0_14", "age_15_24", "age_25_44", "age_45_64", "age_65_plus")
TEXT = {"zone", "parent", "label", "district", "district_en", "label_source"}


def rows(name):
    with (INPUT / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def parent_targets():
    controls = json.loads(
        (INPUT / "land-age-controls.json").read_text(encoding="utf-8")
    )
    projected = {}
    for row in rows("census-controls.csv"):
        growth = float(row["plan_target"]) / float(row["plan_base"])
        pop = int(row["census_2021"]) * growth
        values = {b: int(row[b]) * growth * float(row["shift_" + b]) for b in BANDS}
        total = sum(values.values())
        projected[row["parent"]] = {
            b: v * pop / total if total else 0 for b, v in values.items()
        }
    factors = {b: controls[b] / sum(p[b] for p in projected.values()) for b in BANDS}
    return {
        parent: round(sum(p[b] * factors[b] for b in BANDS))
        for parent, p in projected.items()
    }


def allocate(population, weights):
    weight_total = sum(weights)
    if not weight_total:
        if population:
            raise ValueError("Nonzero population has no allocation weights")
        return [0] * len(weights)
    exact = [w * population / weight_total for w in weights]
    counts = [math.floor(x) for x in exact]
    order = sorted(
        range(len(weights)), key=lambda i: exact[i] - counts[i], reverse=True
    )
    for i in order[: population - sum(counts)]:
        counts[i] += 1
    return counts


def typed(key, value):
    if key in TEXT:
        return value
    if value == "":
        return None
    if key == "road_access":
        return {"True": True, "False": False}[value]
    return float(value) if any(c in value for c in ".eE") else int(value)


def main():
    zones = [{k: typed(k, v) for k, v in row.items()} for row in rows("zones.csv")]
    by_parent = defaultdict(list)
    for zone in zones:
        by_parent[zone["parent"]].append(zone)
    targets = parent_targets()
    if set(targets) != set(by_parent):
        raise ValueError("Parent geography does not match the controls")
    for parent, children in by_parent.items():
        counts = allocate(targets[parent], [z["population_2021"] for z in children])
        for z, population in zip(children, counts):
            z["population"] = population
            raw_area = z.pop("area_source_km2")
            z["density"] = round(population / raw_area) if raw_area else None
            base = z["population_2021"]
            z["growth_pct"] = round((population / base - 1) * 100, 1) if base else None
    lookup = {z["zone"]: z for z in zones}
    geometry = json.loads((INPUT / "boundaries.geojson").read_text(encoding="utf-8"))
    ids = [f["properties"]["zone"] for f in geometry["features"]]
    if (
        len(set(ids)) != len(ids)
        or len(lookup) != len(zones)
        or set(ids) != set(lookup)
    ):
        raise ValueError("Zone and boundary identifiers must match one-to-one")
    for feature in geometry["features"]:
        feature["properties"] = lookup[feature["properties"]["zone"]]
    OUT.mkdir(exist_ok=True, parents=True)
    (OUT / "zones-2026.geojson").write_text(
        json.dumps(geometry, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        + "\n",
        encoding="utf-8",
        newline="\n",
    )
    with (OUT / "zones.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(zones[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(zones)
    print(
        f"{len(targets)} parent areas, {len(zones)} zones, {sum(z['population'] for z in zones):,} estimated residents"
    )


if __name__ == "__main__":
    main()
