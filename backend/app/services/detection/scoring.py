"""
scoring.py — Scoring and score breakdown utilities for fraud detection.
"""
from typing import Dict, Any, List, Optional


def build_score_breakdown(
    rule_id: str,
    rule_score: float,
    rule_weight: float = 1.0,
    ml_score: Optional[float] = None,
    ml_top_features: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Construct standardized score_breakdown JSON:
    {
      "rules": [{"rule_id": "...", "weight": 1.0, "score": 0.85}],
      "ml": {"score": 0.75, "top_features": [{"name": "...", "value": 1.0, "contribution": 0.5}]}
    }
    """
    ml_data = None
    if ml_score is not None:
        ml_data = {
            "score": round(ml_score, 4),
            "top_features": ml_top_features or [],
        }

    return {
        "rules": [
            {
                "rule_id": rule_id,
                "weight": rule_weight,
                "score": round(rule_score, 4),
            }
        ],
        "ml": ml_data,
    }


def compute_blended_score(
    rule_score: float,
    ml_score: Optional[float] = None,
    rule_weight: float = 0.7,
    ml_weight: float = 0.3,
) -> float:
    """Blend rule score and ML score with weights (default 0.7 / 0.3)."""
    if ml_score is None:
        return min(1.0, max(0.0, rule_score))
    return min(1.0, max(0.0, rule_weight * rule_score + ml_weight * ml_score))

