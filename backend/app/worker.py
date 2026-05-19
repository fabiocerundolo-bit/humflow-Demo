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
    """Polling MailHog con paginazione, error handling per singolo messaggio e decoding robusto."""
    try:
        limit = 100   # quanti messaggi per pagina
        start = 0
        processed = 0

        while True:
            url = f"http://mailhog:8025/api/v2/messages?limit={limit}&start={start}"
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                print(f"MailHog API error: {response.status_code}")
                break

            data = response.json()
            messages = data.get("items", [])
            if not messages:
                break   # nessun altro messaggio

            for msg in messages:
                # Estrai l'ID del messaggio (MailHog usa "ID" in maiuscolo nella v2)
                msg_id = msg.get("ID")
                if not msg_id:
                    continue

                # Crea una sessione DB fresca per ogni CV
                db = SessionLocal()
                try:
                    # Cerca allegati
                    mime = msg.get("MIME", {})
                    parts = mime.get("Parts", [])
                    found = False

                    for part in parts:
                        headers = part.get("Headers", {})
                        content_disposition = headers.get("Content-Disposition", [""])[0]
                        if "filename=" in content_disposition:
                            filename = content_disposition.split("filename=")[1].strip('"')
                            if filename.endswith((".pdf", ".docx")):
                                # Decodifica robusta del body
                                body = part.get("Body", "")
                                transfer_encoding = headers.get("Content-Transfer-Encoding", [""])[0].lower()
                                file_bytes = None

                                if transfer_encoding == "base64":
                                    try:
                                        file_bytes = base64.b64decode(body)
                                    except Exception as e:
                                        print(f"Errore decodifica base64 per {filename}: {e}")
                                        continue
                                else:
                                    # Assume plain text (ma per file binari non funziona, meglio tentare base64 comunque)
                                    try:
                                        file_bytes = base64.b64decode(body)
                                    except:
                                        file_bytes = body.encode()

                                if file_bytes:
                                    # Processa il CV
                                    candidate = process_cv_file(file_bytes, filename, db)
                                    # Invia email GDPR in background (già dentro process_cv_file? no, lo facciamo qui)
                                    send_art14_email_task.delay(candidate.email, candidate.name or "Candidato")
                                    found = True
                                    break   # esci dai parts, abbiamo già preso l'allegato

                    if found:
                        # Elimina il messaggio solo se processato con successo
                        requests.delete(f"http://mailhog:8025/api/v1/messages/{msg_id}")
                        processed += 1
                    else:
                        print(f"Nessun allegato CV in messaggio {msg_id}")

                except Exception as e:
                    print(f"ERRORE processando messaggio {msg_id}: {e}")
                    # Non cancellare il messaggio in caso di errore, verrà ripreso al prossimo polling
                finally:
                    db.close()

            # Passa alla pagina successiva se il numero di messaggi è uguale al limite
            if len(messages) < limit:
                break
            start += limit

        print(f"Worker: elaborati {processed} nuovi CV")

    except Exception as e:
        print(f"Errore grave in ingest_emails_task: {e}")


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
