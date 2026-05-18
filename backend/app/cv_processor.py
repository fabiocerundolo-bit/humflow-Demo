import os
import uuid
import re
import io
import pdfplumber
import docx
from sqlalchemy.orm import Session
from .models import Candidate
from .gdpr_sanitize import sanitize_cv

UPLOAD_DIR = "/app/uploads/candidates"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- FUNZIONI DI SUPPORTO PER L'ESTRAZIONE ---

def extract_email(text: str) -> str:
    match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    return match.group(0) if match else None

def extract_phone(text: str) -> str:
    match = re.search(r'(\+?39\s?)?\d{3}[-\s]?\d{7,8}', text)
    if not match:
        match = re.search(r'(\+?\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4,}', text)
    return match.group(0) if match else None

def extract_name(text: str) -> str:
    """Cerca il nome nelle prime righe ignorando i titoli comuni"""
    noise = ["curriculum", "vitae", "europass", "profilo", "cv", "informazioni", "personali"]
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines[:5]:
        if not any(n in line.lower() for n in noise):
            if re.match(r'^([A-Z][a-zà-ÿ]+\s+[A-Z][a-zà-ÿ]+)', line):
                return line
    return None

def extract_skills(text: str) -> list:
    """Estrae le skill cercando parole chiave nel testo (Real-time tracking)"""
    keywords = [
        # Linguaggi di programmazione
        "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Ruby", "PHP", "Swift", 
        "Kotlin", "Go", "Rust", "R", "MATLAB", "SQL", "HTML", "CSS",

        # Framework e librerie
        "React", "Angular", "Vue.js", "Node.js", "Express.js", "Django", "Flask", 
        "Spring Boot", "ASP.NET", "Laravel", "Symfony", "Ruby on Rails", 
        "Next.js", "Nuxt.js", "jQuery", "Bootstrap", "Tailwind CSS", "Material-UI",
        "NumPy", "Pandas", "Scikit-learn", "TensorFlow", "PyTorch", "Keras", 
        "OpenCV", "Matplotlib", "Seaborn", "D3.js", "Chart.js",

        # Database
        "MySQL", "PostgreSQL", "MongoDB", "Oracle", "SQL Server", "SQLite", 
        "Redis", "MariaDB", "Cassandra", "Elasticsearch", "Firebase",

        # Cloud e DevOps
        "AWS", "Azure", "Google Cloud Platform", "GCP", "Docker", "Kubernetes", 
        "Terraform", "Ansible", "Jenkins", "Git", "GitHub", "GitLab", "Bitbucket",
        "CI/CD", "Microservices", "Serverless", "REST API", "GraphQL",

        # Strumenti e metodologie
        "Jira", "Trello", "Asana", "Confluence", "Agile", "Scrum", "Kanban", 
        "Lean", "Waterfall", "PRINCE2", "ITIL", "TOGAF",

        # Sistemi operativi
        "Windows", "Linux", "macOS", "Unix", "Android", "iOS",

        # Tool specifici
        "Figma", "Adobe XD", "Sketch", "Photoshop", "Illustrator", "InDesign",
        "Postman", "Swagger", "VsCode", "PyCharm", "IntelliJ", "Android Studio",
        "Excel", "PowerPoint", "Word", "Outlook",

        # Competenze soft (Italiano)
        "Problem Solving", "Teamwork", "Leadership", "Comunicazione", "Gestione del tempo",
        "Flessibilità", "Adattabilità", "Creatività", "Proattività", "Autonomia",
        "Precisione", "Affidabilità", "Gestione dello stress", "Negoziazione",
        "Mentoring", "Coaching", "Public Speaking", "Customer Service", "Customer Success",
        "Sales", "Marketing", "Sviluppo Business", "Project Management",
        "Gestione Progetti", "Analisi Dati", "Reporting", "Visualizzazione Dati",
        "Ricerca e Sviluppo", "Innovazione", "UX Writing", "Content Strategy"
    ]
    found_skills = []
    text_lower = text.lower()
    for kw in keywords:
        if re.search(r'\b' + re.escape(kw.lower()) + r'\b', text_lower):
            found_skills.append(kw)
    return list(set(found_skills))[:10]

# --- FUNZIONE PRINCIPALE RICHIESTA ---

def process_cv_file(contents: bytes, filename: str, db: Session, source_email=None):
    """
    Processa un file CV: Estrazione testo -> Sanitizzazione -> Estrazione Dati -> 
    Salvataggio File -> Salvataggio Database.
    """
    text = ""
    ext = os.path.splitext(filename)[1].lower()

    # 1. Estrazione del testo grezzo in base al formato
    try:
        if ext == '.pdf':
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                # Estraiamo testo da tutte le pagine
                text = "".join([page.extract_text() or "" for page in pdf.pages])
        elif ext == '.docx':
            doc = docx.Document(io.BytesIO(contents))
            text = "".join([para.text + "\n" for para in doc.paragraphs])
        else:
            raise ValueError(f"Formato file {ext} non supportato")
    except Exception as e:
        print(f"ERRORE ESTRAZIONE TESTO: {e}")
        text = "Testo non leggibile"

    # 2. Sanitizzazione GDPR (oscuramento dati sensibili)
    sanitized_text = sanitize_cv(text)

    # 3. Estrazione dati strutturati dal testo sanitizzato
    name = extract_name(text) # Cerchiamo il nome sul testo originale per precisione
    email = extract_email(text) or source_email or "unknown@example.com"
    phone = extract_phone(text)
    skills = extract_skills(text)

    # Fallback per il nome se non trovato nel testo
    if not name:
        name = os.path.splitext(filename)[0].replace('_', ' ').replace('-', ' ').title()

    # 4. Salvataggio fisico del file nel volume Docker
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    
    with open(file_path, "wb") as f:
        f.write(contents)

    # 5. Creazione record nel Database tramite SQLAlchemy
    candidate = Candidate(
        name=name,
        email=email,
        phone=phone,
        skills=skills, # Salvato come JSON
        status="new",
        cv_file_path=file_path
    )
    
    try:
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        print(f"✅ Candidato salvato: {name} ({email})")
    except Exception as e:
        db.rollback()
        print(f"❌ ERRORE DATABASE: {e}")
        raise e

    return candidate