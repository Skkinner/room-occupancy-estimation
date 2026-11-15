import joblib

from backend.tests.conftest import MODELS_DIR


def test_schema_returns_16_ordered_features_matching_artifacts(client, metadata):
    r = client.get("/schema")
    assert r.status_code == 200
    body = r.json()
    saved = [str(f) for f in joblib.load(MODELS_DIR / "features.joblib")]
    assert body["features"] == saved
    assert body["n_features"] == 16 == len(body["features"])
    assert body["features"] == metadata["features"]


def test_schema_matches_pipeline_feature_names(client):
    model = joblib.load(MODELS_DIR / "model.joblib")
    assert list(model.feature_names_in_) == client.get("/schema").json()["features"]


def test_schema_classes_and_identity(client):
    body = client.get("/schema").json()
    assert body["classes"] == [0, 1, 2, 3]
    assert body["target"] == "Room_Occupancy_Count"
    assert body["model"] == "Logistic Regression"
    assert body["model_id"].startswith("logreg-featureC-")
    assert body["api_version"]
    assert body["probabilities_calibrated"] is False


def test_schema_503_when_model_unavailable(unavailable_client):
    r = unavailable_client.get("/schema")
    assert r.status_code == 503
    assert "features" not in r.json()
