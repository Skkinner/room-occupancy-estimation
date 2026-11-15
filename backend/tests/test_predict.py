import math

import pytest

from backend.schemas import FEATURE_ORDER

BANNED_KEYS = {"safe", "is_safe", "clear", "cleared", "is_clear", "evacuated", "is_evacuated", "empty", "is_empty", "verified"}


# ------------------------------------------------------------------ valid input
def test_valid_input_returns_prediction(client, example_input):
    r = client.post("/predict", json=example_input)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["estimated_count"] in (0, 1, 2, 3)
    assert body["estimated_occupied"] is (body["estimated_count"] > 0)
    assert set(body["probabilities"]) == {"0", "1", "2", "3"}
    probs = list(body["probabilities"].values())
    assert all(math.isfinite(p) and 0.0 <= p <= 1.0 for p in probs)
    assert sum(probs) == pytest.approx(1.0, abs=1e-6)
    assert body["model"] == "Logistic Regression"
    assert body["mode"] == "research_demo"


def test_integer_values_are_accepted(client, example_input):
    payload = {k: int(round(v)) for k, v in example_input.items()}
    assert client.post("/predict", json=payload).status_code == 200


def test_predicted_class_is_argmax_of_probabilities(client, example_input):
    body = client.post("/predict", json=example_input).json()
    best = max(body["probabilities"], key=body["probabilities"].get)
    assert int(best) == body["estimated_count"]


# ------------------------------------------------------------- notebook check
def test_matches_notebook_example_output(client, example_input, example_output):
    """The API must reproduce the notebook's saved prediction for the saved example input."""
    body = client.post("/predict", json=example_input).json()
    assert body["estimated_count"] == example_output["count"]
    assert body["estimated_occupied"] == example_output["occupied"]
    for cls, expected in example_output["probabilities"].items():
        # example_output.json stores probabilities rounded to 4 decimals.
        assert body["probabilities"][cls] == pytest.approx(expected, abs=1e-3), cls


# ------------------------------------------------------------- invalid input
@pytest.mark.parametrize("missing", ["S1_Temp", "S5_CO2_Slope", "S7_PIR"])
def test_missing_feature_is_422(client, example_input, missing):
    payload = {k: v for k, v in example_input.items() if k != missing}
    r = client.post("/predict", json=payload)
    assert r.status_code == 422
    assert any(missing in e["loc"] for e in r.json()["detail"])


@pytest.mark.parametrize("bad", ["12.5", "abc", None, True, [1], {"v": 1}])
def test_invalid_types_rejected(client, example_input, bad):
    payload = dict(example_input, S1_Light=bad)
    assert client.post("/predict", json=payload).status_code == 422


@pytest.mark.parametrize("raw", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_values_rejected(client, example_input, raw):
    # Python's json accepts NaN/Infinity literals, so send them raw.
    body = "{" + ",".join(f'"{k}": {raw if k == "S5_CO2" else v}' for k, v in example_input.items()) + "}"
    r = client.post("/predict", content=body, headers={"Content-Type": "application/json"})
    assert r.status_code == 422


def test_unknown_field_rejected(client, example_input):
    r = client.post("/predict", json=dict(example_input, S8_Humidity=40))
    assert r.status_code == 422


def test_frontend_legacy_envelope_rejected(client, example_input):
    """The old {room_id, source, sensors} envelope is not accepted — only the 16 flat features."""
    r = client.post("/predict", json={"room_id": "A101", "source": "simulated", "sensors": example_input})
    assert r.status_code == 422


def test_malformed_json_is_422(client):
    r = client.post("/predict", content="{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422


def test_feature_order_does_not_matter_in_json(client, example_input):
    reversed_payload = {k: example_input[k] for k in reversed(FEATURE_ORDER)}
    a = client.post("/predict", json=example_input).json()
    b = client.post("/predict", json=reversed_payload).json()
    assert a["probabilities"] == b["probabilities"]


# ---------------------------------------------------------------------- safety
def test_prediction_never_marks_room_safe(client, example_input):
    # Force a likely "0" estimate: lights off, quiet, no motion, flat CO2.
    empty_like = dict(example_input, S1_Light=0, S2_Light=0, S3_Light=0, S4_Light=0,
                      S1_Sound=0.05, S2_Sound=0.05, S3_Sound=0.05, S4_Sound=0.05,
                      S5_CO2_Slope=0, S6_PIR=0, S7_PIR=0)
    for payload in (example_input, empty_like):
        body = client.post("/predict", json=payload).json()
        assert body["requires_manual_verification"] is True
        assert body["safety_status"] == "UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION"
        assert not (set(k.lower() for k in body) & BANNED_KEYS), body.keys()
        assert body["safety_status"] not in ("SAFE", "CLEAR", "CLEARED", "EVACUATED", "VERIFIED")
        assert "cannot establish that a room is empty" in body["safety_notice"]


def test_zero_estimate_still_requires_verification(client, example_input):
    empty_like = {k: 0 for k in example_input}
    empty_like.update(S1_Temp=24, S2_Temp=24, S3_Temp=24, S4_Temp=24, S5_CO2=380)
    body = client.post("/predict", json=empty_like).json()
    assert body["estimated_count"] == 0, "precondition: this reading should be estimated as 0"
    assert body["estimated_occupied"] is False
    assert body["requires_manual_verification"] is True
    assert body["safety_status"] == "UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION"


def test_unavailable_model_returns_503_without_prediction(unavailable_client):
    payload = {k: 1.0 for k in FEATURE_ORDER}
    r = unavailable_client.post("/predict", json=payload)
    assert r.status_code == 503
    body = r.json()
    assert "estimated_count" not in body and "probabilities" not in body


def test_inference_failure_is_controlled_500(client, example_input, monkeypatch):
    service = client.app.state.service

    def boom(_frame):
        raise ValueError("internal detail /secret/path")

    monkeypatch.setattr(service.model, "predict", boom)
    r = client.post("/predict", json=example_input)
    assert r.status_code == 500
    assert r.json() == {"detail": "Inference failed. No prediction was made."}
    assert "secret" not in r.text
