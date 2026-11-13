"""Run once against MongoDB Atlas (free M0 works):  python scripts/create_vector_indexes.py
Then set ATLAS_SEARCH=1 in .env. Only the public guidance is vector-searched; session data is read from normal collections."""
import os
import sys

from pymongo import MongoClient
from pymongo.operations import SearchIndexModel

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import Config  # noqa: E402

db = MongoClient(Config.MONGO_URI)[Config.MONGO_DB]
if "guidance" not in db.list_collection_names():
    db.create_collection("guidance")
db.guidance.create_search_index(SearchIndexModel(name="guidance_index", type="vectorSearch", definition={"fields": [
    {"type": "vector", "path": "embedding", "numDimensions": Config.EMBED_DIMS, "similarity": "cosine"},
    {"type": "filter", "path": "doc_type"}, {"type": "filter", "path": "source_tier"}]}))
print("created guidance_index")