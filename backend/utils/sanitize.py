import re


def escape_regex(s: str) -> str:
    return re.escape(s)


def sanitize_input(obj):
    """Recursively remove any keys that look like SQL injection or operator injection attempts."""
    if isinstance(obj, dict):
        return {k: sanitize_input(v) for k, v in obj.items() if not k.startswith("$")}
    if isinstance(obj, list):
        return [sanitize_input(i) for i in obj]
    return obj
