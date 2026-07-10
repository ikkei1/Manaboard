#!/bin/sh
set -e

cd /app/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &

cd /app/frontend
npm run dev
