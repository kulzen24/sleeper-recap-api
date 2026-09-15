/** Escapes text for safe interpolation into HTML. Every piece of stored
 * recap content (title, write-up, superlatives) passes through this before
 * it's ever placed in a page — it's user/ChatGPT-submitted text rendered on
 * a public page, so it must never be trusted as markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders plain text as HTML paragraphs: a blank line starts a new
 * paragraph, a single newline becomes a line break. Input is escaped first,
 * so this is safe for untrusted text. Intentionally not markdown — keeps
 * the write-up format predictable with no parsing surprises. */
export function renderParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
