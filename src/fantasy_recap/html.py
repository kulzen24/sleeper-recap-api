import re


def escape_html(value: str) -> str:
    """Escapes text for safe interpolation into HTML. Every piece of stored
    recap content (title, write-up, superlatives) passes through this before
    it's ever placed in a page — it's user/ChatGPT-submitted text rendered on
    a public page, so it must never be trusted as markup."""
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def render_paragraphs(text: str) -> str:
    """Renders plain text as HTML paragraphs: a blank line starts a new
    paragraph, a single newline becomes a line break. Input is escaped first,
    so this is safe for untrusted text. Intentionally not markdown — keeps
    the write-up format predictable with no parsing surprises."""
    paragraphs = (p.strip() for p in re.split(r"\n\s*\n", text))
    return "\n".join(
        f"<p>{escape_html(p).replace(chr(10), '<br>')}</p>" for p in paragraphs if p
    )
