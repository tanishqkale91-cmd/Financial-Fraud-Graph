"""
neo4j_client.py — Driver and query helpers for Neo4j.
"""
from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver

from app.core.config import settings

_driver: Optional[Driver] = None


def get_driver() -> Driver:
    """Return a singleton Neo4j driver instance."""
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            connection_timeout=1.0,
        )
    return _driver


def close_driver() -> None:
    """Close the driver on application shutdown."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def run_query(cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Execute a Cypher query and return results as a list of dicts."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(cypher, params or {})
        return [record.data() for record in result]


def ensure_constraints() -> None:
    """Create UNIQUE id constraints for each node label."""
    labels = ["Account", "Device", "Phone", "Merchant", "Beneficiary"]
    for label in labels:
        query = (
            f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) "
            f"REQUIRE n.id IS UNIQUE"
        )
        run_query(query)
