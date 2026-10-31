"""
db.py — SQLAlchemy engine, SessionLocal, Base, and get_db() dependency.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """All ORM models inherit from this Base."""
    pass


def get_db():
    """
    FastAPI dependency — yields a DB session and closes it automatically.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables defined in models."""
    import app.models  # ensure models are imported and registered with Base
    Base.metadata.create_all(bind=engine)
