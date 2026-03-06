import re


def split_chapters(text: str) -> list[dict]:
    """Split novel text into chapters.

    Returns list of {title, content, index}.
    Falls back to splitting by ~5000 chars if no chapter markers found.
    """
    pattern = re.compile(
        r"^(第[\d一二三四五六七八九十百千万]+[章回][\s：:].*)$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(text))

    if not matches:
        # Also try "Chapter N"
        pattern = re.compile(r"^(Chapter\s+\d+.*)$", re.MULTILINE | re.IGNORECASE)
        matches = list(pattern.finditer(text))

    if not matches:
        # Fallback: split by ~5000 chars
        chunk_size = 5000
        chapters = []
        for i in range(0, len(text), chunk_size):
            chunk = text[i : i + chunk_size]
            chapters.append(
                {"title": f"Part {len(chapters) + 1}", "content": chunk.strip(), "index": len(chapters) + 1}
            )
        return chapters

    chapters = []
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        chapters.append({"title": title, "content": content, "index": i + 1})

    return chapters
