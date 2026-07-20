import { describe, it, expect } from 'vitest';
import {
  ConflictError,
  DataIntegrityError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  isDomainError
} from './errors';
import { createServerErrorData, mapDomainError } from './api-helpers';

describe('domain errors', () => {
  it.each([
    [new NotFoundError('Session not found.'), 404, 'NOT_FOUND'],
    [new ForbiddenError('You cannot update this exercise.'), 403, 'FORBIDDEN'],
    [new ConflictError('Session cannot be completed.'), 400, 'CONFLICT'],
    [new DataIntegrityError('Plan ID missing from the session.'), 500, 'DATA_INTEGRITY_ERROR'],
  ])('should carry the status and default code for %s', (error, status, code) => {
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should accept an explicit code and type', () => {
    const error = new NotFoundError('Plan day not found.', 'PLAN_DAY_NOT_FOUND', 'plan_day_not_found_error');

    expect(error.code).toBe('PLAN_DAY_NOT_FOUND');
    expect(error.type).toBe('plan_day_not_found_error');
  });

  it('should return 404 for a resource the user does not own, not 400', () => {
    // Ownership failures and missing resources deliberately share one status, so the response
    // cannot be used to probe which ids exist. They previously returned 400 from one handler and
    // 404 from another for the very same condition.
    expect(new NotFoundError('Plan not found.').status).toBe(404);
  });

  describe('isDomainError', () => {
    it('should recognise a domain error', () => {
      expect(isDomainError(new ConflictError('nope'))).toBe(true);
    });

    it('should recognise an error branded by another copy of this module', () => {
      // A bundling seam can load this module twice, making `instanceof` fail across the seam.
      // The brand is a registry symbol, so both copies agree on it.
      const crossBoundary = Object.assign(new Error('nope'), {
        [Symbol.for('@txg/api.DomainError')]: true,
        status: 404,
        code: 'NOT_FOUND',
        type: 'x',
      });

      expect(isDomainError(crossBoundary)).toBe(true);
    });

    it('should reject a foreign error that merely has the same shape', () => {
      // Supabase's AuthError carries a numeric `status` and a string `code`. Treating it as a
      // domain error forwarded its raw message and status to the client, defeating the policy
      // that server faults never disclose their internals.
      const authError = Object.assign(new Error('Invalid Refresh Token: Already Used'), {
        name: 'AuthApiError',
        status: 400,
        code: 'refresh_token_already_used',
      });

      expect(isDomainError(authError)).toBe(false);
    });

    it.each([
      ['a plain error', new Error('boom')],
      ['a string', 'boom'],
      ['null', null],
      ['undefined', undefined],
    ])('should reject %s', (_label, value) => {
      expect(isDomainError(value)).toBe(false);
    });
  });
});

describe('mapDomainError', () => {
  it('should map a domain error to its status, message and code', () => {
    const response = mapDomainError(new NotFoundError('Session set not found.', 'SESSION_SET_NOT_FOUND', 'session_set_not_found_error'));

    expect(response).toMatchObject({
      status: 404,
      error: 'Session set not found.',
      code: 'SESSION_SET_NOT_FOUND',
      details: { type: 'session_set_not_found_error' },
    });
  });

  it('should return null for an unexpected error so the caller falls back to a 500', () => {
    expect(mapDomainError(new Error('connection reset'))).toBeNull();
  });

  it('should not forward a library error that happens to carry a status and a code', () => {
    const authError = Object.assign(new Error('Invalid Refresh Token: Already Used'), {
      name: 'AuthApiError',
      status: 400,
      code: 'refresh_token_already_used',
    });

    expect(mapDomainError(authError)).toBeNull();
  });

  it('should map a 5xx domain error without losing its status', () => {
    const response = mapDomainError(new DataIntegrityError('Plan ID missing from the session.'));

    expect(response?.status).toBe(500);
  });
});

describe('createServerErrorData', () => {
  it('should not disclose the underlying error to the client', () => {
    const response = createServerErrorData(
      'Failed to get sessions',
      new Error('duplicate key value violates unique constraint "sessions_pkey"')
    );

    expect(JSON.stringify(response)).not.toContain('sessions_pkey');
    expect(response.error).toBe('Failed to get sessions');
  });

  it('should return a correlation id so a report can be matched to a log line', () => {
    const response = createServerErrorData('Failed to get sessions', new Error('boom'));

    expect(response.details?.['correlationId']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.code).toBe('INTERNAL_ERROR');
  });

  it('should give each fault its own correlation id', () => {
    const first = createServerErrorData('Failed', new Error('boom'));
    const second = createServerErrorData('Failed', new Error('boom'));

    expect(first.details?.['correlationId']).not.toBe(second.details?.['correlationId']);
  });
});
