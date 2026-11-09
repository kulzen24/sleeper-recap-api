import asyncio
from typing import Any
from urllib.parse import quote

from ..html import escape_html, render_paragraphs
from ..params import Ctx, parse_week, resolve_league_id
from ..recap_data import build_recap_data
from ..recap_notes import get_notes_state
from ..responses import html_response
from ..sleeper import get_league, get_nfl_state

MAX_WEEK_NAV = 18


async def _nfl_state_or_none() -> dict | None:
    try:
        return await get_nfl_state()
    except Exception:
        return None


def _manager_label(manager: dict[str, Any]) -> str:
    team_name = manager.get("team_name")
    return escape_html(team_name if team_name is not None else manager["display_name"])


def _render_superlatives(superlatives: list[dict[str, str]]) -> str:
    if not superlatives:
        return ""

    cards = "\n".join(
        f"""
      <article class="superlative-card">
        <h3>{escape_html(s["title"])}</h3>
        <p class="winner">{escape_html(s["winner"])}</p>
        <p class="blurb">{escape_html(s["blurb"])}</p>
      </article>"""
        for s in superlatives
    )

    return f'<section class="superlatives"><h2>Superlatives</h2><div class="superlative-grid">{cards}</div></section>'


def _render_week_nav(league_id: str, current_week: int, up_to_week: int) -> str:
    query = f"?league_id={quote(league_id, safe='')}" if league_id else ""

    def link(w: int) -> str:
        active = ' class="active"' if w == current_week else ""
        return f'<a href="/recap-page/{w}{query}"{active}>Week {w}</a>'

    links = "".join(link(w) for w in range(1, up_to_week + 1))

    return f'<nav class="week-nav">{links}</nav>'


def _render_stats_summary(data: dict[str, Any]) -> str:
    summary, standings = data["summary"], data["standings"]

    def team_line(team: dict | None) -> str:
        return f"{_manager_label(team['manager'])} — {team['team_score']:.2f} pts" if team else "—"

    def margin_line(m: dict | None) -> str:
        if not m:
            return "—"
        home, away = m["teams"][0]["manager"], m["teams"][1]["manager"]
        return f"{_manager_label(home)} vs {_manager_label(away)} ({m['margin']:.2f} pt margin)"

    def performance_row(p: dict) -> str:
        position = f" ({escape_html(p['position'])})" if p.get("position") else ""
        return (
            f"<tr><td>{escape_html(p['name'])}{position}</td>"
            f"<td>{_manager_label(p['manager'])}</td><td>{p['points']:.2f}</td></tr>"
        )

    def standings_row(s: dict) -> str:
        ties = f"-{s['ties']}" if s["ties"] else ""
        return (
            f"<tr><td>{s['rank']}</td><td>{_manager_label(s['manager'])}</td>"
            f"<td>{s['wins']}-{s['losses']}{ties}</td><td>{s['points_for']:.2f}</td></tr>"
        )

    standings_rows = "\n".join(standings_row(s) for s in standings)

    top_rows = "\n".join(performance_row(p) for p in summary["top_starter_performances"])
    bench_rows = "\n".join(performance_row(p) for p in summary["highest_bench_scores"])

    return f"""
    <section class="stats">
      <h2>The Numbers</h2>
      <ul class="stat-list">
        <li><strong>Highest score:</strong> {team_line(summary["highest_scoring_team"])}</li>
        <li><strong>Lowest score:</strong> {team_line(summary["lowest_scoring_team"])}</li>
        <li><strong>Closest matchup:</strong> {margin_line(summary["closest_matchup"])}</li>
        <li><strong>Largest margin:</strong> {margin_line(summary["largest_margin"])}</li>
      </ul>

      <h3>Top Starter Performances</h3>
      <table><tbody>{top_rows}</tbody></table>

      <h3>Best Bench Performances</h3>
      <table><tbody>{bench_rows}</tbody></table>

      <h3>Standings</h3>
      <table><tbody>{standings_rows}</tbody></table>
    </section>"""


def _page_shell(title: str, league_name: str, banner: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape_html(title)}</title>
<style>
  :root {{ color-scheme: light dark; --fg:#1a1a1a; --bg:#fafafa; --muted:#666; --accent:#3b5bdb; --card:#fff; --border:#e2e2e2; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --fg:#eee; --bg:#141414; --muted:#aaa; --accent:#8ab4ff; --card:#1f1f1f; --border:#333; }} }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }}
  .wrap {{ max-width: 760px; margin: 0 auto; padding: 24px 20px 64px; }}
  header h1 {{ margin: 0 0 4px; font-size: 1.6rem; }}
  header p.league {{ margin: 0 0 20px; color: var(--muted); }}
  .week-nav {{ display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }}
  .week-nav a {{ padding: 4px 10px; border-radius: 6px; text-decoration: none; color: var(--accent); border: 1px solid var(--border); font-size: 0.9rem; }}
  .week-nav a.active {{ background: var(--accent); color: #fff; border-color: var(--accent); }}
  .banner {{ background: #ffefc2; color: #6b4c00; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-weight: 600; }}
  section {{ margin-bottom: 32px; }}
  h2 {{ font-size: 1.2rem; border-bottom: 1px solid var(--border); padding-bottom: 6px; }}
  h3 {{ font-size: 1rem; color: var(--muted); margin-bottom: 6px; }}
  .write-up p {{ margin: 0 0 1em; }}
  .superlative-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }}
  .superlative-card {{ background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }}
  .superlative-card h3 {{ margin: 0 0 4px; color: var(--fg); font-size: 0.95rem; }}
  .superlative-card .winner {{ margin: 0 0 6px; font-weight: 700; color: var(--accent); }}
  .superlative-card .blurb {{ margin: 0; color: var(--muted); font-size: 0.9rem; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 4px; }}
  td {{ padding: 4px 6px; border-bottom: 1px solid var(--border); }}
  .empty-state {{ color: var(--muted); font-style: italic; }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>{escape_html(title)}</h1>
    <p class="league">{escape_html(league_name)}</p>
  </header>
  {banner}
  {body}
</div>
</body>
</html>"""


async def recap_page_handler(c: Ctx):
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    league, nfl_state, recap_data, notes_state = await asyncio.gather(
        get_league(league_id),
        _nfl_state_or_none(),
        build_recap_data(league_id, week),
        get_notes_state(c.env.RECAP_NOTES, league_id, week),
    )

    preview_token = c.query("preview")
    is_preview = bool(preview_token) and preview_token == c.env_var("RECAP_WRITE_TOKEN")
    content = notes_state["draft"] if is_preview else notes_state["published"]
    has_content = bool(
        content and (content["title"] or content["write_up"] or content["superlatives"])
    )

    current_week = (nfl_state or {}).get("week") or week
    up_to_week = min(MAX_WEEK_NAV, max(week, current_week))
    page_title = (has_content and content["title"]) or f"Week {week} Recap"

    banner = (
        '<div class="banner">DRAFT PREVIEW — this is not published. Only visible with the correct ?preview= token.</div>'
        if is_preview
        else ""
    )

    if has_content:
        write_up = render_paragraphs(content["write_up"]) if content["write_up"] else ""
        editorial = f"""<section class="write-up">
        {write_up}
      </section>
      {_render_superlatives(content["superlatives"])}"""
    else:
        message = "No draft content yet." if is_preview else "This week's recap hasn't been published yet."
        editorial = f'<p class="empty-state">{message}</p>'

    body = f"""
    {_render_week_nav(league_id, week, up_to_week)}
    {editorial}
    {_render_stats_summary(recap_data)}
  """

    return html_response(_page_shell(page_title, league["name"], banner, body))
