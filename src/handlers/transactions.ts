import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { parseWeek, resolveLeagueId } from "../params";
import { getTransactions } from "../sleeper";
import { resolveTransaction } from "../transactions";

export async function transactionsHandler(c: Context<{ Bindings: Bindings }>) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const [transactions, { players, managers }] = await Promise.all([
    getTransactions(leagueId, week),
    loadLeagueContext(leagueId),
  ]);

  return c.json({
    week,
    transactions: transactions.map((t) => resolveTransaction(t, players, managers)),
  });
}
