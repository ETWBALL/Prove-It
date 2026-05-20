"""Uvicorn entry: ``uvicorn src.main:app`` (see apps/ml/dockerfile)."""
from src.serverSetup import app

__all__ = ["app"]
