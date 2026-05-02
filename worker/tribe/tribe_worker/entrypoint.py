from __future__ import annotations

import os


def main() -> None:
    runtime = os.getenv("TRIBE_WORKER_RUNTIME", "runpod").lower()
    if runtime in {"http", "cloud_run", "google_cloud_run"}:
        import uvicorn

        port = int(os.getenv("PORT", "8080"))
        uvicorn.run("tribe_worker.http_server:app", host="0.0.0.0", port=port)
        return

    from tribe_worker.handler import main as runpod_main

    runpod_main()


if __name__ == "__main__":
    main()
