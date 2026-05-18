"""
celery_app.py (root-level) — DEPRECATO.

BUG #4 & #5 FIXED: questo file creava una seconda istanza Celery separata
con import assoluti errati che causavano ModuleNotFoundError.

Tutto il codice Celery e' stato consolidato in app/worker.py,
che contiene l'unica istanza `celery_app` usata da docker-compose.

Questo file esporta semplicemente da worker per retrocompatibilita'.
"""
from app.worker import celery_app  # noqa: F401
