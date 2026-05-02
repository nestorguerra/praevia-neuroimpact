from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TribeInputs:
    video_path: str | None = None
    audio_path: str | None = None
    text_path: str | None = None


@dataclass
class TribeRunSpec:
    run_id: str
    asset_id: str
    model_id: str = "facebook/tribev2"
    cache_dir: str = "/models/tribe"
    device: str = "cuda"
    inputs: TribeInputs = field(default_factory=TribeInputs)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TribeRunSpec":
        inputs = data.get("inputs", {})
        return cls(
            run_id=str(data["run_id"]),
            asset_id=str(data["asset_id"]),
            model_id=str(data.get("model_id", "facebook/tribev2")),
            cache_dir=str(data.get("cache_dir", "/models/tribe")),
            device=str(data.get("device", "cuda")),
            inputs=TribeInputs(
                video_path=inputs.get("video_path"),
                audio_path=inputs.get("audio_path"),
                text_path=inputs.get("text_path"),
            ),
        )


@dataclass
class TribeOutput:
    predictions_path: Path
    segments_path: Path
    metrics_path: Path
    n_timesteps: int
    n_vertices: int
    metrics: dict[str, Any]

