import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription, BehaviorSubject, of, timer } from 'rxjs';
import { take } from 'rxjs/operators';

/**
 * Defines the structure for a successful debounced operation event.
 * @template TData Type of the data associated with the success event.
 * @template TContext Type of the context associated with the success event.
 */
export interface DebouncerSuccessEvent<TData, TContext> {
  data: TData;
  context: TContext;
  key: string;
}

/**
 * Defines the structure for a failed debounced operation event.
 * @template TContext Type of the context associated with the failure event.
 * @template TError Type of the error associated with the failure event.
 */
export interface DebouncerFailureEvent<TContext, TError = Error> {
  error: TError;
  context: TContext;
  key: string;
}

/**
 * Represents the result of an enqueued operation, providing observables for the direct API response,
 * a success event payload, or a failure event payload.
 * @template ApiResponse Type of the direct API response.
 * @template SuccessEventPayload Type of the fully constructed success event.
 * @template FailureEventPayload Type of the fully constructed failure event.
 */
export interface EnqueueResult<ApiResponse, SuccessEventPayload, FailureEventPayload> {
  response$: Observable<ApiResponse>;
  successEvent$: Observable<SuccessEventPayload>;
  failureEvent$: Observable<FailureEventPayload>;
}

/**
 * An operation waiting out its debounce window.
 *
 * At most one of these exists at a time: enqueueing a different key flushes the previous one
 * immediately, and enqueueing the same key replaces it. That is why this is a single slot rather
 * than the map-per-concern the previous implementation carried.
 */
interface PendingOperation {
  key: string;
  /** Runs the operation, returning a stream that completes once it has settled. */
  run: () => Observable<void>;
  /** Abandons the operation because a newer one for the same key replaced it. */
  discard: () => void;
}

/**
 * Provides a keyed debouncing mechanism for observable-based operations (e.g., API calls).
 *
 * Operations are scheduled under a key. Scheduling again under the same key within the debounce
 * window replaces the earlier one, which never runs. Scheduling under a *different* key flushes the
 * pending one immediately, so edits are never silently dropped when the user moves on.
 *
 * For each enqueued operation the caller gets three observables:
 * - `response$`: the raw API response, or the error the call failed with.
 * - `successEvent$`: the payload built by `buildSuccessEvent`, if the call succeeded.
 * - `failureEvent$`: the payload built by `buildFailureEvent`, if the call failed.
 *
 * `success$` and `failure$` mirror every operation's events for centralised handling.
 */
@Injectable({
  providedIn: 'root',
})
export class KeyedDebouncerService implements OnDestroy {
  public readonly success$: Observable<DebouncerSuccessEvent<unknown, unknown>>;
  public readonly failure$: Observable<DebouncerFailureEvent<unknown, unknown>>;
  public readonly processingKey$: Observable<string | null>;

  private debounceMs = 1000;
  private pending: PendingOperation | null = null;
  private debounceTimer: Subscription | null = null;
  private settled$: Subject<void> | null = null;

  private readonly _success$ = new Subject<DebouncerSuccessEvent<unknown, unknown>>();
  private readonly _failure$ = new Subject<DebouncerFailureEvent<unknown, unknown>>();
  private readonly _processingKey$ = new BehaviorSubject<string | null>(null);

  constructor() {
    this.success$ = this._success$.asObservable();
    this.failure$ = this._failure$.asObservable();
    this.processingKey$ = this._processingKey$.asObservable();
  }

  /**
   * Sets the debounce window applied to subsequent operations.
   * @param ms The debounce time in milliseconds.
   */
  public setDebounceTime(ms: number): void {
    this.debounceMs = ms;
  }

  /**
   * Enqueues an operation to be executed after the debounce window.
   *
   * @template ApiResponse The type of the expected API response.
   * @template SuccessEventPayload The type of the payload for successful events.
   * @template FailureEventPayload The type of the payload for failure events.
   * @template SuccessCtx The type of the context object for success events.
   * @template FailureCtx The type of the context object for failure events.
   * @template ErrType The type of error expected from the API call or during processing.
   *
   * @param key A unique string key to identify the operation. Operations with the same key are debounced.
   * @param requestFactoryCallback A function that returns an Observable, typically an API call.
   * @param successContext A context object to be passed to the `buildSuccessEvent` function.
   * @param failureContext A context object to be passed to the `buildFailureEvent` function.
   * @param buildSuccessEvent Builds the success payload from the API response, context and key.
   * @param buildFailureEvent Builds the failure payload from the error, context and key.
   * @returns An `EnqueueResult` object with observables for the response, success event, and failure event.
   */
  public enqueue<ApiResponse, SuccessEventPayload, FailureEventPayload, SuccessCtx, FailureCtx, ErrType = Error>(
    key: string,
    requestFactoryCallback: () => Observable<ApiResponse>,
    successContext: SuccessCtx,
    failureContext: FailureCtx,
    buildSuccessEvent: (response: ApiResponse, context: SuccessCtx, key: string) => SuccessEventPayload,
    buildFailureEvent: (error: ErrType, context: FailureCtx, key: string) => FailureEventPayload
  ): EnqueueResult<ApiResponse, SuccessEventPayload, FailureEventPayload> {
    const response$ = new Subject<ApiResponse>();
    const successEvent$ = new Subject<SuccessEventPayload>();
    const failureEvent$ = new Subject<FailureEventPayload>();

    // Moving to a different key means the previous edit is final - run it rather than lose it.
    if (this.pending && this.pending.key !== key) {
      this.runPending();
    }

    // A newer edit of the same thing supersedes the queued one, which never ran and reports nothing.
    this.pending?.discard();
    this.debounceTimer?.unsubscribe();

    const run = (): Observable<void> => {
      const settled = new Subject<void>();
      this.settled$ = settled;
      this._processingKey$.next(key);

      const finish = () => {
        if (this._processingKey$.value === key) {
          this._processingKey$.next(null);
        }
        response$.complete();
        successEvent$.complete();
        failureEvent$.complete();
        if (this.settled$ === settled) {
          this.settled$ = null;
        }
        settled.next();
        settled.complete();
      };

      requestFactoryCallback().pipe(take(1)).subscribe({
        next: (value) => {
          const event = buildSuccessEvent(value, successContext, key);
          this._success$.next(event as DebouncerSuccessEvent<unknown, unknown>);
          successEvent$.next(event);
          response$.next(value);
        },
        error: (err: unknown) => {
          const event = buildFailureEvent(this.toError<ErrType>(err), failureContext, key);
          this._failure$.next(event as DebouncerFailureEvent<unknown, unknown>);
          failureEvent$.next(event);
          response$.error(err);
          finish();
        },
        complete: finish,
      });

      return settled;
    };

    // A superseded operation completes its observables without emitting, so subscribers simply see
    // nothing happen rather than having to distinguish "no result" from a result of `undefined`.
    const discard = () => {
      response$.complete();
      successEvent$.complete();
      failureEvent$.complete();
    };

    this.pending = { key, run, discard };
    this.debounceTimer = timer(this.debounceMs).pipe(take(1)).subscribe(() => this.runPending());

    return {
      response$: response$.asObservable(),
      successEvent$: successEvent$.asObservable(),
      failureEvent$: failureEvent$.asObservable(),
    };
  }

  /**
   * Settles the operation currently in flight or waiting out its debounce window.
   *
   * Both states have to be covered. Looking only at `pending` misses an operation whose debounce
   * has already elapsed and whose request is on the wire - callers that treat this as "all my
   * writes have landed" then race it. Completing a session that way let the server read the last
   * set as still PENDING, mark it SKIPPED over the completion arriving mid-flight, and score the
   * exercise as failed.
   *
   * @returns An Observable that completes once that operation has settled, or immediately if there is none.
   */
  public flushCurrentActiveDebounce(): Observable<void> {
    const key = this.pending?.key ?? this._processingKey$.value;
    return key ? this.flush(key) : of(undefined);
  }

  /**
   * Immediately executes any pending operation for the specified key.
   * @param key The key of the operation to flush.
   * @returns An Observable that completes once the operation has settled, or immediately if there is nothing to flush.
   */
  public flush(key: string): Observable<void> {
    if (this.pending?.key === key) {
      return this.runPending() ?? of(undefined);
    }

    // Already running: wait for the in-flight call rather than reporting completion early.
    if (this._processingKey$.value === key && this.settled$) {
      return this.settled$.asObservable().pipe(take(1));
    }

    return of(undefined);
  }

  /**
   * Gets the key of the operation currently waiting out its debounce window.
   * @returns The key string, or null if nothing is pending.
   */
  public getCurrentlyDebouncingKey(): string | null {
    return this.pending?.key ?? null;
  }

  /**
   * Cleans up resources when the service is destroyed.
   */
  public ngOnDestroy(): void {
    this.debounceTimer?.unsubscribe();
    this.pending?.discard();
    this.pending = null;
    this._success$.complete();
    this._failure$.complete();
    this._processingKey$.complete();
  }

  /**
   * Runs the pending operation now, cancelling its debounce timer.
   *
   * @returns A stream completing once the operation settles, or null if there was nothing pending.
   */
  private runPending(): Observable<void> | null {
    const pending = this.pending;
    if (!pending) {
      return null;
    }

    this.debounceTimer?.unsubscribe();
    this.debounceTimer = null;
    this.pending = null;

    return pending.run().pipe(take(1));
  }

  /**
   * Coerces an unknown thrown value into the error type the caller expects.
   *
   * Anything that is not already an Error is wrapped in one, so failure payloads always receive
   * something with a readable message.
   */
  private toError<ErrType>(err: unknown): ErrType {
    if (err instanceof Error || typeof err === 'string') {
      return err as ErrType;
    }
    return new Error(`Debouncer stream error: ${JSON.stringify(err)}`) as ErrType;
  }
}
