"""
entity_resolution.py — Normalization and entity resolution for accounts, phones, and beneficiaries.
"""
import re
import uuid
from typing import Optional, Dict, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from rapidfuzz import fuzz

from app.models.entity import Entity
from app.models.alias import EntityAlias


def normalise_phone(phone: Any) -> Optional[str]:
    """Digits only, strip leading +91 or 91, keep last 10 digits."""
    if pd_isna(phone):
        return None
    s = str(phone).strip()
    digits = re.sub(r"\D", "", s)
    if not digits:
        return None
    if digits.startswith("91") and len(digits) > 10:
        digits = digits[2:]
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def normalise_account(account: Any) -> str:
    """Strip whitespace and uppercase account key."""
    if pd_isna(account):
        return ""
    return str(account).strip().upper()


def pd_isna(val: Any) -> bool:
    """Helper to check None or NaN."""
    if val is None:
        return True
    try:
        import math
        if isinstance(val, float) and math.isnan(val):
            return True
    except Exception:
        pass
    return str(val).strip().lower() in ("nan", "none", "<na>", "")


def _is_initial_match(name1: str, name2: str) -> bool:
    """Check if one name is an initial variation of the other (e.g. 'R. Sharma' vs 'Rahul Sharma')."""
    t1 = [re.sub(r"[^a-zA-Z0-9]", "", x).lower() for x in name1.split()]
    t2 = [re.sub(r"[^a-zA-Z0-9]", "", x).lower() for x in name2.split()]
    t1 = [x for x in t1 if x]
    t2 = [x for x in t2 if x]

    if len(t1) >= 2 and len(t2) >= 2:
        # Check matching last token (surname)
        if t1[-1] == t2[-1]:
            # First token is initial prefix
            if (len(t1[0]) == 1 and t2[0].startswith(t1[0])) or (len(t2[0]) == 1 and t1[0].startswith(t2[0])):
                return True
    return False


def resolve_beneficiary(
    name: str,
    existing_beneficiaries: Dict[str, Tuple[uuid.UUID, str]]
) -> Tuple[Optional[uuid.UUID], Optional[float], Optional[str]]:
    """
    Match candidate beneficiary name against existing beneficiaries.
    existing_beneficiaries: {normalized_key: (entity_id, display_name)}
    Returns (matched_entity_id, score, match_reason) if token_sort_ratio >= 90 or initial variation.
    """
    if not name or pd_isna(name):
        return None, None, None

    cleaned_cand = name.strip()
    cand_lower = cleaned_cand.lower()
    best_score = 0.0
    best_match_id = None
    best_display = ""

    for norm_key, (eid, disp) in existing_beneficiaries.items():
        disp_lower = disp.lower()
        score = fuzz.token_sort_ratio(cand_lower, disp_lower)

        # Handle initial abbreviation match e.g. "R. Sharma" and "Rahul Sharma"
        if score < 90.0 and _is_initial_match(cleaned_cand, disp):
            score = 92.0

        if score > best_score:
            best_score = score
            best_match_id = eid
            best_display = disp

    if best_score >= 90.0 and best_match_id is not None:
        reason = f"Fuzzy matched to '{best_display}' with similarity score {best_score:.1f}% (token_sort_ratio >= 90)"
        return best_match_id, float(best_score), reason

    return None, None, None


def get_or_create_entity(
    db: Session,
    entity_type: str,
    canonical_key: str,
    display_name: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> Entity:
    """
    Get existing Entity or create a new one respecting UNIQUE(entity_type, canonical_key).
    """
    existing = (
        db.query(Entity)
        .filter(Entity.entity_type == entity_type, Entity.canonical_key == canonical_key)
        .first()
    )
    if existing:
        return existing

    new_entity = Entity(
        id=uuid.uuid4(),
        entity_type=entity_type,
        canonical_key=canonical_key,
        display_name=display_name or canonical_key,
        attributes=attributes or {},
    )
    try:
        db.add(new_entity)
        db.flush()
        return new_entity
    except IntegrityError:
        db.rollback()
        return (
            db.query(Entity)
            .filter(Entity.entity_type == entity_type, Entity.canonical_key == canonical_key)
            .first()
        )
