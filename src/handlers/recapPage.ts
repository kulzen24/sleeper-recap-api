import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { escapeHtml, renderParagraphs } from "../html";
import { parseWeek, resolveLeagueId } from "../params";
import { buildRecapData, type RecapData } from "../recapData";
import { getNotesState, type RecapContent } from "../recapNotes";
import { getLeague, getNflState } from "../sleeper";

const MAX_WEEK_NAV = 18;

function renderSuperlatives(superlatives: RecapContent["superlatives"]): string {
  if (superlatives.length === 0) return "";

  const cards = superlatives
    .map(
      (s) => `
      <article class="superlative-card">
        <h3>${escapeHtml(s.title)}</h3>
        <p class="winner">${escapeHtml(s.winner)}</p>
        <p class="blurb">${escapeHtml(s.blurb)}</p>
      </article>`,
    )
    .join("\n");

  return `<section class="superlatives"><h2>Superlatives</h2><div class="superlative-grid">${cards}</div></section>`;
}

function renderWeekNav(leagueId: string, currentWeek: number, upToWeek: number): string {
  const links = Array.from({ length: upToWeek }, (_, i) => i + 1)
    .map((w) => {
      const active = w === currentWeek ? ' class="active"' : "";
      const query = leagueId ? `?league_id=${encodeURIComponent(leagueId)}` : "";
      return `<a href="/recap-page/${w}${query}"${active}>Week ${w}</a>`;
    })
    .join("");

  return `<nav class="week-nav">${links}</nav>`;
}

function renderStatsSummary(data: RecapData): string {
  const { summary, standings } = data;

  const teamLine = (team: { manager: { display_name: string; team_name: string | null }; team_score: number } | null) =>
    team ? `${escapeHtml(team.manager.team_name ?? team.manager.display_name)} — ${team.team_score.toFixed(2)} pts` : "—";

  const marginLine = (m: { teams: Array<{ manager: { display_name: string; team_name: string | null } }>; margin: number } | null) =>
    m
      ? `${escapeHtml(m.teams[0].manager.team_name ?? m.teams[0].manager.display_name)} vs ${escapeHtml(m.teams[1].manager.team_name ?? m.teams[1].manager.display_name)} (${m.margin.toFixed(2)} pt margin)`
      : "—";

  const performanceRow = (p: { name: string; position: string | null; points: number; manager: { display_name: string; team_name: string | null } }) =>
    `<tr><td>${escapeHtml(p.name)}${p.position ? ` (${escapeHtml(p.position)})` : ""}</td><td>${escapeHtml(p.manager.team_name ?? p.manager.display_name)}</td><td>${p.points.toFixed(2)}</td></tr>`;

  const standingsRows = standings
    .map(
      (s) =>
        `<tr><td>${s.rank}</td><td>${escapeHtml(s.manager.team_name ?? s.manager.display_name)}</td><td>${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}</td><td>${s.points_for.toFixed(2)}</td></tr>`,
    )
    .join("\n");

  return `
    <section class="stats">
      <h2>The Numbers</h2>
      <ul class="stat-list">
        <li><strong>Highest score:</strong> ${teamLine(summary.highest_scoring_team)}</li>
        <li><strong>Lowest score:</strong> ${teamLine(summary.lowest_scoring_team)}</li>
        <li><strong>Closest matchup:</strong> ${marginLine(summary.closest_matchup)}</li>
        <li><strong>Largest margin:</strong> ${marginLine(summary.largest_margin)}</li>
      </ul>

      <h3>Top Starter Performances</h3>
      <table><tbody>${summary.top_starter_performances.map(performanceRow).join("\n")}</tbody></table>

      <h3>Best Bench Performances</h3>
      <table><tbody>${summary.highest_bench_scores.map(performanceRow).join("\n")}</tbody></table>

      <h3>Standings</h3>
      <table><tbody>${standingsRows}</tbody></table>
    </section>`;
}

function pageShell(opts: { title: string; leagueName: string; banner: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>
  :root { color-scheme: light dark; --fg:#1a1a1a; --bg:#fafafa; --muted:#666; --accent:#3b5bdb; --card:#fff; --border:#e2e2e2; }
  @media (prefers-color-scheme: dark) { :root { --fg:#eee; --bg:#141414; --muted:#aaa; --accent:#8ab4ff; --card:#1f1f1f; --border:#333; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 24px 20px 64px; }
  header h1 { margin: 0 0 4px; font-size: 1.6rem; }
  header p.league { margin: 0 0 20px; color: var(--muted); }
  .week-nav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
  .week-nav a { padding: 4px 10px; border-radius: 6px; text-decoration: none; color: var(--accent); border: 1px solid var(--border); font-size: 0.9rem; }
  .week-nav a.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .banner { background: #ffefc2; color: #6b4c00; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-weight: 600; }
  section { margin-bottom: 32px; }
  h2 { font-size: 1.2rem; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  h3 { font-size: 1rem; color: var(--muted); margin-bottom: 6px; }
  .write-up p { margin: 0 0 1em; }
  .superlative-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .superlative-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .superlative-card h3 { margin: 0 0 4px; color: var(--fg); font-size: 0.95rem; }
  .superlative-card .winner { margin: 0 0 6px; font-weight: 700; color: var(--accent); }
  .superlative-card .blurb { margin: 0; color: var(--muted); font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 4px; }
  td { padding: 4px 6px; border-bottom: 1px solid var(--border); }
  .empty-state { color: var(--muted); font-style: italic; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${escapeHtml(opts.title)}</h1>
    <p class="league">${escapeHtml(opts.leagueName)}</p>
  </header>
  ${opts.banner}
  ${opts.body}
</div>
</body>
</html>`;
}

export async function recapPageHandler(c: Context<{ Bindings: Bindings }>) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const [league, nflState, recapData, notesState] = await Promise.all([
    getLeague(leagueId),
    getNflState().catch(() => null),
    buildRecapData(leagueId, week),
    getNotesState(c.env.RECAP_NOTES, leagueId, week),
  ]);

  const previewToken = c.req.query("preview");
  const isPreview = Boolean(previewToken) && previewToken === c.env.RECAP_WRITE_TOKEN;
  const content = isPreview ? notesState.draft : notesState.published;
  const hasContent = Boolean(content && (content.title || content.write_up || content.superlatives.length > 0));

  const upToWeek = Math.min(MAX_WEEK_NAV, Math.max(week, nflState?.week ?? week));
  const pageTitle = (hasContent && content?.title) || `Week ${week} Recap`;

  const banner = isPreview
    ? '<div class="banner">DRAFT PREVIEW — this is not published. Only visible with the correct ?preview= token.</div>'
    : "";

  const editorial = hasContent
    ? `<section class="write-up">
        ${content?.write_up ? renderParagraphs(content.write_up) : ""}
      </section>
      ${renderSuperlatives(content?.superlatives ?? [])}`
    : `<p class="empty-state">${isPreview ? "No draft content yet." : "This week's recap hasn't been published yet."}</p>`;

  const body = `
    ${renderWeekNav(leagueId, week, upToWeek)}
    ${editorial}
    ${renderStatsSummary(recapData)}
  `;

  const html = pageShell({ title: pageTitle, leagueName: league.name, banner, body });

  return c.html(html);
}
