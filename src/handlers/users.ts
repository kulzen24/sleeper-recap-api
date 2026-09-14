import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { resolveLeagueId } from "../params";
import { getLeagueUsers } from "../sleeper";

export async function usersHandler(c: Context<{ Bindings: Bindings }>) {
  const users = await getLeagueUsers(resolveLeagueId(c));

  return c.json(
    users.map((user) => ({
      user_id: user.user_id,
      display_name: user.display_name,
      team_name: user.metadata?.team_name ?? null,
      is_commissioner: user.is_owner === true,
    })),
  );
}
