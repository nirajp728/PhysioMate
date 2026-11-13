"""Agentic RAG as a LangGraph:

  question -> planner -> (knowledge-base worker || session worker) -> aggregator -> answer

The planner decides what is needed. The two workers run in parallel when both are needed.
The aggregator writes the answer from what was retrieved. patient_id is fixed by the server for the whole run;
no model output can change it."""
from datetime import date
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from rag import llm, tools
from rag.llm import configured, set_llm  # noqa: F401  (re-exported for the API and the tests)

FIELD_HELP = "\n".join(f"  - {name}: {meaning}" for name, (_, meaning) in tools.FIELDS.items())

PLANNER_SYSTEM = f"""You are the planning step of an assistant inside a physiotherapy app. Decide what is needed to answer the user's latest question, then call submit_plan once.

There are two possible sources:
1. SESSION DATA: this one person's recorded exercise sessions (elbow range of motion). Fields you may request:
{FIELD_HELP}
2. KNOWLEDGE BASE: general verified information about normal elbow range of motion, the functional range used in daily life, how strength exercise is progressed, and elbow anatomy.

How to plan:
- If you need session data, first call list_sessions. It returns only numbers, ids and dates (no values). Session number 1 is the oldest. Pick the session numbers you need and ONLY the fields you need.
- submit_plan has: kb_queries (up to 3 short search phrases, empty if no general knowledge is needed), session_requests (each: session_numbers and fields, empty if no recorded data is needed), note (short reason).
- If the question needs neither (greeting, unrelated, or asks for a diagnosis, treatment, medicine or pain advice), leave both empty and say why in note.
Today is {{today}}."""

PLAN_SPECS = [
    {"name": "list_sessions", "description": "List this person's sessions as number, id and date. No measurements.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "submit_plan", "description": "Submit the plan. Call exactly once, after list_sessions if sessions are needed.",
     "parameters": {"type": "object", "properties": {
         "kb_queries": {"type": "array", "items": {"type": "string"}},
         "session_requests": {"type": "array", "items": {"type": "object", "properties": {
             "session_numbers": {"type": "array", "items": {"type": "integer"}},
             "fields": {"type": "array", "items": {"type": "string"}}}}},
         "note": {"type": "string"}}}},
]

ANSWER_SYSTEM = """You write the final answer in a physiotherapy app, using ONLY the context you are given.
- SESSION DATA is this person's own recorded data (n = session number, 1 is the oldest). GUIDANCE is general verified information; cite it with its id in square brackets, like [S1]. Keep the two clearly separate.
- When comparing sessions, show the actual numbers you compare. Do the arithmetic carefully.
- Never diagnose, never name conditions or injuries, never advise on medicines, pain, or starting/stopping exercises. Say to ask their physiotherapist about that.
- The wearable's angle values may use a different zero point from textbooks, so compare range of motion (the size of the arc) with normal ranges, never raw angles.
- If the context does not contain what is needed, say so. If the planner note says the question is out of scope, kindly say what you can help with (their sessions, and general elbow range and exercise information).
- 3 to 6 plain sentences."""


class State(TypedDict, total=False):
    question: str
    plan: dict
    kb: list
    sessions: list
    answer: str


def clean_plan(args):
    """The model's plan is untrusted input: keep only known fields and sane sizes."""
    queries = [str(q).strip()[:200] for q in (args.get("kb_queries") or []) if str(q).strip()][:3]
    reqs = []
    for r in (args.get("session_requests") or [])[:5]:
        nums = sorted({int(n) for n in (r.get("session_numbers") or []) if str(n).lstrip("-").isdigit() or isinstance(n, (int, float))})[:tools.MAX_SESSIONS]
        fields = [f for f in (r.get("fields") or []) if f in tools.FIELDS][:10]
        if nums and fields:
            reqs.append({"session_numbers": nums, "fields": fields})
    return {"kb_queries": queries, "session_requests": reqs, "note": str(args.get("note") or "")[:200]}


def build(patient_id):
    def planner(st):
        history = [{"role": "user", "text": st["question"]}]
        for _ in range(3):
            out = llm.call(PLANNER_SYSTEM.format(today=date.today().isoformat()), history, PLAN_SPECS)
            history.append({"role": "model", **out})
            if not out["calls"]:
                break
            names = [c["name"] for c in out["calls"]]
            if "submit_plan" in names and "list_sessions" not in names:
                return {"plan": clean_plan(next(c for c in out["calls"] if c["name"] == "submit_plan")["args"])}
            for c in out["calls"]:  # list_sessions, or submit_plan sent too early
                res = tools.list_sessions(patient_id) if c["name"] == "list_sessions" else "Call submit_plan again after you have read the list."
                history.append({"role": "tool", "name": c["name"], "result": res})
        latest = tools.list_sessions(patient_id)[-3:]  # the model never produced a plan: look at the last 3 sessions
        return {"plan": {"kb_queries": [st["question"][:200]], "note": "default plan",
                         "session_requests": [{"session_numbers": [s["n"] for s in latest],
                                               "fields": ["rom", "reps", "avg_rom", "fatigue_pct", "score"]}] if latest else []}}

    def route(st):  # fan-out: the workers that are needed run in parallel
        p = st["plan"]
        return [n for n, needed in (("kb", p["kb_queries"]), ("sessions", p["session_requests"])) if needed] or ["aggregate"]

    def kb(st):
        found, seen = [], set()
        for q in st["plan"]["kb_queries"]:
            for d in tools.hybrid_search(q):
                if d["_id"] not in seen:
                    seen.add(d["_id"])
                    found.append({"id": d["_id"], "text": d["text"], "scope": d["scope"], "citation": d["citation"],
                                  "url": d["url"], "evidence": d["evidence"]})
        return {"kb": found[:4]}

    def sessions(st):
        return {"sessions": tools.fetch_sessions(patient_id, st["plan"]["session_requests"])}

    def aggregate(st):  # fan-in
        parts = [f"QUESTION: {st['question']}", f"PLANNER NOTE: {st['plan']['note'] or 'none'}"]
        if st.get("sessions") is not None:
            parts.append("SESSION DATA (json): " + (str(st["sessions"]) or "[]"))
        if st.get("kb"):
            parts.append("GUIDANCE:\n" + "\n".join(f"[{d['id']}] {d['text']} (scope: {d['scope']}; source: {d['citation']})" for d in st["kb"]))
        if len(parts) == 2:
            parts.append("No data was retrieved.")
        out = llm.call(ANSWER_SYSTEM, [{"role": "user", "text": "\n\n".join(parts)}])
        return {"answer": out["text"].strip() or "I could not find an answer in the available data."}

    g = StateGraph(State)
    for name, fn in (("planner", planner), ("kb", kb), ("sessions", sessions), ("aggregate", aggregate)):
        g.add_node(name, fn)
    g.add_edge(START, "planner")
    g.add_conditional_edges("planner", route, ["kb", "sessions", "aggregate"])
    g.add_edge("kb", "aggregate")
    g.add_edge("sessions", "aggregate")
    g.add_edge("aggregate", END)
    return g.compile()


def answer(question, patient_id):
    out = build(patient_id).invoke({"question": question}, {"recursion_limit": 12})
    sources = [{k: d[k] for k in ("id", "citation", "url", "evidence")} for d in out.get("kb") or []]
    used = {"knowledge_base": bool(out.get("kb")), "sessions": [s["n"] for s in out.get("sessions") or []]}
    return out["answer"], sources, used