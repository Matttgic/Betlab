from __future__ import annotations

import argparse
import importlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

REGISTRY = {
    "nhl": ("sportsdataverse.nhl", ["load_nhl_schedule", "load_nhl_player_boxscore"]),
    "nba": ("sportsdataverse.nba", ["load_nba_schedule", "load_nba_player_boxscore"]),
    "wnba": ("sportsdataverse.wnba", ["load_wnba_schedule", "load_wnba_player_boxscore"]),
    "nfl": ("sportsdataverse.nfl", ["load_nfl_schedule"]),
    "mlb": ("sportsdataverse.mlb", ["load_mlb_schedule"]),
}


def to_records(frame: Any) -> list[dict[str, Any]]:
    if frame is None:
        return []
    if hasattr(frame, "to_pandas"):
        frame = frame.to_pandas()
    if not isinstance(frame, pd.DataFrame):
        frame = pd.DataFrame(frame)
    if frame.empty:
        return []
    frame = frame.copy()
    if isinstance(frame.columns, pd.MultiIndex):
        frame.columns = ["__".join(str(x) for x in col if str(x)) for col in frame.columns]
    frame.columns = [str(x) for x in frame.columns]
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def call_loader(module: Any, loader_name: str, season: int):
    fn = getattr(module, loader_name, None)
    if fn is None:
        raise AttributeError(f"{loader_name} is not exported")
    try:
        return fn(seasons=[season], return_as_pandas=True)
    except TypeError:
        try:
            return fn(seasons=season, return_as_pandas=True)
        except TypeError:
            return fn([season])


def sync(output: Path, sports: list[str], season: int) -> dict[str, Any]:
    output.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "sports": {},
        "errors": [],
    }

    for sport in sports:
        if sport not in REGISTRY:
            manifest["errors"].append({"sport": sport, "error": "unsupported sport"})
            continue
        module_name, loaders = REGISTRY[sport]
        sport_meta = {"module": module_name, "datasets": {}, "healthy": False}
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            manifest["errors"].append({"sport": sport, "error": f"import failed: {type(exc).__name__}: {exc}"})
            manifest["sports"][sport] = sport_meta
            continue

        for loader_name in loaders:
            try:
                frame = call_loader(module, loader_name, season)
                records = to_records(frame)
                if not records:
                    raise ValueError("loader returned no rows")
                file_name = f"{sport}__{loader_name}.json"
                (output / file_name).write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
                sport_meta["datasets"][loader_name] = {"file": file_name, "rows": len(records)}
                sport_meta["healthy"] = True
            except Exception as exc:
                manifest["errors"].append({
                    "sport": sport,
                    "loader": loader_name,
                    "error": f"{type(exc).__name__}: {exc}",
                })
        manifest["sports"][sport] = sport_meta

    manifest["healthySports"] = [sport for sport, meta in manifest["sports"].items() if meta.get("healthy")]
    manifest["healthy"] = bool(manifest["healthySports"])
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh BetLab multisport SportsDataverse snapshots")
    parser.add_argument("--output", default="data/sportsdataverse")
    parser.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    parser.add_argument("--sports", default="nhl,nba,wnba,nfl,mlb")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sports = [x.strip().lower() for x in args.sports.split(",") if x.strip()]
    result = sync(Path(args.output), sports, args.season)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["healthy"]:
        raise SystemExit("No SportsDataverse sport produced usable data")


if __name__ == "__main__":
    main()
