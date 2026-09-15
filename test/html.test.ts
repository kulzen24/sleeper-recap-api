import { describe, expect, it } from "vitest";
import { escapeHtml, renderParagraphs } from "../src/html";

describe("escapeHtml", () => {
  it("escapes the five HTML-sensitive characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Week 1 was wild")).toBe("Week 1 was wild");
  });
});

describe("renderParagraphs", () => {
  it("splits on blank lines into separate <p> tags", () => {
    const html = renderParagraphs("First paragraph.\n\nSecond paragraph.");
    expect(html).toBe("<p>First paragraph.</p>\n<p>Second paragraph.</p>");
  });

  it("converts single newlines within a paragraph to <br>", () => {
    const html = renderParagraphs("Line one\nLine two");
    expect(html).toBe("<p>Line one<br>Line two</p>");
  });

  it("escapes HTML inside the write-up so stored content can't inject markup", () => {
    const html = renderParagraphs('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("drops empty paragraphs from excess blank lines", () => {
    expect(renderParagraphs("Only one paragraph.\n\n\n\n")).toBe("<p>Only one paragraph.</p>");
  });
});
