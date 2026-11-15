from backend.config import Settings
from backend.main import create_app
from fastapi.testclient import TestClient


def test_health_ok_when_model_loaded(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["n_features"] == 16
    assert body["model"] == "Logistic Regression"
    assert body["mode"] == "research_demo"


def test_health_reports_model_unavailable(unavailable_client):
    r = unavailable_client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "model_unavailable"
    assert body["model_loaded"] is False
    assert "model.joblib" in body["detail"]


def test_health_does_not_leak_server_paths(tmp_path):
    app = create_app(Settings(models_dir=tmp_path))
    with TestClient(app) as c:
        detail = c.get("/health").json()["detail"]
    assert str(tmp_path) not in detail


def test_corrupt_model_reported_unavailable(tmp_path):
    for name in ("model.joblib", "features.joblib"):
        (tmp_path / name).write_bytes(b"not a pickle")
    (tmp_path / "metadata.json").write_text("{}", encoding="utf-8")
    app = create_app(Settings(models_dir=tmp_path))
    with TestClient(app) as c:
        body = c.get("/health").json()
    assert body["model_loaded"] is False
    assert body["detail"] == "Model artifacts could not be loaded."


def test_cors_allows_vite_dev_origin(client):
    r = client.options(
        "/predict",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_allows_other_local_dev_ports(client):
    for origin in ("http://localhost:5174", "http://127.0.0.1:4173"):
        r = client.get("/health", headers={"Origin": origin})
        assert r.headers.get("access-control-allow-origin") == origin


def test_cors_rejects_lookalike_origin(client):
    r = client.get("/health", headers={"Origin": "http://localhost.evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_cors_rejects_unknown_origin(client):
    r = client.get("/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers
