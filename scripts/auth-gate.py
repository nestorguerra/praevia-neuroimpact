import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"


def static_gate() -> int:
    main = (BACKEND / "app" / "main.py").read_text()
    auth = (BACKEND / "app" / "auth.py").read_text()
    frontend = (ROOT / "frontend" / "src" / "auth" / "supabaseAuth.ts").read_text()
    checks = {
        "backend_requires_bearer": "HTTPBearer" in auth and "jwt.decode" in auth,
        "private_routers_have_dependency": "dependencies=private_dependencies" in main,
        "frontend_uses_supabase_auth": "signInWithPassword" in frontend and "signUp" in frontend,
    }
    ok = all(checks.values())
    print({"ok": ok, "mode": "static", "checks": checks})
    return 0 if ok else 1


try:
    if sys.version_info < (3, 11):
        raise ModuleNotFoundError("Python >=3.11 is required for backend TestClient gate")
    from fastapi.testclient import TestClient
except ModuleNotFoundError:
    raise SystemExit(static_gate())

import os  # noqa: E402

os.environ["APP_ENV"] = "production"
os.environ["AUTH_MODE"] = "supabase"
os.environ["JWT_SECRET"] = "test-secret-not-for-production"
os.environ["CORS_ALLOWED_ORIGINS"] = "http://localhost:5173"
os.environ["ALLOWED_HOSTS"] = "testserver"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402


def main() -> int:
    client = TestClient(app)
    private_response = client.get("/v1/organizations/00000000-0000-4000-8000-000000000001/projects")
    public_response = client.post(
        "/v1/marketing/demo-requests",
        json={
            "name": "Nestor Guerra",
            "company": "PraevIA",
            "email": "nestor@praevia.ai",
            "role": "Founder",
            "use_case": "Piloto",
            "asset_count": "10-30",
            "consent": True,
        },
    )
    ready_response = client.get("/ready")

    ok = private_response.status_code == 401 and public_response.status_code == 200 and ready_response.status_code == 200
    print(
        {
            "ok": ok,
            "private_without_token": private_response.status_code,
            "public_demo_request": public_response.status_code,
            "ready": ready_response.json(),
            "mode": "testclient",
        }
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
