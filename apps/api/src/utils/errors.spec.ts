import { describe, it, expect } from 'vitest';
import {
  ConflictError,
  DataIntegrityError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  isDomainError
} from './errors';
import { mapDomainError } from './api-helpers';

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

    it('should recognise a structurally compatible error across a module boundary', () => {
      const crossBoundary = Object.assign(new Error('nope'), { status: 404, code: 'NOT_FOUND', type: 'x' });

      expect(isDomainError(crossBoundary)).toBe(true);
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

  it('should map a 5xx domain error without losing its status', () => {
    const response = mapDomainError(new DataIntegrityError('Plan ID missing from the session.'));

    expect(response?.status).toBe(500);
  });
});
