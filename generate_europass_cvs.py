"""
generate_europass_cvs.py
Genera CV in formato Europass verosimili come PDF in modo CASUALE.

Uso:
    python generate_europass_cvs.py

Output: una cartella ./europass_cvs/ con un PDF per ogni candidato generato casualmente.
"""

import os
import random
from io import BytesIO
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import Flowable
from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Colori Europass ufficiali
# ---------------------------------------------------------------------------
BLUE_DARK   = colors.HexColor("#003399")   # intestazione
BLUE_MID    = colors.HexColor("#244AA5")   # sezioni
BLUE_LIGHT  = colors.HexColor("#E8EBF5")   # sfondo header
ORANGE      = colors.HexColor("#FF6600")   # accento (stella EU)
GREY_TEXT   = colors.HexColor("#444444")
GREY_LIGHT  = colors.HexColor("#F5F5F5")
GREY_LINE   = colors.HexColor("#CCCCCC")
WHITE       = colors.white
BLACK       = colors.black

W, H = A4
MARGIN_L = 20 * mm
MARGIN_R = 20 * mm
MARGIN_T = 15 * mm
MARGIN_B = 15 * mm

# ---------------------------------------------------------------------------
# DATI PER GENERAZIONE CASUALE
# ---------------------------------------------------------------------------
NOMI = ["Marco", "Giulia", "Luca", "Federica", "Alessandro", "Chiara", "Matteo", "Sara", "Andrea", "Valentina"]
COGNOMI = ["Rossi", "Bianchi", "Ferrari", "Russo", "Ferretti", "Morandi", "Conti", "Gallo", "Fontana", "Greco"]
CITTA_ITALIANE = ["Milano", "Roma", "Torino", "Napoli", "Bologna", "Firenze", "Palermo", "Genova", "Venezia", "Verona"]

RUOLI = [
    "Backend Developer", "Frontend Developer", "Full Stack Developer", 
    "UX/UI Designer", "Data Scientist", "DevOps Engineer", 
    "Product Manager", "Project Manager", "Software Architect", 
    "QA Engineer", "System Administrator"
]

AZIENDE = [
    "TechFlow S.r.l.", "Digital Solutions S.p.A.", "Innovate S.p.A.", 
    "DataMind S.r.l.", "CloudNine S.r.l.", "Pixelwave Studio", 
    "CreativeHub S.p.A.", "NextGen Tech", "SoftWorks Italia", 
    "Aurora Digital", "Nexus Solutions"
]

COMPETENZE_CATEGORIE = {
    "Linguaggi": ["Python", "JavaScript", "TypeScript", "Java", "C++", "Go", "Rust", "PHP", "Ruby", "SQL", "Bash"],
    "Framework": ["React", "Angular", "Vue.js", "Django", "FastAPI", "Spring Boot", "Express.js", "Flask", "Rails"],
    "Database": ["PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB", "Cassandra"],
    "Cloud/DevOps": ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions"],
    "Design": ["Figma", "Adobe XD", "Sketch", "Photoshop", "Illustrator", "InDesign"],
    "Data/ML": ["Pandas", "NumPy", "Scikit-learn", "TensorFlow", "PyTorch", "Tableau", "Power BI", "Spark"]
}

LINGUE = [
    ("Italiano", "Madrelingua"),
    ("Inglese", ["B1 — Intermedio", "B2 — Intermedio superiore", "C1 — Avanzato", "C2 — Padronanza"]),
    ("Francese", ["A1 — Base", "A2 — Elementare", "B1 — Intermedio", "B2 — Intermedio superiore"]),
    ("Tedesco", ["A1 — Base", "A2 — Elementare", "B1 — Intermedio", "B2 — Intermedio superiore"]),
    ("Spagnolo", ["A1 — Base", "A2 — Elementare", "B1 — Intermedio", "B2 — Intermedio superiore"]),
    ("Portoghese", ["A1 — Base", "A2 — Elementare", "B1 — Intermedio"]),
    ("Cinese", ["A1 — Base", "A2 — Elementare"])
]

CERTIFICAZIONI = [
    "AWS Certified Solutions Architect – Associate",
    "Certified Kubernetes Administrator (CKA)",
    "Professional Scrum Master I",
    "Certified Scrum Product Owner (CSPO)",
    "Google UX Design Certificate",
    "TensorFlow Developer Certificate",
    "Oracle Certified Professional, Java SE",
    "Microsoft Certified: Azure Developer Associate",
    "ISTQB Certified Tester",
    "CISSP – Certified Information Systems Security Professional"
]

POSSIBILI_TITOLI_STUDIO = [
    ("Laurea Magistrale in Informatica", "Politecnico di Milano"),
    ("Laurea Magistrale in Ingegneria Informatica", "Politecnico di Torino"),
    ("Laurea Magistrale in Data Science", "Università di Bologna"),
    ("Laurea Magistrale in Design della Comunicazione", "Politecnico di Milano"),
    ("Laurea in Economia e Management", "Università Bocconi"),
    ("Laurea in Matematica", "Università di Pisa"),
    ("Diploma di Maturità Scientifica", "Liceo Scientifico"),
]

# ---------------------------------------------------------------------------
# Funzioni di supporto per generare dati casuali
# ---------------------------------------------------------------------------
def random_date(start_year=2000, end_year=2024):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    return start + timedelta(days=random.randint(0, (end - start).days))

def format_date_range(months_before=0):
    """Genera un intervallo di date casuale (es. '09/2015 – 07/2018')"""
    if months_before == 0:
        start = random_date(2005, 2018)
    else:
        start = random_date(2015, 2020)
    end = start + timedelta(days=random.randint(365, 1095))  # 1-3 anni
    if end > datetime.now():
        end = datetime.now()
        a = "Presente"
    else:
        a = end.strftime("%m/%Y")
    return start.strftime("%m/%Y"), a

def random_description(ruolo):
    azioni = ["sviluppato", "progettato", "ottimizzato", "implementato", "coordinato", "analizzato", "migrato"]
    tecnologie = random.sample(["Python", "React", "Docker", "AWS", "PostgreSQL", "Terraform", "Figma", "Scikit-learn"], 3)
    return f"{random.choice(azioni).capitalize()} e mantenuto il sistema backend con {tecnologie[0]}. " \
           f"Collaborato con il team per {random.choice(['migliorare le performance', 'ridurre i costi', 'aumentare la copertura dei test'])}, " \
           f"utilizzando {tecnologie[1]} e {tecnologie[2]}. " \
           f"Risultato: {random.choice(['riduzione del 30% dei tempi di risposta', 'aumento del 25% della soddisfazione utente', 'miglioramento del 40% dell\'efficienza'])}."

def random_competenze():
    competenze = {}
    num_categorie = random.randint(3, 4)
    categorie_selezionate = random.sample(list(COMPETENZE_CATEGORIE.keys()), num_categorie)
    for cat in categorie_selezionate:
        num_items = random.randint(3, 6)
        competenze[cat] = random.sample(COMPETENZE_CATEGORIE[cat], num_items)
    return competenze

def random_lingue():
    lingue = [("Italiano", "Madrelingua")]
    num_altre = random.randint(1, 2)
    altre = random.sample([l for l in LINGUE if l[0] != "Italiano"], num_altre)
    for lingua, livelli in altre:
        if isinstance(livelli, list):
            livello = random.choice(livelli)
        else:
            livello = livelli
        lingue.append((lingua, livello))
    return lingue

def random_certificazioni():
    num = random.randint(0, 3)
    return random.sample(CERTIFICAZIONI, num) if num > 0 else []

def generate_random_candidate(index):
    nome = random.choice(NOMI)
    cognome = random.choice(COGNOMI)
    nome_completo = f"{nome} {cognome}"
    
    # Data di nascita (età tra 25 e 50 anni)
    birth_year = random.randint(1975, 1999)
    birth_date = random_date(birth_year, birth_year)
    data_nascita = birth_date.strftime("%d/%m/%Y")
    luogo_nascita = f"{random.choice(CITTA_ITALIANE)} ({random.choice(['MI', 'RM', 'TO', 'NA', 'BO'])})"
    
    ruolo = random.choice(RUOLI)
    email = f"{nome.lower()}.{cognome.lower()}@{random.choice(['gmail.com', 'outlook.com', 'email.it', 'protonmail.com'])}"
    telefono = f"+39 {random.randint(320, 399)} {random.randint(100, 999)} {random.randint(1000, 9999)}"
    linkedin = f"linkedin.com/in/{nome.lower()}{cognome.lower()}"
    indirizzo = f"Via {random.choice(['Roma', 'Milano', 'Garibaldi', 'Verdi'])}, {random.randint(1, 150)} - {random.randint(10000, 20100)} {random.choice(CITTA_ITALIANE)}"
    
    # Profilo
    profilo_templates = [
        f"{ruolo} con {random.randint(3, 10)} anni di esperienza nella progettazione di soluzioni scalabili.",
        f"Professionista dinamico con competenze in {random.choice(['backend', 'frontend', 'cloud', 'data science'])}. Orientato ai risultati e al lavoro in team.",
        f"Specializzato in {random.choice(['API REST', 'microservizi', 'UI/UX', 'machine learning', 'automazione CI/CD'])} con forte attenzione alla qualità e all'innovazione."
    ]
    profilo = random.choice(profilo_templates) + " " + random_description(ruolo).split(".")[0] + "."
    
    # Esperienze lavorative (2-4 esperienze)
    num_esperienze = random.randint(2, 4)
    esperienze = []
    for i in range(num_esperienze):
        da, a = format_date_range(i*2)
        ruolo_exp = ruolo if i == 0 else random.choice(RUOLI)
        azienda = random.choice(AZIENDE)
        luogo = random.choice(CITTA_ITALIANE)
        descrizione = random_description(ruolo_exp)
        esperienze.append({
            "ruolo": ruolo_exp,
            "azienda": azienda,
            "luogo": luogo,
            "da": da,
            "a": a,
            "descrizione": descrizione
        })
    
    # Istruzione (1-3 titoli)
    num_istruzione = random.randint(1, 3)
    istruzione = []
    for i in range(num_istruzione):
        titolo, istituto_base = random.choice(POSSIBILI_TITOLI_STUDIO)
        da, a = format_date_range(5 + i*2)
        voto = random.choice(["110/110 con lode", "108/110", "105/110", "100/110", "94/100", "86/100"])
        istruzione.append({
            "titolo": titolo,
            "istituto": istituto_base if random.random() > 0.3 else f"{istituto_base} - Sede di {random.choice(CITTA_ITALIANE)}",
            "luogo": random.choice(CITTA_ITALIANE),
            "da": da,
            "a": a,
            "voto": voto
        })
    
    competenze = random_competenze()
    lingue = random_lingue()
    certificazioni = random_certificazioni()
    
    return {
        "nome": nome_completo,
        "data_nascita": data_nascita,
        "luogo_nascita": luogo_nascita,
        "nazionalita": "Italiana",
        "email": email,
        "telefono": telefono,
        "linkedin": linkedin,
        "indirizzo": indirizzo,
        "ruolo": ruolo,
        "profilo": profilo,
        "esperienze": esperienze,
        "istruzione": istruzione,
        "competenze": competenze,
        "lingue": lingue,
        "certificazioni": certificazioni,
    }

# ---------------------------------------------------------------------------
# Generazione avatar placeholder (cerchio con iniziali)
# ---------------------------------------------------------------------------
def genera_avatar(nome: str, size: int = 120) -> BytesIO:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size - 1, size - 1], fill=(36, 74, 165))
    iniziali = "".join(p[0].upper() for p in nome.split()[:2])
    font_size = size // 3
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font = None
    if font:
        bbox = draw.textbbox((0, 0), iniziali, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    else:
        tw, th = font_size * len(iniziali) * 0.6, font_size
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - 2),
        iniziali,
        fill=(255, 255, 255),
        font=font,
    )
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

# ---------------------------------------------------------------------------
# Flowable personalizzati (invariati)
# ---------------------------------------------------------------------------
class SectionHeader(Flowable):
    def __init__(self, text, width):
        super().__init__()
        self.text = text
        self._width = width
        self.height = 8 * mm

    def draw(self):
        c = self.canv
        c.setFillColor(BLUE_MID)
        c.rect(0, 0, self._width, self.height, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(3 * mm, 2.5 * mm, self.text.upper())

class AvatarImage(Flowable):
    def __init__(self, img_buf, size=28 * mm):
        super().__init__()
        self._buf = img_buf
        self._size = size
        self.width = size
        self.height = size

    def draw(self):
        from reportlab.lib.utils import ImageReader
        self._buf.seek(0)
        img = ImageReader(self._buf)
        self.canv.drawImage(img, 0, 0, self._size, self._size, mask="auto")

class SkillBar(Flowable):
    def __init__(self, level: int, total: int = 5, width: float = 30 * mm, height: float = 3 * mm):
        super().__init__()
        self.level = level
        self.total = total
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        gap = 1.5
        cell_w = (self.width - gap * (self.total - 1)) / self.total
        for i in range(self.total):
            x = i * (cell_w + gap)
            if i < self.level:
                c.setFillColor(BLUE_MID)
            else:
                c.setFillColor(GREY_LINE)
            c.rect(x, 0, cell_w, self.height, fill=1, stroke=0)

# ---------------------------------------------------------------------------
# Stili (invariati)
# ---------------------------------------------------------------------------
def get_styles():
    return {
        "name": ParagraphStyle(
            "name", fontName="Helvetica-Bold", fontSize=20,
            textColor=BLUE_DARK, leading=24, spaceAfter=2,
        ),
        "role": ParagraphStyle(
            "role", fontName="Helvetica", fontSize=11,
            textColor=BLUE_MID, leading=14, spaceAfter=4,
        ),
        "contact": ParagraphStyle(
            "contact", fontName="Helvetica", fontSize=8,
            textColor=GREY_TEXT, leading=12,
        ),
        "profilo": ParagraphStyle(
            "profilo", fontName="Helvetica-Oblique", fontSize=9,
            textColor=GREY_TEXT, leading=13, spaceAfter=4,
        ),
        "entry_title": ParagraphStyle(
            "entry_title", fontName="Helvetica-Bold", fontSize=9,
            textColor=BLACK, leading=12,
        ),
        "entry_sub": ParagraphStyle(
            "entry_sub", fontName="Helvetica", fontSize=8.5,
            textColor=BLUE_MID, leading=11,
        ),
        "entry_date": ParagraphStyle(
            "entry_date", fontName="Helvetica", fontSize=8,
            textColor=colors.HexColor("#777777"), leading=11, alignment=TA_RIGHT,
        ),
        "entry_body": ParagraphStyle(
            "entry_body", fontName="Helvetica", fontSize=8.5,
            textColor=GREY_TEXT, leading=12, spaceAfter=4,
        ),
        "skill_label": ParagraphStyle(
            "skill_label", fontName="Helvetica-Bold", fontSize=8.5,
            textColor=BLACK, leading=11,
        ),
        "skill_item": ParagraphStyle(
            "skill_item", fontName="Helvetica", fontSize=8.5,
            textColor=GREY_TEXT, leading=11,
        ),
        "lang_name": ParagraphStyle(
            "lang_name", fontName="Helvetica-Bold", fontSize=8.5,
            textColor=BLACK,
        ),
        "lang_level": ParagraphStyle(
            "lang_level", fontName="Helvetica", fontSize=8.5,
            textColor=GREY_TEXT,
        ),
        "cert": ParagraphStyle(
            "cert", fontName="Helvetica", fontSize=8.5,
            textColor=GREY_TEXT, leading=12, leftIndent=5,
        ),
        "footer": ParagraphStyle(
            "footer", fontName="Helvetica-Oblique", fontSize=7,
            textColor=GREY_LINE, alignment=TA_CENTER,
        ),
    }

# ---------------------------------------------------------------------------
# Builder del documento (invariato)
# ---------------------------------------------------------------------------
def build_cv(candidato: dict, output_path: str):
    S = get_styles()
    usable_w = W - MARGIN_L - MARGIN_R
    story = []

    # HEADER
    avatar_buf = genera_avatar(candidato["nome"])
    avatar_size = 28 * mm

    header_data = [[
        Paragraph(candidato["nome"], S["name"]),
        AvatarImage(avatar_buf, avatar_size),
    ]]
    header_table = Table(
        header_data,
        colWidths=[usable_w - avatar_size - 4 * mm, avatar_size],
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE_LIGHT),
        ("TOPPADDING",    (0, 0), (-1, -1), 6 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
        ("LEFTPADDING",   (0, 0), (0, -1), 5 * mm),
        ("RIGHTPADDING",  (-1, 0), (-1, -1), 4 * mm),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_table)

    # Ruolo + info anagrafiche
    info_rows = [
        [Paragraph(candidato["ruolo"], S["role"]), ""],
        [
            Paragraph(
                f"✉ {candidato['email']}   ☎ {candidato['telefono']}",
                S["contact"]
            ),
            Paragraph(
                f"🏠 {candidato['indirizzo']}",
                S["contact"]
            ),
        ],
        [
            Paragraph(
                f"🔗 {candidato['linkedin']}",
                S["contact"]
            ),
            Paragraph(
                f"Nato/a il {candidato['data_nascita']} a {candidato['luogo_nascita']}   |   "
                f"Nazionalità: {candidato['nazionalita']}",
                S["contact"]
            ),
        ],
    ]
    info_table = Table(info_rows, colWidths=[usable_w * 0.55, usable_w * 0.45])
    info_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE_LIGHT),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5 * mm),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING",    (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 5 * mm),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("SPAN",          (0, 0), (-1, 0)),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 4 * mm))

    # PROFILO
    story.append(SectionHeader("Profilo Professionale", usable_w))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(candidato["profilo"], S["profilo"]))
    story.append(Spacer(1, 4 * mm))

    # ESPERIENZE
    story.append(SectionHeader("Esperienza Lavorativa", usable_w))
    story.append(Spacer(1, 2 * mm))
    for exp in candidato["esperienze"]:
        date_str = f"{exp['da']} – {exp['a']}"
        row = [
            [
                Paragraph(exp["ruolo"], S["entry_title"]),
                Paragraph(f"{exp['azienda']} · {exp['luogo']}", S["entry_sub"]),
                Paragraph(exp["descrizione"], S["entry_body"]),
            ],
            [Paragraph(date_str, S["entry_date"])],
        ]
        t = Table(
            [row],
            colWidths=[usable_w * 0.72, usable_w * 0.28],
        )
        t.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(KeepTogether(t))
        story.append(HRFlowable(width=usable_w, thickness=0.3, color=GREY_LINE, spaceAfter=3))
    story.append(Spacer(1, 3 * mm))

    # ISTRUZIONE
    story.append(SectionHeader("Istruzione e Formazione", usable_w))
    story.append(Spacer(1, 2 * mm))
    for edu in candidato["istruzione"]:
        date_str = f"{edu['da']} – {edu['a']}"
        voto_str = f"Voto: {edu['voto']}" if edu.get("voto") else ""
        desc = f"{edu['istituto']} · {edu['luogo']}"
        if voto_str:
            desc += f"   |   {voto_str}"
        row = [
            [
                Paragraph(edu["titolo"], S["entry_title"]),
                Paragraph(desc, S["entry_sub"]),
            ],
            [Paragraph(date_str, S["entry_date"])],
        ]
        t = Table([row], colWidths=[usable_w * 0.72, usable_w * 0.28])
        t.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(KeepTogether(t))
        story.append(HRFlowable(width=usable_w, thickness=0.3, color=GREY_LINE, spaceAfter=3))
    story.append(Spacer(1, 3 * mm))

    # COMPETENZE
    story.append(SectionHeader("Competenze Personali", usable_w))
    story.append(Spacer(1, 2 * mm))
    skill_rows = []
    for categoria, items in candidato["competenze"].items():
        skill_rows.append([
            Paragraph(categoria, S["skill_label"]),
            Paragraph("  ·  ".join(items), S["skill_item"]),
        ])
    if skill_rows:
        st = Table(skill_rows, colWidths=[usable_w * 0.22, usable_w * 0.78])
        st.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GREY_LIGHT]),
        ]))
        story.append(st)
    story.append(Spacer(1, 4 * mm))

    # LINGUE
    story.append(SectionHeader("Competenze Linguistiche", usable_w))
    story.append(Spacer(1, 2 * mm))
    lang_rows = [[
        Paragraph("Lingua", S["skill_label"]),
        Paragraph("Livello", S["skill_label"]),
        Paragraph("Comprensione", S["skill_label"]),
        Paragraph("Parlato", S["skill_label"]),
        Paragraph("Scritto", S["skill_label"]),
    ]]
    for lingua, livello in candidato["lingue"]:
        if "Madrelingua" in livello:
            bars = [5, 5, 5]
        elif livello.startswith("C"):
            bars = [5, 4, 5]
        elif livello.startswith("B2"):
            bars = [4, 3, 4]
        elif livello.startswith("B1"):
            bars = [3, 3, 3]
        else:
            bars = [2, 2, 2]
        lang_rows.append([
            Paragraph(lingua, S["lang_name"]),
            Paragraph(livello, S["lang_level"]),
            SkillBar(bars[0]),
            SkillBar(bars[1]),
            SkillBar(bars[2]),
        ])
    col_w = usable_w / 5
    lt = Table(lang_rows, colWidths=[col_w] * 5)
    lt.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), GREY_LIGHT),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",          (0, 0), (-1, -1), 0.3, GREY_LINE),
    ]))
    story.append(lt)
    story.append(Spacer(1, 4 * mm))

    # CERTIFICAZIONI
    if candidato.get("certificazioni"):
        story.append(SectionHeader("Certificazioni", usable_w))
        story.append(Spacer(1, 2 * mm))
        for cert in candidato["certificazioni"]:
            story.append(Paragraph(f"▪ {cert}", S["cert"]))
        story.append(Spacer(1, 4 * mm))

    # FOOTER
    story.append(HRFlowable(width=usable_w, thickness=0.5, color=BLUE_MID))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "Autorizzo il trattamento dei dati personali ai sensi dell'Art. 13 del D.Lgs. 196/2003 "
        "e del Regolamento UE 2016/679 (GDPR).",
        S["footer"],
    ))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title=f"Curriculum Vitae — {candidato['nome']}",
        author=candidato["nome"],
        subject="Curriculum Vitae Europass",
        creator="FluxHR CV Generator",
    )

    def add_page_number(canvas_obj, doc_obj):
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(GREY_LINE)
        canvas_obj.drawRightString(
            W - MARGIN_R,
            MARGIN_B / 2,
            f"Curriculum Vitae di {candidato['nome']} — Pagina {doc_obj.page}",
        )
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"  ✅  {os.path.basename(output_path)}")

# ---------------------------------------------------------------------------
# Main: generazione casuale
# ---------------------------------------------------------------------------
def main():
    out_dir = os.path.join(os.path.dirname(__file__), "campioni_cv")
    os.makedirs(out_dir, exist_ok=True)
    
    # Numero casuale di CV da generare (tra 5 e 12)
    num_cv = random.randint(20, 50)
    print(f"\n📄 Generazione CASUALE di {num_cv} CV Europass → {out_dir}/\n")
    
    for i in range(num_cv):
        candidato = generate_random_candidate(i)
        nome_file = f"CV_Europass_{candidato['nome'].replace(' ', '_')}.pdf"
        path = os.path.join(out_dir, nome_file)
        build_cv(candidato, path)
    
    print(f"\n✨ Generati {num_cv} CV casuali in '{out_dir}/'")

if __name__ == "__main__":
    main()
