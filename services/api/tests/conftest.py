import pytest
from fastapi.testclient import TestClient
from app.main import app, requests


@pytest.fixture(scope="session")
def client():
    # A pool has one lifespan; all integration modules share the test application.
    with TestClient(app) as instance:
        yield instance


@pytest.fixture(autouse=True)
def isolate_client_state(client):
    # Each test represents an independent client. Keep rate limiting active
    # within a test, without counting requests made by unrelated tests.
    requests.clear()
    client.cookies.clear()
    yield
    requests.clear()
    client.cookies.clear()
