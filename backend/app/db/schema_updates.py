from sqlalchemy import inspect, text

from app.db.session import engine


def ensure_flashcard_scheduler_schema():
    columns = {column["name"] for column in inspect(engine).get_columns("flashcards")}
    statements = []
    if "next_review_at" not in columns:
        statements.append("ALTER TABLE flashcards ADD COLUMN next_review_at TIMESTAMP NULL")
    if "fsrs_card" not in columns:
        statements.append("ALTER TABLE flashcards ADD COLUMN fsrs_card TEXT NULL")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_flashcards_user_due ON flashcards (user_id, next_review_at)")
        )
        connection.execute(text("UPDATE flashcards SET status = 'learning' WHERE status = 'mastered'"))
