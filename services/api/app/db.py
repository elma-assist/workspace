from collections.abc import Iterator
from psycopg import Connection
from psycopg.rows import dict_row, DictRow
from psycopg_pool import ConnectionPool
from app.settings import settings

pool = ConnectionPool[Connection[DictRow]](
    settings.database_url, kwargs={"row_factory": dict_row}, open=False
)


def connect() -> Connection[DictRow]:
    return Connection[DictRow].connect(settings.database_url, row_factory=dict_row)


def db() -> Iterator[Connection[DictRow]]:
    with pool.connection() as conn:
        yield conn
