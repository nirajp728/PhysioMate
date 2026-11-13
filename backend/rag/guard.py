"""PII guard for the user's question, run BEFORE anything reaches the model or the logs.
Aadhaar, card and PAN numbers are blocked. Phone numbers and e-mail addresses are replaced and the question goes on."""
import re

# Verhoeff check (the checksum Aadhaar numbers use), so random 12-digit numbers are not blocked
_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
      [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]]
_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
      [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]]


def verhoeff_ok(num):
    c = 0
    for i, ch in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def luhn_ok(num):
    total = 0
    for i, ch in enumerate(reversed(num)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


CARD = re.compile(r"(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)")
AADHAAR = re.compile(r"(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)")
PAN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b", re.I)
PHONE = re.compile(r"(?<!\d)(?:(?:\+91|0091|91)[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


def _digits(s):
    return re.sub(r"\D", "", s)


def scan(text):
    """Returns {"blocked": [...types], "redacted": [...types], "text": cleaned text}."""
    blocked = []
    if any(luhn_ok(_digits(m.group())) for m in CARD.finditer(text)):
        blocked.append("a card number")
    if any(verhoeff_ok(_digits(m.group())) for m in AADHAAR.finditer(text)):
        blocked.append("an Aadhaar number")
    if PAN.search(text):
        blocked.append("a PAN number")
    redacted = []
    for name, rx, tag in (("phone", PHONE, "[PHONE]"), ("email", EMAIL, "[EMAIL]")):
        text, n = rx.subn(tag, text)
        if n:
            redacted.append(name)
    return {"blocked": blocked, "redacted": redacted, "text": text}