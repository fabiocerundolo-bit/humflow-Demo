# FluxHR — Bug Fix Report

## Bug trovati e corretti

### 🔴 Bug Critici (bloccanti)

#### BUG #1 — `StatusUpdate` duplicata in `main.py`
**File:** `backend/app/main.py`  
**Problema:** La classe `StatusUpdate` era definita due volte nello stesso file (righe ~23 e ~97). Python in produzione genera un `TypeError` o sovrascrive silenziosamente la prima definizione.  
**Fix:** Rimossa la definizione duplicata; ne esiste ora una sola.

---

#### BUG #2 — Import Celery con nome sbagliato in `main.py`
**File:** `backend/app/main.py`  
**Problema:** `from .worker import send_art14_email` — ma la funzione in `worker.py` si chiama `send_art14_email_task`. Ogni upload di un CV causava un `ImportError` immediato.  
**Fix:** Corretto in `from .worker import send_art14_email_task`.

---

#### BUG #3 — Risposta di errore di `/stats` non valida per Pydantic
**File:** `backend/app/main.py`  
**Problema:** Il blocco `except` dell'endpoint `/stats` ritornava un dict senza il campo `status_pie`, richiesto dal `response_model=DashboardStats`. Pydantic sollevava un `ValidationError` anche nel fallback, rendendo l'endpoint sempre rotto in caso di DB down.  
**Fix:** Aggiunto `"status_pie": []` al dizionario di fallback.

---

#### BUG #4 — Import assoluti errati in `celery_app.py` (root)
**File:** `backend/celery_app.py`  
**Problema:** Il task `delete_old_candidates` usava `from database import SessionLocal, Candidate` — import assoluto che fallisce perché il codice è nel package `app/`. Causava `ModuleNotFoundError` all'avvio del worker Celery beat.  
**Fix:** Consolidato in `app/worker.py` con gli import corretti (`from .database import SessionLocal`, `from .models import Candidate`).

---

#### BUG #5 — Due istanze Celery separate e disconnesse
**File:** `backend/app/worker.py` e `backend/celery_app.py`  
**Problema:** `worker.py` e `celery_app.py` creavano ciascuno la propria istanza `Celery(...)` con beat schedule diverse e non coordinate. I task registrati in un'istanza non erano visibili all'altra; il beat schedule era spezzato tra i due file.  
**Fix:** Unica istanza `celery_app` in `app/worker.py`; il file root `celery_app.py` ri-esporta da lì.

---

#### BUG #6 — `Dockerfile` punta al modulo sbagliato
**File:** `backend/Dockerfile`  
**Problema:** `CMD ["uvicorn", "main:app", ...]` — l'app è un package Python (`app/`) quindi il modulo corretto è `app.main`. Con il volume mount di Docker il server partiva per caso; senza di esso (es. in CI/CD o produzione senza bind mount) falliva con `ModuleNotFoundError`.  
**Fix:** `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]`

---

### 🟠 Bug di Sicurezza

#### BUG #7 — Endpoint `/candidates/{id}/download` senza autenticazione
**File:** `backend/app/main.py`  
**Problema:** L'endpoint di download dei CV non aveva il `Depends(get_current_user)`, permettendo a chiunque conoscesse un ID numerico di scaricare qualsiasi CV senza essere autenticato.  
**Fix:** Aggiunto `current_user=Depends(get_current_user)` alla firma.

---

#### BUG #8 — `SECRET_KEY` JWT hardcoded
**File:** `backend/app/auth.py`  
**Problema:** La chiave JWT era una stringa fissa nel codice, uguale in tutti gli ambienti.  
**Fix:** `SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")` — configurabile via `.env`.

---

### 🟡 Bug UX / Minori

#### BUG #9 — Password demo sbagliata in `Login.tsx`
**File:** `frontend/src/Login.tsx`  
**Problema:** Il suggerimento mostrava `"Credenziali demo: admin / fluxhr2025"` ma l'hash bcrypt in `auth.py` corrisponde a `"password"`, non `"fluxhr2025"`. Il login da `Login.tsx` sarebbe sempre fallito.  
**Fix:** Corretto il suggerimento in `admin / password`.

---

## Connessione al Database Reale

Per puntare a un PostgreSQL esterno invece del container Docker:

```bash
# 1. Copia il file di esempio
cp .env.example .env

# 2. Modifica DATABASE_URL nel file .env
DATABASE_URL=postgresql://tuo_utente:tua_password@host_reale:5432/nome_db

# 3. (Opzionale) Configura SMTP reale per le email
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tua.email@gmail.com
SMTP_PASSWORD=app_password

# 4. Avvia solo il backend (senza il container db)
docker-compose up backend worker frontend
```

La variabile `DATABASE_URL` viene caricata automaticamente da `python-dotenv` se il file `.env` è presente, oppure viene iniettata direttamente da Docker Compose tramite la sezione `environment`.
