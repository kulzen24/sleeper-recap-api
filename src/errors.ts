/** A typed error carrying the HTTP status that should be sent to the
 * client. Thrown from anywhere in the request pipeline and turned into a
 * JSON error body by the Hono error handler in index.ts. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function badRequest(message: string): never {
  throw new ApiError(message, 400);
}
