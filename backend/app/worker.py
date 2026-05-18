"""
worker.py — Celery worker per FluxHR.
Contiene:
  - ingest_emails_task: polling mailhog ogni 30s per i CV in arrivo via email
  - send_art14_email_task: invio email GDPR Art.14 al candidato
  - delete_old_candidates: pulizia automatica (retention 6 mesi) alle 02:00 UTC

BUG #4 FIXED: il vecchio celery_app.py (root-level) usava import assoluti
  `from database import ...` e `Candidate` che fallivano dentro il package app/.
  Quel file e' stato integrato qui con gli import corretti.

BUG #5 FIXED: esistevano due istanze Celery separate (worker.py e celery_app.py)
  con beat schedule diverse e non coordinate. Ora c'e' un'unica istanza.
"""

import os
import base64
import smtplib
import requests
from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.message import EmailMessage

from .database import SessionLocal
from .models import Candidate
from .cv_processor import process_cv_file
from .templates.gdpr_email import get_art14_html

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery("fluxhr", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.beat_schedule = {
    "ingest-every-30s": {
        "task": "app.worker.ingest_emails_task",
        "schedule": 30.0,
    },
    "delete-old-candidates": {
        "task": "app.worker.delete_old_candidates",
        "schedule": crontab(hour=2, minute=0),
    },
}
celery_app.conf.timezone = "UTC"


@celery_app.task(name="app.worker.ingest_emails_task")
def ingest_emails_task():
    """Polling MailHog: raccoglie CV allegati alle email e li processa."""
    try:
        response = requests.get("http://mailhog:8025/api/v2/messages", timeout=10)
        messages = response.json().get("items", [])
        db = SessionLocal()
        for msg in messages:
            if "MIME" in msg and "Parts" in msg["MIME"]:
                for part in msg["MIME"]["Parts"]:
                    content_disp = part.get("Headers", {}).get("Content-Disposition", [""])[0]
                    if "filename=" in content_disp:
                        filename = content_disp.split("filename=")[1].strip('"')
                        if filename.endswith((".pdf", ".docx")):
                            body_raw = part.get("Body", "")
                            try:
                                file_bytes = base64.b64decode(body_raw)
                            except Exception:
                                file_bytes = body_raw.encode()

                            candidate = process_cv_file(file_bytes, filename, db)
                            send_art14_email_task.delay(candidate.email, candidate.name)
                            requests.delete(f"http://mailhog:8025/api/v1/messages/{msg['ID']}")
        db.close()
    except Exception as e:
        print(f"Worker Error (ingest_emails_task): {e}")


@celery_app.task(name="app.worker.send_art14_email_task")
def send_art14_email_task(email_dest: str, name: str = "Candidato"):
    """Invia email HTML Art.14 GDPR al candidato."""
    SMTP_SERVER = os.getenv("SMTP_SERVER", "mailhog")
    SMTP_PORT = int(os.getenv("SMTP_PORT", 1025))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    FROM_EMAIL = os.getenv("FROM_EMAIL", "privacy@fluxhr.com")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "📌 Conferma Ricezione CV - FluxHR"
    msg["From"] = f"FluxHR Privacy <{FROM_EMAIL}>"
    msg["To"] = email_dest

    html_content = get_art14_html(name)
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            if SMTP_SERVER != "mailhog":
                server.starttls()
                if SMTP_USER and SMTP_PASSWORD:
                    server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[Celery] Email Art.14 inviata a {email_dest}")
        return True
    except Exception as e:
        print(f"[Celery] ERRORE invio email: {e}")
        return False


@celery_app.task(name="app.worker.delete_old_candidates")
def delete_old_candidates():
    """Retention GDPR: elimina candidati inseriti più di 6 mesi fa."""
    # BUG #4 FIXED: il vecchio celery_app.py usava `from database import ...`
    # (import assoluto) che falliva. Gli import corretti sono gia' in testa al file.
    db = SessionLocal()
    try:
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        deleted = (
            db.query(Candidate)
            .filter(Candidate.created_at < six_months_ago)
            .delete()
        )
        db.commit()
        print(f"[Retention] Eliminati {deleted} candidati con dati scaduti")
        return deleted
    except Exception as e:
        db.rollback()
        print(f"[Retention] ERRORE: {e}")
        raise
    finally:
        db.close()
