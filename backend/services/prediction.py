"""Loads the trained sklearn Pipeline and serves predictions.

Nothing here retrains, refits, or replaces the model. If any startup check fails, the service
stays in an explicit "unavailable" state and the API returns HTTP 503 — it never falls back to
fabricated predictions.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from backend.schemas import FEATURE_ORDER

logger = logging.getLogger("occupancy.prediction")

EXPECTED_CLASSES = (0, 1, 2, 3)
TARGET = "Room_Occupancy_Count"


class ModelUnavailableError(RuntimeError):
    """Raised when the model is not loaded or failed validation."""


class InferenceError(RuntimeError):
    """Raised when the loaded model fails during inference."""


@dataclass(frozen=True)
class Prediction:
    estimated_count: int
    probabilities: dict[str, float]


class PredictionService:
    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir
        self.model: Any = None
        self.features: tuple[str, ...] = ()
        self.metadata: dict[str, Any] = {}
        self.model_id: str | None = None
        self.load_error: str | None = None

    # ------------------------------------------------------------------ loading
    @property
    def is_ready(self) -> bool:
        return self.model is not None and self.load_error is None

    @property
    def model_name(self) -> str:
        return str(self.metadata.get("model", "Logistic Regression"))

    def load(self) -> None:
        """Load and validate artifacts. Never raises; records a client-safe error instead."""
        try:
            self._load_and_validate()
            self.load_error = None
            logger.info(
                "Model loaded: %s (%d features, classes %s, id %s)",
                self.model_name, len(self.features), list(EXPECTED_CLASSES), self.model_id,
            )
        except ModelUnavailableError as exc:
            self.model = None
            self.load_error = str(exc)
            logger.error("Model unavailable: %s", exc)
        except Exception:  # unexpected (corrupt file, version mismatch, ...)
            self.model = None
            self.load_error = "Model artifacts could not be loaded."
            logger.exception("Unexpected error while loading model artifacts from %s", self.models_dir)

    def _load_and_validate(self) -> None:
        model_path = self.models_dir / "model.joblib"
        features_path = self.models_dir / "features.joblib"
        metadata_path = self.models_dir / "metadata.json"
        for p in (model_path, features_path, metadata_path):
            if not p.is_file():
                # Client-facing message names the file only, not the server path.
                raise ModelUnavailableError(f"Required artifact '{p.name}' is missing.")

        # Only trusted, project-owned artifacts are loaded (joblib uses pickle).
        features = joblib.load(features_path)
        model = joblib.load(model_path)
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

        features = tuple(str(f) for f in list(features))
        if len(features) != 16:
            raise ModelUnavailableError(f"features.joblib lists {len(features)} features; expected 16.")
        if features != FEATURE_ORDER:
            raise ModelUnavailableError("features.joblib does not match the API's Feature Set C order.")
        meta_features = tuple(metadata.get("features", ()))
        if meta_features and meta_features != features:
            raise ModelUnavailableError("metadata.json feature list does not match features.joblib.")

        for attr in ("predict", "predict_proba"):
            if not callable(getattr(model, attr, None)):
                raise ModelUnavailableError(f"Model does not support {attr}().")

        names_in = getattr(model, "feature_names_in_", None)
        if names_in is not None and tuple(str(n) for n in names_in) != features:
            raise ModelUnavailableError("Pipeline feature_names_in_ does not match features.joblib order.")

        classes = tuple(int(c) for c in getattr(model, "classes_", ()))
        if classes != EXPECTED_CLASSES:
            raise ModelUnavailableError(f"Model classes {list(classes)} differ from expected {list(EXPECTED_CLASSES)}.")

        self.model = model
        self.features = features
        self.metadata = metadata
        self.model_id = "logreg-featureC-" + hashlib.sha256(model_path.read_bytes()).hexdigest()[:12]

    # ---------------------------------------------------------------- inference
    def predict(self, values: dict[str, float]) -> Prediction:
        if not self.is_ready:
            raise ModelUnavailableError(self.load_error or "Model is not loaded.")
        row = [[float(values[name]) for name in self.features]]
        frame = pd.DataFrame(row, columns=list(self.features))
        try:
            label = int(self.model.predict(frame)[0])
            proba = self.model.predict_proba(frame)[0]
        except Exception as exc:
            logger.exception("Inference failed")
            raise InferenceError("Inference failed.") from exc

        classes = [int(c) for c in self.model.classes_]
        probabilities = {str(c): float(p) for c, p in zip(classes, proba)}
        if label not in EXPECTED_CLASSES or not all(math.isfinite(p) for p in probabilities.values()):
            logger.error("Model produced an invalid output: label=%s probabilities=%s", label, probabilities)
            raise InferenceError("Model produced an invalid output.")
        return Prediction(estimated_count=label, probabilities=probabilities)

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")
