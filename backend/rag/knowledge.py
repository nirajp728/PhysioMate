"""Curated public guidance. Separate collection from patient data (no patient_id anywhere).
Every entry names its source, how reliable that source type is, and what population it covers.
Entries are short paraphrases written from the sources, checked on VERIFIED_ON. Add more the same way."""
from db import db
from rag.embeddings import available, embed
from rag import store

VERIFIED_ON = "2026-10-28"
TRUSTED = {  # only these publishers may be added
    "Shoulder & Elbow (SAGE), peer-reviewed journal",
    "The Journal of Bone and Joint Surgery (JBJS)",
    "American College of Sports Medicine (ACSM)",
    "American Academy of Orthopaedic Surgeons (AAOS) OrthoInfo",
    "StatPearls (NCBI Bookshelf)",
}

GUIDANCE = [
    {"_id": "S1", "kind": "normal_range", "evidence": "peer-reviewed study",
     "publisher": "Shoulder & Elbow (SAGE), peer-reviewed journal",
     "citation": "Zwerus EL et al. Normative values and affecting factors for the elbow range of motion. "
                 "Shoulder Elbow 2019;11(3):215-224. doi:10.1177/1758573217728711 (PMID 31210794)",
     "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6555111/",
     "scope": "352 healthy adults, goniometer measurements",
     "text": "In 352 healthy adults, the average active range of the dominant elbow was about 146 degrees of flexion "
             "and about -2 degrees of extension (essentially straight), so the full arc is roughly 148 degrees. "
             "Average forearm rotation was about 80 degrees pronation and 87 degrees supination. Men had slightly "
             "smaller ranges than women, and range varies with age and body mass index. Passive range was 3 to 5 "
             "degrees larger than active range. The other, uninjured arm is a good reference for comparison."},
    {"_id": "S2", "kind": "functional_range", "evidence": "peer-reviewed study",
     "publisher": "The Journal of Bone and Joint Surgery (JBJS)",
     "citation": "Morrey BF et al. J Bone Joint Surg Am 1981;63(6):872 (summarised in JBJS OrthoBuzz, 2016)",
     "url": "https://orthobuzz.jbjs.org/2016/10/26/jbjs-classics-biomechanics-of-the-normal-elbow/",
     "scope": "functional elbow motion in daily activities",
     "text": "Most daily activities need only a functional arc of about 100 degrees of elbow flexion and extension, "
             "from about 30 to 130 degrees of flexion, plus about 100 degrees of forearm rotation "
             "(50 degrees pronation and 50 degrees supination)."},
    {"_id": "S3", "kind": "exercise_progression", "evidence": "professional society position stand",
     "publisher": "American College of Sports Medicine (ACSM)",
     "citation": "ACSM Position Stand. Progression models in resistance training for healthy adults. "
                 "Med Sci Sports Exerc 2009;41(3):687-708. doi:10.1249/MSS.0b013e3181915670",
     "url": "https://doi.org/10.1249/MSS.0b013e3181915670",
     "scope": "healthy adults; general strength training, NOT an injury rehabilitation protocol",
     "text": "For healthy beginners, strength training is commonly done with loads that allow 8 to 12 repetitions, "
             "2 to 3 days per week. When a person can do 1 to 2 more repetitions than the target with the current "
             "load, the load is increased gradually, by about 2 to 10 percent."},
    {"_id": "S4", "kind": "recovery_progression", "evidence": "patient education from a professional society",
     "publisher": "American Academy of Orthopaedic Surgeons (AAOS) OrthoInfo",
     "citation": "AAOS OrthoInfo. Elbow Dislocation (page accessed 2026-10-28)",
     "url": "https://orthoinfo.aaos.org/en/diseases--conditions/elbow-dislocation",
     "scope": "recovery after a simple elbow dislocation, used here as an example of staged recovery",
     "text": "After a simple elbow dislocation the elbow is kept in a splint or sling for about 1 to 3 weeks. "
             "Therapy then guides regaining motion, and once range of motion improves a doctor or physical "
             "therapist may add a strengthening program. Early movement appears to be good for recovery. "
             "Recovery steps should follow the treating clinician's instructions."},
    {"_id": "S5", "kind": "anatomy", "evidence": "peer-reviewed reference",
     "publisher": "StatPearls (NCBI Bookshelf)",
     "citation": "Card RK, Lowe JB, Launico MV. Anatomy, Shoulder and Upper Limb, Elbow Joint. StatPearls, "
                 "updated 2025-12-09. NBK532948",
     "url": "https://www.ncbi.nlm.nih.gov/sites/books/NBK532948/",
     "scope": "general anatomy",
     "text": "The elbow bends and straightens (flexion and extension) and rotates the forearm (pronation and "
             "supination). The triceps brachii is the main muscle that straightens the elbow. The biceps brachii "
             "makes a modest contribution to bending the elbow and is the main muscle that turns the palm up "
             "(supination)."},
]


def seed():
    for g in GUIDANCE:
        assert g["publisher"] in TRUSTED and g["url"].startswith("https://") and g["citation"] and g["scope"]
    docs = [{**g, "doc_type": "guidance", "source_tier": 1, "verified_on": VERIFIED_ON} for g in GUIDANCE]
    db().guidance.delete_many({})
    store.add("guidance", docs, embed([d["text"] for d in docs]))


def seed_if_possible():
    if not available():
        return print("[rag] no GEMINI_API_KEY: guidance not indexed, assistant disabled")
    try:
        if db().guidance.count_documents({}) != len(GUIDANCE):
            seed()
    except Exception as e:  # never stop the server because of this
        print("[rag] could not index guidance:", e)