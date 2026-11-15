"""Shared fixtures. Tests marked as needing the real model FAIL (not skip) when artifacts are missing,
so a missing model can never be mistaken for a passing real-model verification."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.config import PROJECT_ROOT, Settings
from backend.main import create_app

MODELS_DIR = PROJECT_ROOT / "models"
REQUIRED_ARTIFACTS = ("model.joblib", "features.joblib", "metadata.json", "example_input.json", "example_output.json")


def _require_artifacts() -> None:
    missing = [n for n in REQUIRED_ARTIFACTS if not (MODELS_DIR / n).is_file()]
    if missing:
        pytest.fail(f"BLOCKED: real model artifacts missing from models/: {missing}", pytrace=False)


@pytest.fixture(scope="session")
def client() -> TestClient:
    """TestClient backed by the REAL saved model."""
    _require_artifacts()
    app = create_app(Settings(models_dir=MODELS_DIR))
    with TestClient(app) as c:
        assert app.state.service.is_ready, f"Real model failed to load: {app.state.service.load_error}"
        yield c


@pytest.fixture()
def unavailable_client(tmp_path: Path) -> TestClient:
    """TestClient whose models directory is empty -> model unavailable."""
    app = create_app(Settings(models_dir=tmp_path))
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def example_input() -> dict:
    _require_artifacts()
    return json.loads((MODELS_DIR / "example_input.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def example_output() -> dict:
    _require_artifacts()
    return json.loads((MODELS_DIR / "example_output.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def metadata() -> dict:
    _require_artifacts()
    return json.loads((MODELS_DIR / "metadata.json").read_text(encoding="utf-8"))
