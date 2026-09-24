from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if settings.database_url.startswith("sqlite"):
    # SQLite took SQLAlchemy's default pool of 5 because `pool_size` was only
    # set on the else-branch. Under a handful of concurrent requests that
    # produced
    #
    #   sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10
    #   reached, connection timed out, timeout 30.00
    #
    # on /api/v1/mines, which is the one endpoint every page needs.
    #
    # The pool size is raised here so the configured value is not a lie, but
    # that is NOT the fix — a bigger pool only buys more seconds before the
    # same exhaustion. The fix is that no request holds a session across a
    # computation any more (see resolve_mine_code below and the forecast
    # warmer). This is the belt to that braces.
    connect_args = {"check_same_thread": False}
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_recycle": 1800,
    })
else:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_recycle": 1800,
    })

engine = create_engine(settings.database_url, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def resolve_mine_code(mine_id: int) -> tuple[str, str] | None:
    """
    Read a mine's code and name, then release the connection immediately.

    Routes used to hold a `Depends(get_db)` session for the whole request,
    including the ~42 s model fit inside /forecast — during which the session
    was open but unused. Ten concurrent forecasts therefore held ten connections
    doing nothing, and /mines could not get one.

    Returning plain strings rather than an ORM object is deliberate: a detached
    instance would lazy-load on attribute access and reopen a connection at the
    worst moment.
    """
    from app.models.mine import MineSite

    db = SessionLocal()
    try:
        mine = db.get(MineSite, mine_id)
        if mine is None:
            return None
        return mine.mine_code, mine.name
    finally:
        db.close()
