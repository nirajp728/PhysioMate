from pymongo import MongoClient

_db = None


def init_db(uri, name):
    global _db
    if uri:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    else:
        import mongomock

        print("[db] MONGO_URI not set -> using in-memory mongomock (data is lost on restart)")
        client = mongomock.MongoClient()
    _db = client[name]
    _db.users.create_index("email", unique=True)
    _db.assignments.create_index([("physio_id", 1), ("patient_id", 1)], unique=True)
    _db.sessions.create_index([("patient_id", 1), ("started_at", -1)])
    _db.calibrations.create_index([("patient_id", 1), ("created_at", -1)])
    return _db


def db():
    return _db
