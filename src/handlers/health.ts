import type { Context } from "hono";
import type { Bindings } from "../bindings";

export function healthHandler(c: Context<{ Bindings: Bindings }>) {
  return c.json({ status: "ok", time: new Date().toISOString() });
}
