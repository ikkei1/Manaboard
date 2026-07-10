FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-jpn \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r /app/backend/requirements.txt

COPY frontend/package*.json /app/frontend/
WORKDIR /app/frontend
RUN npm ci

WORKDIR /app
COPY backend /app/backend
COPY frontend /app/frontend
COPY scripts/start.sh /app/scripts/start.sh
RUN chmod +x /app/scripts/start.sh

ENV PATH="/opt/venv/bin:$PATH"
CMD ["/app/scripts/start.sh"]
