import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import dashboard, flashcards, goals, learning_ai, study
from app.db.session import engine
from app.models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Manaboard API", version="0.1.0")

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(study.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(learning_ai.router, prefix="/api")
app.include_router(flashcards.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
