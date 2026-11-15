"""Request/response models for the research-demo API.

The 16 Feature Set C sensor fields are declared explicitly so the OpenAPI docs are useful.
At startup the service verifies that this list is IDENTICAL (names and order) to the saved
`features.joblib` and to the pipeline's `feature_names_in_`; otherwise the model is reported
unavailable and no predictions are served.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

FEATURE_ORDER: tuple[str, ...] = (
    "S1_Temp",
    "S2_Temp",
    "S3_Temp",
    "S4_Temp",
    "S1_Light",
    "S2_Light",
    "S3_Light",
    "S4_Light",
    "S1_Sound",
    "S2_Sound",
    "S3_Sound",
    "S4_Sound",
    "S5_CO2",
    "S5_CO2_Slope",
    "S6_PIR",
    "S7_PIR",
)

SAFETY_NOTICE = (
    "Research demo. AI predictions cannot establish that a room is empty, safe, or evacuated. "
    "Every room requires physical verification under the site's official procedures."
)
SAFETY_STATUS = "UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION"

# JSON numbers only: strings and booleans are rejected; NaN/Infinity are rejected.
SensorValue = Annotated[float, Field(strict=True, allow_inf_nan=False)]


class SensorReading(BaseModel):
    """Exactly the 16 Feature Set C sensor values. Unknown fields are rejected (HTTP 422)."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "S1_Temp": 24.94, "S2_Temp": 24.75, "S3_Temp": 24.56, "S4_Temp": 25.38,
                "S1_Light": 121, "S2_Light": 34, "S3_Light": 53, "S4_Light": 40,
                "S1_Sound": 0.08, "S2_Sound": 0.19, "S3_Sound": 0.06, "S4_Sound": 0.06,
                "S5_CO2": 390, "S5_CO2_Slope": 0.769230769231, "S6_PIR": 0, "S7_PIR": 0,
            }
        },
    )

    S1_Temp: SensorValue
    S2_Temp: SensorValue
    S3_Temp: SensorValue
    S4_Temp: SensorValue
    S1_Light: SensorValue
    S2_Light: SensorValue
    S3_Light: SensorValue
    S4_Light: SensorValue
    S1_Sound: SensorValue
    S2_Sound: SensorValue
    S3_Sound: SensorValue
    S4_Sound: SensorValue
    S5_CO2: SensorValue
    S5_CO2_Slope: SensorValue
    S6_PIR: SensorValue
    S7_PIR: SensorValue


class PredictionResponse(BaseModel):
    estimated_count: int = Field(ge=0, le=3, description="Model's estimated occupancy class (0–3).")
    estimated_occupied: bool
    probabilities: dict[str, float] = Field(
        description="Per-class predict_proba outputs. UNCALIBRATED model scores, not validated certainty."
    )
    model: str
    mode: Literal["research_demo"] = "research_demo"
    requires_manual_verification: Literal[True] = True
    safety_status: Literal["UNKNOWN_REQUIRES_PHYSICAL_VERIFICATION"] = SAFETY_STATUS
    safety_notice: str = SAFETY_NOTICE
    timestamp: str = Field(description="Server time (UTC) when the inference ran.")


class SchemaResponse(BaseModel):
    features: list[str]
    n_features: int
    target: str
    classes: list[int]
    model: str
    model_id: str
    feature_set: str
    api_version: str
    mode: Literal["research_demo"] = "research_demo"
    probabilities_calibrated: Literal[False] = False


class HealthResponse(BaseModel):
    status: Literal["ok", "model_unavailable"]
    model_loaded: bool
    model: str | None = None
    model_id: str | None = None
    n_features: int | None = None
    api_version: str
    mode: Literal["research_demo"] = "research_demo"
    detail: str | None = None


class ErrorResponse(BaseModel):
    detail: str
