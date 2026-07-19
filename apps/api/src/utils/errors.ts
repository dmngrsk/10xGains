import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Base class for errors that carry their own HTTP semantics.
 *
 * Error identity used to live in the prose of the message, matched with `error.message.includes()`
 * across seven per-repository handlers plus `patch-base.ts`. That made status codes depend on
 * wording - rephrasing a message silently changed the response, and the same underlying condition
 * mapped to different statuses depending on which handler caught it. Throwing one of these instead
 * makes the status, the client-facing code and the log category explicit at the throw site, and
 * lets a single mapper (`mapDomainError`) turn any of them into a response.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    /** The HTTP status this condition should produce. */
    readonly status: ContentfulStatusCode,
    /** Stable, machine-readable identifier for clients. */
    readonly code: string,
    /** Category recorded in the error response details, for log grouping. */
    readonly type: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A resource does not exist, or does not belong to the authenticated user.
 *
 * Both cases deliberately produce the same 404. Distinguishing them would tell an attacker which
 * ids exist, and the project's convention (see the root CLAUDE.md) is to return 404 for resources
 * that do not exist *or* do not belong to the user. Ownership failures previously returned 400 with
 * an ownership-specific code, which contradicted that and disagreed with the sibling handler that
 * mapped the very same condition to 404.
 */
export class NotFoundError extends DomainError {
  constructor(message: string, code = 'NOT_FOUND', type = 'not_found_error') {
    super(message, 404, code, type);
  }
}

/**
 * The caller is authenticated but not allowed to perform this action at all.
 *
 * Distinct from {@link NotFoundError}: this is for actions denied regardless of which resource is
 * targeted (editing the shared exercise catalog), not for resources the user simply cannot see.
 */
export class ForbiddenError extends DomainError {
  constructor(message: string, code = 'FORBIDDEN', type = 'forbidden_error') {
    super(message, 403, code, type);
  }
}

/**
 * The request is well-formed but conflicts with the current state of the resource, such as
 * completing a session that is not in progress.
 */
export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT', type = 'conflict_error') {
    super(message, 400, code, type);
  }
}

/**
 * Stored data is inconsistent in a way the user cannot cause or correct - a session whose plan
 * reference is missing, a plan whose next day cannot be determined. These are genuine server
 * faults, so they map to 500, but they are still typed so the message reaching the client is a
 * deliberate one rather than a raw internal string.
 */
export class DataIntegrityError extends DomainError {
  constructor(message: string, code = 'DATA_INTEGRITY_ERROR', type = 'data_integrity_error') {
    super(message, 500, code, type);
  }
}

/**
 * Narrows an unknown thrown value to a {@link DomainError}.
 *
 * Uses a duck-typed check rather than `instanceof` so that an error crossing a module boundary
 * (or a bundling seam that duplicates the class) is still recognised.
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
    || (error instanceof Error
      && typeof (error as Partial<DomainError>).status === 'number'
      && typeof (error as Partial<DomainError>).code === 'string');
}
