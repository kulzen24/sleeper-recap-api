import unittest

from fantasy_recap.html import escape_html, render_paragraphs


class EscapeHtmlTest(unittest.TestCase):
    def test_escapes_the_five_html_sensitive_characters(self):
        self.assertEqual(
            escape_html("""<script>alert("x") & 'y'</script>"""),
            "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
        )

    def test_leaves_plain_text_untouched(self):
        self.assertEqual(escape_html("Week 1 was wild"), "Week 1 was wild")


class RenderParagraphsTest(unittest.TestCase):
    def test_splits_on_blank_lines_into_separate_p_tags(self):
        self.assertEqual(
            render_paragraphs("First paragraph.\n\nSecond paragraph."),
            "<p>First paragraph.</p>\n<p>Second paragraph.</p>",
        )

    def test_converts_single_newlines_within_a_paragraph_to_br(self):
        self.assertEqual(render_paragraphs("Line one\nLine two"), "<p>Line one<br>Line two</p>")

    def test_escapes_html_inside_the_write_up(self):
        html = render_paragraphs('<img src=x onerror="alert(1)">')
        self.assertNotIn("<img", html)
        self.assertIn("&lt;img", html)

    def test_drops_empty_paragraphs_from_excess_blank_lines(self):
        self.assertEqual(render_paragraphs("Only one paragraph.\n\n\n\n"), "<p>Only one paragraph.</p>")
