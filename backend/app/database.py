"""
database.py — Configurazione SQLAlchemy.

BUG #8 FIXED: aggiunto supporto python-dotenv per caricare DATABASE_URL
da un file .env, rendendo semplice il collegamento a un DB reale esterno
senza modificare il codice.

Per connettersi al DB reale:
  1. Copia .env.example in .env
  2. Imposta DATABASE_URL con le tue credenziali
  3. Avvia normalmente con docker-compose up
"""

import os
import time
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError

# Carica variabili da .env se presente (utile per sviluppo locale e DB reale)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv opzionale; in Docker le env sono iniettate direttamente

# L'URL del DB viene letto dall'environment.
# Dentro Docker Compose: DATABASE_URL=postgresql://admin:password@db:5432/fluxhr
# Per DB esterno: imposta DATABASE_URL nel file .env
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://admin:password@db:5432/fluxhr"
)

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from . import models  # noqa: F401 — necessario per registrare i modelli
    retries = 5
    while retries > 0:
        try:
            Base.metadata.create_all(bind=engine)
            print(f"✅ Database connesso: {SQLALCHEMY_DATABASE_URL.split('@')[-1]}")
            break
        except OperationalError:
            retries -= 1
            print(f"⏳ In attesa del database... ({retries} tentativi rimasti)")
            time.sleep(3)
    if retries == 0:
        print("❌ Impossibile connettersi al database dopo 5 tentativi")
