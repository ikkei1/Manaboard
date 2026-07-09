# Manaboard

Manaboard is a local study support app for recording study logs, generating practice problems, analyzing weak areas, creating schedules, and explaining problems from images.

## Features

- User registration and login
- Study log CRUD
- Goal management
- AI practice problem generation
- Answer recording and weak-area analysis
- Study schedule generation
- Image-based problem explanation with Gemini Vision
- Tesseract OCR used only as supporting information for image analysis

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- AI: Google Gemini API
- OCR: Tesseract
- Runtime: Docker Compose

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

## URLs

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

## Notes

- Do not commit `.env`.
- API keys are used only by the backend container.
- Supported image formats are JPEG, PNG, and WebP.
- Maximum image upload size is 5MB.
