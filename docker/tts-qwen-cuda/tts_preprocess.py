"""German text preprocessing for Qwen3-TTS.

Qwen3-TTS produces gibberish on raw "Dr.", "1789", "GmbH" — the model was
trained on already-normalised text. The hosted Hetzner deployment runs a
similar pipeline before every call; this is the general-purpose subset
(no ChipMates-specific philosopher-name IPA hints, which only matter for
the bio audio pipeline).

Order matters:
    1. Abbreviation expansion (so numbers in "Dr. 5" are seen later)
    2. Number normalisation (4-digit years, plain integers, ordinals)
    3. Punctuation tidy (collapse runs, ensure end-stop)
"""

from __future__ import annotations

import re
from typing import Iterable

_ABBREVIATIONS = {
    "Dr.": "Doktor",
    "Prof.": "Professor",
    "Mag.": "Magister",
    "Hr.": "Herr",
    "Fr.": "Frau",
    "z. B.": "zum Beispiel",
    "z.B.": "zum Beispiel",
    "u. a.": "unter anderem",
    "u.a.": "unter anderem",
    "d. h.": "das heißt",
    "d.h.": "das heißt",
    "ggf.": "gegebenenfalls",
    "etc.": "et cetera",
    "usw.": "und so weiter",
    "ca.": "circa",
    "vs.": "versus",
    "St.": "Sankt",
    "Nr.": "Nummer",
    "Mio.": "Millionen",
    "Mrd.": "Milliarden",
    "Tsd.": "Tausend",
    "GmbH": "G M B H",
    "AG": "A G",
    "EU": "E U",
    "USA": "U S A",
    "PhD": "P H D",
    "KI": "K I",
}

_UNITS = [
    "null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
]
_TEENS = {
    10: "zehn", 11: "elf", 12: "zwölf", 13: "dreizehn", 14: "vierzehn",
    15: "fünfzehn", 16: "sechzehn", 17: "siebzehn", 18: "achtzehn", 19: "neunzehn",
}
_TENS = {
    20: "zwanzig", 30: "dreißig", 40: "vierzig", 50: "fünfzig",
    60: "sechzig", 70: "siebzig", 80: "achtzig", 90: "neunzig",
}


def _spell_under_100(n: int) -> str:
    if n < 10:
        return _UNITS[n]
    if n < 20:
        return _TEENS[n]
    tens = (n // 10) * 10
    ones = n % 10
    if ones == 0:
        return _TENS[tens]
    unit = "ein" if ones == 1 else _UNITS[ones]
    return f"{unit}und{_TENS[tens]}"


def _spell_year(n: int) -> str:
    """Year-style: 1789 → 'siebzehnhundertneunundachtzig'."""
    if 1100 <= n <= 1999:
        hundreds = n // 100
        rest = n % 100
        hundred_word = f"{_UNITS[hundreds] if hundreds != 1 else 'ein'}hundert"
        if rest == 0:
            return hundred_word
        return hundred_word + _spell_under_100(rest)
    return _spell_integer(n)


def _spell_integer(n: int) -> str:
    if n < 0:
        return "minus " + _spell_integer(-n)
    if n < 100:
        return _spell_under_100(n)
    if n < 1000:
        hundreds = n // 100
        rest = n % 100
        word = f"{_UNITS[hundreds] if hundreds != 1 else 'ein'}hundert"
        if rest:
            return word + _spell_under_100(rest)
        return word
    if n < 1_000_000:
        thousands = n // 1000
        rest = n % 1000
        word = "eintausend" if thousands == 1 else _spell_integer(thousands) + "tausend"
        if rest:
            return word + _spell_integer(rest)
        return word
    return str(n)


def _replace_numbers(text: str) -> str:
    def replace(match: re.Match) -> str:
        raw = match.group(0)
        if raw.isdigit():
            n = int(raw)
            # 4-digit numbers in 1100..1999 read as years; others as plain integers.
            if len(raw) == 4 and 1100 <= n <= 1999:
                return _spell_year(n)
            return _spell_integer(n)
        return raw

    return re.sub(r"\d+", replace, text)


def _apply_abbreviations(text: str, mapping: Iterable[tuple[str, str]]) -> str:
    for src, dst in mapping:
        text = text.replace(src, dst)
    return text


def preprocess_de(text: str) -> str:
    """Run the full DE normalisation pipeline."""
    if not text:
        return text
    text = _apply_abbreviations(text, _ABBREVIATIONS.items())
    text = _replace_numbers(text)
    # Collapse multiple spaces / dashes / quote artifacts.
    text = re.sub(r"\s+", " ", text)
    text = text.replace(" ,", ",").replace(" .", ".")
    text = text.strip()
    if text and text[-1] not in ".!?;:":
        text += "."
    return text
