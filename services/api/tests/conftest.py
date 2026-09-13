import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client():
    # A pool has one lifespan; all integration modules share the test application.
    with TestClient(app) as instance:
        yield instance
