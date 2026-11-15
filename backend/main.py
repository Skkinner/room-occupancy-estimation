"""FastAPI backend for "Is Anyone There?" — RESEARCH DEMO, NOT FOR LIFE-SAFETY DECISIONS.

Run from the project root:
    python -m uvicorn backend.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import API_VERSION, Settings
from backend.schemas import (
    ErrorResponse,
    HealthResponse,
    PredictionResponse,
    SchemaResponse,
    SensorReading,
)
from backend.services.prediction import (
    EXPECTED_CLASSES,
    TARGET,
    InferenceError,
    ModelUnavailableError,
    PredictionService,
)

logger = logging.getLogger("occupancy.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    service = PredictionService(settings.models_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        service.load()
        yield

    app = FastAPI(
        title="Is Anyone There? — Occupancy Research API",
        version=API_VERSION,
        description=(
            "RESEARCH DEMO — NOT FOR LIFE-SAFETY DECISIONS. Serves a Logistic Regression occupancy "
            "estimator trained on one room (UCI #864). In a later January evaluation it missed ~62.59% "
            "of occupied readings. Predictions never mark a room empty, safe, or evacuated."
        ),
        lifespan=lifespan,
    )
    app.state.service = service
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        # Local development on ANY port (Vite moves to 5174+ when 5173 is busy). Still local-only.
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d{1,5})?$",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
        allow_credentials=False,
    )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Return field locations and messages only (no echoed internals).
        errors = [
            {"loc": [str(p) for p in e.get("loc", ())], "msg": e.get("msg", "invalid"), "type": e.get("type", "")}
            for e in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": errors})

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server error")
        return JSONResponse(status_code=500, content={"detail": "Internal server error."})

    @app.get("/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        """Liveness + model readiness. `model_loaded=false` means NO predictions will be served."""
        if service.is_ready:
            return HealthResponse(
                status="ok",
                model_loaded=True,
                model=service.model_name,
                model_id=service.model_id,
                n_features=len(service.features),
                api_version=API_VERSION,
            )
        return HealthResponse(
            status="model_unavailable",
            model_loaded=False,
            api_version=API_VERSION,
            detail=service.load_error,
        )

    @app.get(
        "/schema",
        response_model=SchemaResponse,
        responses={503: {"model": ErrorResponse}},
        tags=["model"],
    )
    def schema():
        """Ordered feature list (as used in training), target classes and model identity."""
        if not service.is_ready:
            return JSONResponse(status_code=503, content={"detail": "Model unavailable."})
        return SchemaResponse(
            features=list(service.features),
            n_features=len(service.features),
            target=TARGET,
            classes=list(EXPECTED_CLASSES),
            model=service.model_name,
            model_id=service.model_id or "",
            feature_set=str(service.metadata.get("feature_set", "C")),
            api_version=API_VERSION,
        )

    @app.post(
        "/predict",
        response_model=PredictionResponse,
        responses={422: {"description": "Invalid sensor input"}, 503: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
        tags=["model"],
    )
    def predict(reading: SensorReading):
        """Estimate occupancy from exactly 16 sensor values.

        The result is advisory research output: `requires_manual_verification` is always true and
        the safety status is always UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION.
        """
        try:
            result = service.predict(reading.model_dump())
        except ModelUnavailableError:
            return JSONResponse(status_code=503, content={"detail": "Model unavailable. No prediction was made."})
        except InferenceError:
            return JSONResponse(status_code=500, content={"detail": "Inference failed. No prediction was made."})
        return PredictionResponse(
            estimated_count=result.estimated_count,
            estimated_occupied=result.estimated_count > 0,
            probabilities=result.probabilities,
            model=service.model_name,
            timestamp=service.now_iso(),
        )

    return app


app = create_app()
