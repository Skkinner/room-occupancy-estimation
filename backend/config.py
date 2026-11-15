"""Runtime configuration, read from environment variables (see ../.env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_VERSION = "1.0.0"

DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


def _split_origins(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    return tuple(o.strip().rstrip("/") for o in raw.split(",") if o.strip())


@dataclass(frozen=True)
class Settings:
    models_dir: Path = PROJECT_ROOT / "models"
    cors_origins: tuple[str, ...] = field(default=DEFAULT_CORS_ORIGINS)
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> "Settings":
        models_dir = os.getenv("OCCUPANCY_MODELS_DIR")
        path = Path(models_dir) if models_dir else PROJECT_ROOT / "models"
        if not path.is_absolute():
            # Relative paths are resolved against the project root, never the CWD.
            path = PROJECT_ROOT / path
        extra = _split_origins(os.getenv("OCCUPANCY_CORS_ORIGINS"))
        origins = tuple(dict.fromkeys(DEFAULT_CORS_ORIGINS + extra))
        return cls(
            models_dir=path.resolve(),
            cors_origins=origins,
            log_level=os.getenv("OCCUPANCY_LOG_LEVEL", "INFO").upper(),
        )
