import json
import re


def repair_json(raw: str) -> dict:
    """Attempt to parse and repair LLM JSON output."""
    # Strip markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try closing brackets
    for suffix in ["}", "]}", "]}]}}", '"}']:
        try:
            return json.loads(cleaned + suffix)
        except json.JSONDecodeError:
            continue

    # Walk backwards to find last complete JSON object
    for i in range(len(cleaned) - 1, 0, -1):
        if cleaned[i] == "}":
            try:
                return json.loads(cleaned[: i + 1])
            except json.JSONDecodeError:
                continue

    raise ValueError(f"Could not repair JSON: {raw[:200]}...")
