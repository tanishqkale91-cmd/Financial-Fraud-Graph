"""
db.py — SQLAlchemy engine and session factory.

SQLAlchemy concept for you:
  - Engine = the connection pool to Postgres (like a JDBC DataSource in Java).
  - Session = one unit of work: you run queries on it, then commit or rollback.
  - SessionLocal() creates a new session; always close it when done.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

# echo=True prints every SQL to console — handy for debugging, turn off in prod.
engine = create_engine(settings.postgres_dsn, echo=settings.debug)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """All ORM models inherit from this."""
    pass


def get_db():
    """
    FastAPI dependency — yields a DB session and closes it automatically.
    Usage:  db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
