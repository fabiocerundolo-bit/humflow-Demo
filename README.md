# humflow Demo — Documentazione Tecnica

> Piattaforma HR dimostrativa con analisi AI dei curricula, gestione candidati e workflow automatizzati.

---

## Indice

1. [Panoramica del Progetto](#1-panoramica-del-progetto)
2. [Stack Tecnologico](#2-stack-tecnologico)
3. [Architettura dei Servizi](#3-architettura-dei-servizi)
4. [Struttura del Repository](#4-struttura-del-repository)
5. [Prerequisiti](#5-prerequisiti)
6. [Installazione e Avvio](#6-installazione-e-avvio)
7. [Configurazione delle Variabili d'Ambiente](#7-configurazione-delle-variabili-dambiente)
8. [Porte e URL di Accesso](#8-porte-e-url-di-accesso)
9. [Componenti Principali](#9-componenti-principali)
   - [Backend (FastAPI)](#91-backend-fastapi)
   - [Frontend (React)](#92-frontend-react)
   - [Worker Celery](#93-worker-celery)
   - [Database PostgreSQL](#94-database-postgresql)
   - [Email Testing (MailHog)](#95-email-testing-mailhog)
10. [API Reference](#10-api-reference)
11. [Flusso di Analisi dei CV](#11-flusso-di-analisi-dei-cv)
12. [Utility e Script](#12-utility-e-script)
13. [Sviluppo e Comandi Utili](#13-sviluppo-e-comandi-utili)
14. [Bug Risolti (Bug Fix Report)](#14-bug-risolti-bug-fix-report)
15. [Sicurezza e Note per la Produzione](#15-sicurezza-e-note-per-la-produzione)
16. [Connessione a Database Esterno](#16-connessione-a-database-esterno)

---

## 1. Panoramica del Progetto

**FluxHR Demo** è un'applicazione fullstack pensata come ambiente dimostrativo per la gestione delle risorse umane. Il sistema permette di:

- **Caricare CV in formato PDF** e avviarne l'analisi automatica tramite AI
- **Gestire una dashboard candidati** con stati, statistiche e download dei documenti
- **Schedulare task asincroni** (es. pulizia dei candidati vecchi, notifiche email) tramite Celery
- **Testare i flussi email** senza inviare messaggi reali, grazie a MailHog

L'intero stack è containerizzato con Docker Compose, rendendolo avviabile con un singolo comando su qualsiasi macchina.

---

## 2. Stack Tecnologico

| Layer | Tecnologia | Versione |
|---|---|---|
| Frontend | React + TypeScript | — |
| Stile UI | Tailwind CSS | — |
| Package manager FE | Yarn | — |
| Backend | Python + FastAPI | — |
| Server ASGI | Uvicorn | — |
| Task Queue | Celery | — |
| Message Broker | Redis | — |
| Database | PostgreSQL | 16 |
| Email testing | MailHog | — |
| Containerizzazione | Docker + Docker Compose | >= 24 / >= 2.x |

**Linguaggi presenti nel repository (per quota):**

- Python — 54.6%
- TypeScript — 37.2%
- HTML — 7.1%
- CSS — 0.5%
- Dockerfile — 0.4%
- JavaScript — 0.2%

---

## 3. Architettura dei Servizi

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│    Backend       │────▶│   PostgreSQL     │
│  React :3000    │     │  FastAPI :8000   │     │     :5433        │
└─────────────────┘     └────────┬─────────┘     └──────────────────┘
                                 │
                        ┌────────┴─────────┐     ┌──────────────────┐
                        │   Worker         │────▶│     Redis        │
                        │  (Celery beat)   │     │     :6379        │
                        └──────────────────┘     └──────────────────┘
                                                  ┌──────────────────┐
                                                  │    MailHog       │
                                                  │  SMTP  :1025     │
                                                  │  UI    :8025     │
                                                  └──────────────────┘
```

Tutti i servizi comunicano sulla rete Docker interna `fluxhr-network`. L'unico punto di ingresso esposto all'host è il frontend sulla porta `3000` e le API sulla `8000`.

**Flusso dati principale:**

```
Utente → Frontend (React)
       → Backend (FastAPI) → PostgreSQL  (persistenza dati)
                           → Redis       (coda task Celery)
                           → MailHog     (invio email test)
       ← Celery Worker    ← Redis       (elaborazione task asincroni)
```

---

## 4. Struttura del Repository

```
humflow-Demo/
│
├── backend/                    # Applicazione Python/FastAPI
│   ├── app/
│   │   ├── main.py             # Entry point FastAPI / Uvicorn
│   │   ├── worker.py           # Definizione Celery app e task
│   │   ├── auth.py             # Logica autenticazione JWT
│   │   ├── database.py         # Configurazione SQLAlchemy / SessionLocal
│   │   └── models.py           # Modelli ORM (es. Candidate)
│   ├── celery_app.py           # Re-export dell'istanza Celery (compatibilità)
│   └── Dockerfile              # Immagine Docker del backend
│
├── frontend/                   # Applicazione React/TypeScript
│   └── src/
│       └── Login.tsx           # Schermata di login (credenziali demo)
│
├── campioni_cv/                # CV di esempio per test pipeline
│
├── .env.example                # Template variabili d'ambiente
├── .gitignore
├── BUGFIX_REPORT.md            # Report dettagliato dei bug corretti
├── docker-compose.yml          # Orchestrazione di tutti i servizi
├── start.sh                    # Script di avvio rapido
│
├── cv_sample.md                # CV di esempio in formato Markdown
├── cv_sample.pdf               # CV di esempio in formato PDF
├── cv_to_pdf.py                # Script di conversione CV Markdown → PDF
├── dashboard.html              # Prototipo statico HTML della dashboard
├── generate_europass_cvs.py    # Generatore di CV Europass di test
├── simulate_pipeline.py        # Script per simulare la pipeline di analisi CV
│
├── Log.txt                     # Log di build di riferimento
└── yarn.lock                   # Lock file dipendenze frontend
```

---

## 5. Prerequisiti

Prima di avviare il progetto, assicurarsi di avere installato:

- **Docker** >= 24.0 — [Guida all'installazione](https://docs.docker.com/get-docker/)
- **Docker Compose** >= 2.x (incluso in Docker Desktop)
- **Git**

Per lo sviluppo locale senza Docker (opzionale):
- Python >= 3.10
- Node.js >= 18 + Yarn
- PostgreSQL >= 16
- Redis

---

## 6. Installazione e Avvio

### Avvio rapido (consigliato)

```bash
# 1. Clona il repository
git clone https://github.com/fabiocerundolo-bit/humflow-Demo.git
cd humflow-Demo

# 2. (Opzionale) Copia e configura le variabili d'ambiente
cp .env.example .env
# Modifica .env secondo necessità

# 3. Avvia tutti i servizi
docker compose up --build
```

In alternativa, usa lo script di convenienza incluso:

```bash
chmod +x start.sh
./start.sh
```

Al **primo avvio**, Docker scaricherà le immagini base e installerà tutte le dipendenze. Questa operazione può richiedere alcuni minuti.

### Avvio in background (detached)

```bash
docker compose up --build -d
```

### Spegnimento

```bash
# Ferma i container
docker compose down

# Ferma i container e cancella anche i volumi (dati DB e upload)
docker compose down -v
```

---

## 7. Configurazione delle Variabili d'Ambiente

Le variabili sono definite in `docker-compose.yml`. Per personalizzarle, è sufficiente creare un file `.env` a partire dal template:

```bash
cp .env.example .env
```

| Variabile | Valore di default | Descrizione |
|---|---|---|
| `DATABASE_URL` | `postgresql://admin:password@db:5432/fluxhr` | Stringa di connessione PostgreSQL |
| `REDIS_URL` | `redis://redis:6379/0` | Stringa di connessione Redis |
| `SMTP_SERVER` | `mailhog` | Host SMTP (usa MailHog in demo) |
| `SMTP_PORT` | `1025` | Porta SMTP |
| `SMTP_USER` | — | Utente SMTP (per produzione) |
| `SMTP_PASSWORD` | — | Password SMTP (per produzione) |
| `SECRET_KEY` | `your-secret-key-change-in-production` | Chiave JWT — **cambiare in produzione** |
| `POSTGRES_USER` | `admin` | Utente del database |
| `POSTGRES_PASSWORD` | `password` | Password del database |
| `POSTGRES_DB` | `fluxhr` | Nome del database |

> **Attenzione:** Le credenziali predefinite sono adatte esclusivamente all'ambiente demo. Non devono mai essere utilizzate in produzione.

---

## 8. Porte e URL di Accesso

| Servizio | URL | Note |
|---|---|---|
| Frontend React | http://localhost:3000 | Interfaccia utente principale |
| Backend API | http://localhost:8000 | REST API |
| Swagger / Docs | http://localhost:8000/docs | Documentazione interattiva API |
| ReDoc | http://localhost:8000/redoc | Documentazione alternativa API |
| MailHog UI | http://localhost:8025 | Visualizzatore email di test |
| PostgreSQL | localhost:**5433** | Porta non-standard (evita conflitti con istanze locali) |
| Redis | interno | Non esposto all'host |

> **Nota sulla porta PostgreSQL:** La porta è `5433` (anziché la standard `5432`) per evitare conflitti con eventuali istanze PostgreSQL già in esecuzione sulla macchina host.

---

## 9. Componenti Principali

### 9.1 Backend (FastAPI)

**File principale:** `backend/app/main.py`

Il backend espone un'API REST costruita con **FastAPI** e servita da **Uvicorn**. Le funzionalità principali includono:

- **Autenticazione JWT** — login con generazione token, middleware di protezione degli endpoint
- **Upload CV** — ricezione file PDF, salvataggio su volume condiviso, avvio task Celery
- **Gestione candidati** — CRUD completo sullo stato dei candidati (es. in review, approvato, rifiutato)
- **Download CV** — endpoint protetto da autenticazione per scaricare i file caricati
- **Dashboard stats** — endpoint `/stats` che restituisce statistiche aggregate (es. distribuzione per stato)

**Endpoint principali:**

| Metodo | Path | Descrizione |
|---|---|---|
| `POST` | `/auth/login` | Login e generazione token JWT |
| `GET` | `/candidates` | Lista candidati |
| `POST` | `/candidates/upload` | Upload CV (PDF) |
| `GET` | `/candidates/{id}` | Dettaglio candidato |
| `PATCH` | `/candidates/{id}/status` | Aggiornamento stato candidato |
| `GET` | `/candidates/{id}/download` | Download CV (richiede auth) |
| `GET` | `/stats` | Statistiche dashboard |

La documentazione interattiva completa è disponibile su http://localhost:8000/docs (Swagger UI).

### 9.2 Frontend (React)

**Directory:** `frontend/src/`

Il frontend è sviluppato in **React con TypeScript** e utilizza **Tailwind CSS** per lo stile. Il package manager è **Yarn**.

La schermata di login (`Login.tsx`) mostra le credenziali demo all'utente:

- **Username:** `admin`
- **Password:** `password`

Il frontend si connette al backend tramite chiamate REST e aggiorna la dashboard in tempo reale.

**Hot-reload in Docker:** Il frontend usa `CHOKIDAR_USEPOLLING=true` per garantire il corretto funzionamento del live reload in ambienti Docker su macOS e Windows (dove il filesystem notifying è limitato).

### 9.3 Worker Celery

**File principale:** `backend/app/worker.py`

Il worker Celery gestisce i **task asincroni** e la **schedulazione periodica** (beat schedule). Un'unica istanza `celery_app` è definita in `app/worker.py`; il file `backend/celery_app.py` la ri-esporta per compatibilità.

**Task disponibili:**

| Task | Descrizione |
|---|---|
| `send_art14_email_task` | Invio email ai candidati (art. 14 GDPR o simili) |
| `delete_old_candidates` | Pulizia periodica dei candidati scaduti/obsoleti |

**Broker e backend:** Redis (`redis://redis:6379/0`)

**Volume condiviso:** Il volume `uploads_data` è montato sia sul container `backend` che su `worker`, permettendo al worker di accedere ai file CV caricati per l'elaborazione.

### 9.4 Database PostgreSQL

**Versione:** PostgreSQL 16

Il database persiste i dati dei candidati e degli utenti. La connessione è gestita tramite **SQLAlchemy** (ORM), configurata in `backend/app/database.py`.

**Modelli principali** (definiti in `backend/app/models.py`):
- `Candidate` — dati del candidato, percorso del CV, stato attuale
- (eventualmente) `User` — utenti autenticati

Il volume Docker `postgres_data` mantiene i dati tra un riavvio e l'altro.

### 9.5 Email Testing (MailHog)

**MailHog** intercetta tutte le email inviate dall'applicazione tramite SMTP sulla porta `1025`. Nessun messaggio viene recapitato a indirizzi reali.

L'interfaccia web di MailHog è accessibile su http://localhost:8025 e permette di visualizzare, ispezionare e cancellare le email catturate durante i test.

---

## 10. API Reference

La documentazione completa e interattiva delle API è disponibile via Swagger UI all'indirizzo:

```
http://localhost:8000/docs
```

### Autenticazione

Le API protette richiedono un token JWT nell'header HTTP:

```
Authorization: Bearer <token>
```

Il token si ottiene chiamando `POST /auth/login` con le credenziali:

```json
{
  "username": "admin",
  "password": "password"
}
```

### Esempio di upload CV

```bash
curl -X POST http://localhost:8000/candidates/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/percorso/del/cv.pdf"
```

### Esempio di aggiornamento stato

```bash
curl -X PATCH http://localhost:8000/candidates/1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

---

## 11. Flusso di Analisi dei CV

```
1. L'utente carica un CV (PDF) via frontend
        │
        ▼
2. Il backend (FastAPI) riceve il file
   - Salva il PDF nel volume condiviso uploads_data
   - Crea il record Candidate nel database (stato: "pending")
   - Invia il task `send_art14_email_task` alla coda Redis
        │
        ▼
3. Il worker Celery preleva il task da Redis
   - Elabora il CV (analisi AI / estrazione testo)
   - Aggiorna lo stato del candidato nel database
   - Invia la notifica email via MailHog
        │
        ▼
4. La dashboard React mostra il candidato aggiornato
   - L'HR può aggiornare manualmente lo stato
   - Può scaricare il CV originale (endpoint protetto)
```

---

## 12. Utility e Script

### `cv_to_pdf.py`

Converte un CV in formato Markdown (`cv_sample.md`) in PDF (`cv_sample.pdf`).

```bash
python cv_to_pdf.py
```

### `generate_europass_cvs.py`

Genera CV di test in formato Europass per popolare l'ambiente demo con dati realistici.

```bash
python generate_europass_cvs.py
```

### `simulate_pipeline.py`

Simula l'intera pipeline di analisi CV senza dover passare per il frontend. Utile per testare il backend e il worker in isolamento.

```bash
python simulate_pipeline.py
```

### `start.sh`

Script shell di avvio rapido. Imposta i permessi necessari e lancia `docker compose up --build`.

```bash
chmod +x start.sh
./start.sh
```

### `dashboard.html`

Prototipo statico HTML della dashboard, utile per revisioni di design senza avviare l'intero stack.

---

## 13. Sviluppo e Comandi Utili

### Ricostruire un singolo servizio

```bash
docker compose up --build backend
docker compose up --build frontend
docker compose up --build worker
```

### Visualizzare i log in tempo reale

```bash
# Tutti i servizi
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo worker
docker compose logs -f worker
```

### Accedere alla shell di un container

```bash
docker compose exec backend bash
docker compose exec frontend sh
docker compose exec db psql -U admin -d fluxhr
```

### Eseguire le migrazioni del database (se applicabile)

```bash
docker compose exec backend alembic upgrade head
```

### Monitorare i task Celery

```bash
docker compose exec worker celery -A app.worker inspect active
docker compose exec worker celery -A app.worker inspect scheduled
```

---

## 14. Bug Risolti (Bug Fix Report)

Nella fase di sviluppo demo sono stati identificati e risolti i seguenti bug. Il report completo è disponibile in `BUGFIX_REPORT.md`.

### Bug Critici (bloccanti)

| # | File | Problema | Fix |
|---|---|---|---|
| 1 | `backend/app/main.py` | Classe `StatusUpdate` definita due volte — Python sovrascriveva silenziosamente la prima | Rimossa la definizione duplicata |
| 2 | `backend/app/main.py` | Import Celery con nome errato (`send_art14_email` invece di `send_art14_email_task`) — causava `ImportError` ad ogni upload | Corretto il nome della funzione importata |
| 3 | `backend/app/main.py` | Risposta di errore dell'endpoint `/stats` mancante del campo `status_pie` — `ValidationError` Pydantic anche nel fallback | Aggiunto `"status_pie": []` al dizionario di fallback |
| 4 | `backend/celery_app.py` | Import assoluti errati in `celery_app.py` — `ModuleNotFoundError` all'avvio del worker | Consolidato in `app/worker.py` con import relativi corretti |
| 5 | `worker.py` + `celery_app.py` | Due istanze Celery separate e disconnesse — i task non erano visibili tra le istanze | Unica istanza in `app/worker.py`; `celery_app.py` la ri-esporta |
| 6 | `backend/Dockerfile` | `CMD` puntava a `main:app` invece di `app.main:app` — falliva senza volume bind mount | Corretto il modulo in `app.main:app` |

### Bug di Sicurezza

| # | File | Problema | Fix |
|---|---|---|---|
| 7 | `backend/app/main.py` | Endpoint `/candidates/{id}/download` senza autenticazione — chiunque poteva scaricare qualsiasi CV | Aggiunto `Depends(get_current_user)` |
| 8 | `backend/app/auth.py` | `SECRET_KEY` JWT hardcoded nel codice | Caricata da variabile d'ambiente con `os.getenv` |

### Bug UX / Minori

| # | File | Problema | Fix |
|---|---|---|---|
| 9 | `frontend/src/Login.tsx` | Credenziali demo mostrate all'utente errate (`fluxhr2025` invece di `password`) | Corretto il suggerimento in `admin / password` |

---

## 15. Sicurezza e Note per la Produzione

> Questo progetto è un **ambiente demo**. Prima di un deployment in produzione è necessario:

1. **Cambiare tutte le credenziali** — sostituire username/password PostgreSQL, `SECRET_KEY` JWT e password admin
2. **Usare un file `.env`** con variabili d'ambiente sicure, mai committato in VCS
3. **Configurare SMTP reale** — sostituire MailHog con un provider SMTP (Gmail, SendGrid, SES, ecc.)
4. **Rimuovere `--reload`** da Uvicorn in produzione (rischio performance e sicurezza)
5. **Aggiungere HTTPS** — configurare un reverse proxy (Nginx, Traefik) con certificato TLS
6. **Rivedere i permessi CORS** — limitare le origini consentite nel backend FastAPI
7. **Gestire i volumi** — usare storage persistente e con backup per `postgres_data` e `uploads_data`

---

## 16. Connessione a Database Esterno

Per puntare a un'istanza PostgreSQL esterna (anziché il container Docker):

```bash
# 1. Copia il file di esempio
cp .env.example .env

# 2. Modifica DATABASE_URL nel file .env
DATABASE_URL=postgresql://tuo_utente:tua_password@host_reale:5432/nome_db

# 3. (Opzionale) Configura SMTP reale
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tua.email@gmail.com
SMTP_PASSWORD=app_password

# 4. Avvia solo i servizi necessari (senza il container db)
docker compose up backend worker frontend
```

La variabile `DATABASE_URL` viene caricata automaticamente da `python-dotenv` se il file `.env` è presente, oppure iniettata direttamente da Docker Compose tramite la sezione `environment`.

---

*Documentazione generata per il progetto [humflow-Demo](https://github.com/fabiocerundolo-bit/humflow-Demo) — FluxHR Demo.*
