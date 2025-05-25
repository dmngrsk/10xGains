import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, of, BehaviorSubject, Subscription, ReplaySubject, timer } from 'rxjs';
import { map, catchError, finalize, take } from 'rxjs/operators';

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
 * Provides a keyed debouncing mechanism for observable-based operations (e.g., API calls).
 *
 * This service allows scheduling operations (factories returning Observables) identified by a unique key.
 * If multiple operations are scheduled for the same key within the debounce time, only the latest one is executed.
 * If a new operation is scheduled for a *different* key, any pending operation for the *previous* key is flushed immediately.
 *
 * For each enqueued operation, it returns an `EnqueueResult` object containing three observables:
 * - `response$`: Emits the raw API response or an error from the API call.
 * - `successEvent$`: Emits a custom success event payload (built by a provided function) if the API call succeeds.
 * - `failureEvent$`: Emits a custom failure event payload (built by a provided function) if the API call fails or an error occurs.
 *
 * Additionally, the service exposes global `success$` and `failure$` observables that emit all success/failure event payloads
 * from any enqueued operation, allowing for centralized event handling if needed.
 */
@Injectable({
  providedIn: 'root',
})
export class KeyedDebouncerService implements OnDestroy {
  public readonly success$: Observable<DebouncerSuccessEvent<unknown, unknown>>;
  public readonly failure$: Observable<DebouncerFailureEvent<unknown, unknown>>;
  public readonly processingKey$: Observable<string | null>;

  private defaultDebounceTimeMs = 1000;
  private internalDebouncer: KeyedDebouncedExecutor<BaseExecutorPayload>;
  private readonly _success$ = new Subject<DebouncerSuccessEvent<unknown, unknown>>();
  private readonly _failure$ = new Subject<DebouncerFailureEvent<unknown, unknown>>();
  private readonly _processingKey$ = new BehaviorSubject<string | null>(null);
  private readonly flushCompletionNotifiers = new Map<string, Subject<void>>();

  constructor() {
    this.internalDebouncer = new KeyedDebouncedExecutor<BaseExecutorPayload>(this.defaultDebounceTimeMs);
    this.success$ = this._success$.asObservable();
    this.failure$ = this._failure$.asObservable();
    this.processingKey$ = this._processingKey$.asObservable();
  }

  /**
   * Sets a new debounce time for subsequent operations.
   * Note: This recreates the internal debouncer instance.
   * @param ms The debounce time in milliseconds.
   */
  public setDebounceTime(ms: number): void {
    this.internalDebouncer.destroy();
    this.internalDebouncer = new KeyedDebouncedExecutor<BaseExecutorPayload>(ms);
    this.defaultDebounceTimeMs = ms;
  }

  /**
   * Enqueues an operation to be executed after a debounce period.
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
   * @param buildSuccessEvent A function that takes the API response, success context, and key, and returns a `SuccessEventPayload`.
   * @param buildFailureEvent A function that takes an error, failure context, and key, and returns a `FailureEventPayload`.
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
    type SpecificPayload = ExecutorPayloadWrapper<ApiResponse, SuccessCtx, FailureCtx, SuccessEventPayload, FailureEventPayload, ErrType>;

    const perCallResponse$ = new Subject<ApiResponse>();
    const perCallSuccessEvent$ = new Subject<SuccessEventPayload>();
    const perCallFailureEvent$ = new Subject<FailureEventPayload>();

    const factoryForExecutor = (): Observable<SpecificPayload> => {
      this._processingKey$.next(key);
      return requestFactoryCallback().pipe(
        map(apiResp => ({
          apiResponse: apiResp,
          successContext,
          failureContext,
          buildSuccessEvent,
          buildFailureEvent,
          key,
        } as SpecificPayload)),
        catchError((error: ErrType) => {
          return of({
            error,
            successContext,
            failureContext,
            buildSuccessEvent,
            buildFailureEvent,
            key,
          } as SpecificPayload);
        }),
        finalize(() => {
          if (this._processingKey$.value === key) {
            this._processingKey$.next(null);
          }
        })
      );
    };

    const resultFromDebouncer$: Observable<BaseExecutorPayload> = this.internalDebouncer.schedule(key, factoryForExecutor as unknown as RequestFactory<BaseExecutorPayload>);

    resultFromDebouncer$.pipe(
        take(1)
      ).subscribe({
      next: (dataFromDebouncer: BaseExecutorPayload) => {
        const payload = dataFromDebouncer as SpecificPayload;

        if (payload.error !== undefined) {
          const failureEvent = payload.buildFailureEvent(payload.error, payload.failureContext, payload.key);
          this._failure$.next(failureEvent as DebouncerFailureEvent<unknown, unknown>);
          perCallFailureEvent$.next(failureEvent);
          perCallResponse$.error(payload.error);
        } else if (payload.apiResponse !== undefined) {
          const successEvent = payload.buildSuccessEvent(payload.apiResponse, payload.successContext, payload.key);
          this._success$.next(successEvent as DebouncerSuccessEvent<unknown, unknown>);
          perCallSuccessEvent$.next(successEvent);
          perCallResponse$.next(payload.apiResponse);
        }
        this.completeFlushNotifier(payload.key);

        perCallResponse$.complete();
        perCallSuccessEvent$.complete();
        perCallFailureEvent$.complete();
      },
      error: (err: unknown) => {
        let errorToReport: ErrType;
        if (err instanceof Error) {
          errorToReport = err as ErrType;
        } else if (typeof err === 'string' && (typeof Error() as ErrType) === 'string') {
           errorToReport = err as ErrType;
        }else {
           errorToReport = new Error(`Debouncer stream error: ${JSON.stringify(err)}`) as ErrType;
        }

        const failureEvent = buildFailureEvent(errorToReport, failureContext, key);
        this._failure$.next(failureEvent as unknown as DebouncerFailureEvent<unknown, unknown>);
        perCallFailureEvent$.next(failureEvent);
        perCallResponse$.error(err);

        perCallResponse$.complete();
        perCallSuccessEvent$.complete();
        perCallFailureEvent$.complete();
        this.completeFlushNotifier(key);
      },
    });

    return {
      response$: perCallResponse$.asObservable(),
      successEvent$: perCallSuccessEvent$.asObservable(),
      failureEvent$: perCallFailureEvent$.asObservable(),
    };
  }

  /**
   * Immediately executes any pending debounced operation for the currently active key.
   * If no operation is pending for the active key, this is a no-op.
   * @returns An Observable that completes when the flushed operation (if any) is processed, or immediately if nothing to flush.
   */
  public flushCurrentActiveDebounce(): Observable<void> {
    const currentKey = this.internalDebouncer.getCurrentKey();
    if (currentKey) {
      return this.flush(currentKey);
    }
    return of(undefined);
  }

  /**
   * Immediately executes any pending debounced operation for the specified key.
   * If no operation is pending for the key, this is a no-op.
   * @param key The key of the operation to flush.
   * @returns An Observable that completes when the flushed operation (if any) is processed, or immediately if nothing to flush for the key.
   */
  public flush(key: string): Observable<void> {
    if (!this.flushCompletionNotifiers.has(key)) {
      this.flushCompletionNotifiers.set(key, new Subject<void>());
    }
    const completionNotifier$ = this.flushCompletionNotifiers.get(key)!.asObservable().pipe(take(1));

    const wasForced = this.internalDebouncer.forceExecute(key);

    if (!wasForced && this._processingKey$.value !== key) {
        if (this.flushCompletionNotifiers.has(key)) {
            this.completeFlushNotifier(key);
        }
    }
    return completionNotifier$;
  }

  /**
   * Gets the key of the operation currently being debounced (i.e., waiting for its debounce timer to elapse).
   * @returns The key string, or null if no operation is currently in the debounce phase.
   */
  public getCurrentlyDebouncingKey(): string | null {
    return this.internalDebouncer.getCurrentKey();
  }

  /**
   * Cleans up resources when the service is destroyed.
   * This completes all internal subjects and destroys the internal debouncer instance.
   */
  public ngOnDestroy(): void {
    this.internalDebouncer.destroy();
    this._success$.complete();
    this._failure$.complete();
    this._processingKey$.complete();
    this.flushCompletionNotifiers.forEach(notifier => notifier.complete());
    this.flushCompletionNotifiers.clear();
  }

  /**
   * @internal
   * Completes and removes the flush completion notifier for a given key.
   * This is called when a flushed operation (or an operation that implicitly causes a flush)
   * has finished processing (either successfully or with an error), or when a flush is determined
   * to have no corresponding action to wait for.
   *
   * @param key The key for which the flush notifier should be completed.
   */
  private completeFlushNotifier(key: string): void {
    if (this.flushCompletionNotifiers.has(key)) {
      this.flushCompletionNotifiers.get(key)!.next();
      this.flushCompletionNotifiers.get(key)!.complete();
      this.flushCompletionNotifiers.delete(key);
    }
  }
}

/**
 * @internal
 * Interface defining the structure of the payload that is processed by the debouncer.
 * It encapsulates the API response or error, contexts, and functions to build specific event payloads.
 */
interface ExecutorPayloadWrapper<ApiResp, SuccessCtx, FailureCtx, SuccessEventPayload, FailureEventPayload, ErrType = Error> {
  apiResponse?: ApiResp;
  error?: ErrType;
  successContext: SuccessCtx;
  failureContext: FailureCtx;
  buildSuccessEvent: (response: ApiResp, context: SuccessCtx, key: string) => SuccessEventPayload;
  buildFailureEvent: (error: ErrType, context: FailureCtx, key: string) => FailureEventPayload;
  key: string;
}

/**
 * @internal
 * Base payload type handled by KeyedDebouncedExecutor internally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BaseExecutorPayload = ExecutorPayloadWrapper<any, any, any, any, any, any>;

/**
 * @internal
 * Type alias for the factory function used by KeyedDebouncedExecutor
 */
type RequestFactory<T> = () => Observable<T>;

/**
 * @internal
 * KeyedDebouncedExecutor is a utility class responsible for managing debounced execution of observable-based operations,
 * identified by unique keys. It ensures that for a given key, only the most recently scheduled operation
 * is executed after a specified debounce period. If a new operation is scheduled for a different key,
 * any pending operation for the previous key is flushed (executed immediately).
 *
 * Each call to `schedule` returns a new Observable that is tied to that specific scheduled operation.
 * If an operation is superseded by another for the same key before execution, its associated Observable is completed.
 */
class KeyedDebouncedExecutor<T> {
  private currentKey: string | null = null;
  private latestRequests = new Map<string, RequestFactory<T>>();
  private debounceTimers = new Map<string, Subscription>();
  private activeRequestSubjects = new Map<string, Subject<T>>();

  constructor(private debounceMs = 300) {}

  /**
   * Schedules an operation (an Observable factory) to be executed after a debounce period.
   * If another operation for the same key is scheduled before this one executes, this one is cancelled
   * and its returned Observable is completed.
   * If an operation for a *different* key is scheduled, the currently debouncing operation for `currentKey` is executed immediately.
   *
   * @param key A unique string key to identify the operation.
   * @param factory A function that returns an Observable representing the operation to be executed.
   * @returns An Observable that will emit the result of the operation, or an error if it fails.
   *          This observable is unique to this specific schedule call.
   */
  public schedule(key: string, factory: RequestFactory<T>): Observable<T> {
    if (this.currentKey && this.currentKey !== key) {
      this.forceExecute(this.currentKey);
    }
    this.currentKey = key;

    if (this.activeRequestSubjects.has(key)) {
      this.activeRequestSubjects.get(key)!.complete();
      this.activeRequestSubjects.delete(key);
    }

    this.debounceTimers.get(key)?.unsubscribe();
    this.latestRequests.set(key, factory);

    const newResultSubject = new ReplaySubject<T>(1);
    this.activeRequestSubjects.set(key, newResultSubject);

    const sub = timer(this.debounceMs).pipe(take(1)).subscribe(() => {
      this.execute(key, newResultSubject);
    });
    this.debounceTimers.set(key, sub);

    return newResultSubject.asObservable();
  }

  /**
   * Forces the immediate execution of any pending debounced operation for the specified key.
   * If no operation is pending for the key, this is a no-op for actual execution but will complete
   * any active subject associated with the key if no factory is found.
   *
   * @param key The key of the operation to force execute.
   * @returns `true` if an operation was found and its execution was triggered, `false` otherwise.
   */
  public forceExecute(key: string): boolean {
    this.debounceTimers.get(key)?.unsubscribe();
    this.debounceTimers.delete(key);

    const factory = this.latestRequests.get(key);
    const activeSubject = this.activeRequestSubjects.get(key);

    if (factory && activeSubject) {
        this.execute(key, activeSubject);
        return true;
    } else if (activeSubject) {
        activeSubject.complete();
        this.cleanupAfterExecution(key, activeSubject);
    }
    return false;
  }

  /**
   * Gets the key of the operation currently being debounced or recently executed.
   * @returns The current key string, or `null` if no operation is active.
   */
  public getCurrentKey(): string | null {
    return this.currentKey;
  }

  /**
   * Cleans up all resources, stops timers, and completes all active subjects.
   * This should be called when the executor is no longer needed to prevent memory leaks.
   */
  public destroy(): void {
    this.debounceTimers.forEach(sub => sub.unsubscribe());
    this.debounceTimers.clear();
    this.latestRequests.clear();
    this.activeRequestSubjects.forEach(sub => sub.complete());
    this.activeRequestSubjects.clear();
    this.currentKey = null;
  }

  /**
   * @internal
   * Executes the operation associated with the given key and emits its result on the provided subject.
   * @param key The key of the operation to execute.
   * @param resultSubject The subject on which to emit the operation's result or error.
   */
  private execute(key: string, resultSubject: Subject<T>): void {
    const factory = this.latestRequests.get(key);

    if (!factory) {
      resultSubject.complete();
      this.cleanupAfterExecution(key, resultSubject);
      return;
    }

    this.latestRequests.delete(key);
    this.debounceTimers.get(key)?.unsubscribe();
    this.debounceTimers.delete(key);

    factory().pipe(take(1)).subscribe({
      next: (val) => resultSubject.next(val),
      error: (err) => resultSubject.error(err),
      complete: () => {
        resultSubject.complete();
        this.cleanupAfterExecution(key, resultSubject);
      }
    });
  }

  /**
   * @internal
   * Cleans up internal state associated with a key after an attempt to execute its operation
   * (whether successful, failed, or completed without execution).
   *
   * @param key The key for which cleanup is being performed.
   * @param subjectThatExecuted The subject associated with the execution path that just finished.
   */
  private cleanupAfterExecution(key: string, subjectThatExecuted: Subject<T>): void {
    if (this.activeRequestSubjects.get(key) === subjectThatExecuted) {
      this.activeRequestSubjects.delete(key);
    }
    if (!this.latestRequests.has(key) && !this.activeRequestSubjects.has(key) && this.currentKey === key) {
      this.currentKey = null;
    }
  }
}
