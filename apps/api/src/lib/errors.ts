// apps/api/src/lib/errors.ts
// Typed API errors — thrown in services, caught in route handlers.
// Having a typed error hierarchy means we can handle HTTP codes centrally.

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      "NOT_FOUND",
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super("FORBIDDEN", message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

// Helper to format any error into our standard API error envelope
export function formatError(err: unknown) {
  if (err instanceof AppError) {
    return {
      success: false as const,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
  }
  // Unknown errors — don't leak internals in production
  const message =
    process.env["NODE_ENV"] === "development" && err instanceof Error
      ? err.message
      : "An unexpected error occurred";
  return {
    success: false as const,
    error: { code: "INTERNAL_ERROR", message },
  };
}
