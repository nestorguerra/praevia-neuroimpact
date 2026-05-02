from __future__ import annotations

import argparse
import json
from pathlib import Path

from tribe_worker.runner import run_mock, run_real
from tribe_worker.schemas import TribeRunSpec


def main() -> None:
    parser = argparse.ArgumentParser(description="PraevIA TRIBE v2 GPU worker")
    parser.add_argument("--run-spec", required=True, help="Path to run-spec JSON")
    parser.add_argument("--output-dir", required=True, help="Directory for prediction outputs")
    parser.add_argument("--mock", action="store_true", help="Generate deterministic mock predictions for local contract tests")
    args = parser.parse_args()

    spec_data = json.loads(Path(args.run_spec).read_text(encoding="utf-8"))
    spec = TribeRunSpec.from_dict(spec_data)
    output_dir = Path(args.output_dir)

    output = run_mock(spec, output_dir) if args.mock else run_real(spec, output_dir)
    print(
        json.dumps(
            {
                "status": "done",
                "run_id": spec.run_id,
                "asset_id": spec.asset_id,
                "n_timesteps": output.n_timesteps,
                "n_vertices": output.n_vertices,
                "predictions_path": str(output.predictions_path),
                "segments_path": str(output.segments_path),
                "metrics_path": str(output.metrics_path),
                "metrics": output.metrics,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

