# Manaboard

Manaboard is a local study support app focused on Japan's Fundamental Information Technology Engineer Examination. It records study time with a timer, generates practice problems, manages a dashboard-based study plan, and explains problems from images.

## Features

- Local single-user mode without login
- Timer-based study logging
- Fundamental Information Technology Engineer Examination dashboard with study planning
- AI practice problem generation for 3-question morning-exam style review
- Answer recording for generated problems
- Image-based problem explanation with Gemini Vision
- Tesseract OCR used only as supporting information for image analysis

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- AI: Google Gemini API
- OCR: Tesseract
- Runtime: Docker Compose with one app container and one database container

## Setup

1. Copy `.env.example` to `.env`.
2. Set your Gemini API key.

```env
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-3.5-flash
```

3. Start the app.

```bash
docker compose up -d --build
```

Docker starts:

- `app`: Next.js frontend and FastAPI backend
- `db`: PostgreSQL database

## URLs

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

## Notes

- Do not commit `.env`.
- API keys are used only by the backend container.
- Supported image formats are JPEG, PNG, and WebP.
- Maximum image upload size is 5MB.
