FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# BUG #6 FIXED: il CMD originale era `uvicorn main:app` (import assoluto)
# che falliva perche' il codice e' nel package app/ (app.main).
# Il comando corretto e' `uvicorn app.main:app`.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
