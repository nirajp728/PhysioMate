"""The one place that talks to Gemini. Tests replace it with set_llm()."""
from functools import lru_cache

from config import Config

_llm = None


def set_llm(fn):
    """fn(system, history, specs) -> {"raw", "calls": [{"name","args"}], "text"}"""
    global _llm
    _llm = fn


@lru_cache(maxsize=1)
def client():
    """One shared client. A throw-away one gets closed when Python cleans it up, mid-request."""
    from google import genai

    return genai.Client(api_key=Config.GEMINI_API_KEY)


def configured():
    return bool(_llm or Config.GEMINI_API_KEY)


def to_contents(history):
    from google.genai import types

    out, pending = [], []
    for h in history:
        if h["role"] == "tool":  # all results of one round go back together
            pending.append(types.Part.from_function_response(name=h["name"], response={"result": h["result"]}))
            continue
        if pending:
            out.append(types.Content(role="user", parts=pending))
            pending = []
        out.append(types.Content(role="user", parts=[types.Part.from_text(text=h["text"])]) if h["role"] == "user" else h["raw"])
    if pending:
        out.append(types.Content(role="user", parts=pending))
    return out


def gemini(system, history, specs=None):
    from google.genai import types

    kw = {}
    if specs:  # we run the tools ourselves, so automatic calling is off
        kw = dict(tools=[types.Tool(function_declarations=[types.FunctionDeclaration(**s) for s in specs])],
                  automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
    r = client().models.generate_content(
        model=Config.GEMINI_MODEL, contents=to_contents(history),
        config=types.GenerateContentConfig(system_instruction=system, temperature=0.2, **kw))
    content = r.candidates[0].content  # sent back as-is on the next round (keeps the model's own state)
    parts = content.parts or []
    return {"raw": content,
            "calls": [{"name": p.function_call.name, "args": dict(p.function_call.args or {})} for p in parts if p.function_call],
            "text": "".join(p.text for p in parts if p.text and not p.thought)}


def call(system, history, specs=None):
    return (_llm or gemini)(system, history, specs)