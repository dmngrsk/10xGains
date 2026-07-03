import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyedDebouncerService, DebouncerSuccessEvent, DebouncerFailureEvent } from './keyed-debouncer.service';

interface TestApiResponse { id: string; value: string }
interface TestSuccessContext { callId: string }
interface TestFailureContext { callId: string; attempt: number }
type TestSuccessEvent = DebouncerSuccessEvent<TestApiResponse, TestSuccessContext>;
type TestFailureEvent = DebouncerFailureEvent<TestFailureContext, Error>;

const DEFAULT_DEBOUNCE_MS = 500;

describe('KeyedDebouncerService', () => {
  let service: KeyedDebouncerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [KeyedDebouncerService]
    });
    service = TestBed.inject(KeyedDebouncerService);
    service.setDebounceTime(DEFAULT_DEBOUNCE_MS);
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const mockApiCall = (response: TestApiResponse, error?: unknown, apiDelayMs: number = 0): (() => Observable<TestApiResponse>) => {
    return () => {
      let obs = error ? throwError(() => error) : of(response);
      if (apiDelayMs > 0) {
        obs = obs.pipe(delay(apiDelayMs));
      }
      return obs;
    };
  };

  const defaultSuccessContext: TestSuccessContext = { callId: 'test-call' };
  const defaultFailureContext: TestFailureContext = { callId: 'test-call', attempt: 1 };

  const buildSuccess = (resp: TestApiResponse, ctx: TestSuccessContext, key: string): TestSuccessEvent => ({ data: resp, context: ctx, key });
  const buildFailure = (err: Error, ctx: TestFailureContext, key: string): TestFailureEvent => ({ error: err, context: ctx, key });

  describe('enqueue', () => {
    it('should emit success event on successful API call', async () => {
      const key = 'successKey';
      const apiResp: TestApiResponse = { id: key, value: 'successData' };
      const sucCtx: TestSuccessContext = { callId: 's1' };

      let receivedSuccessEvent: TestSuccessEvent | undefined;
      const { successEvent$ } = service.enqueue(key, mockApiCall(apiResp), sucCtx, defaultFailureContext, buildSuccess, buildFailure);
      successEvent$.subscribe((event: TestSuccessEvent) => receivedSuccessEvent = event);

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(receivedSuccessEvent).toBeDefined();
      expect(receivedSuccessEvent?.key).toEqual(key);
      expect(receivedSuccessEvent?.data).toEqual(apiResp);
      expect(receivedSuccessEvent?.context).toEqual(sucCtx);
    });

    it('should emit failure event on failed API call', async () => {
      const key = 'failureKey';
      const error = new Error('API Error');
      const failCtx: TestFailureContext = { callId: 'f1', attempt: 1 };

      let receivedFailureEvent: TestFailureEvent | undefined;
      const { failureEvent$ } = service.enqueue(key, mockApiCall({} as TestApiResponse, error), defaultSuccessContext, failCtx, buildSuccess, buildFailure);
      failureEvent$.subscribe((event: TestFailureEvent) => receivedFailureEvent = event);

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(receivedFailureEvent).toBeDefined();
      expect(receivedFailureEvent?.key).toEqual(key);
      expect(receivedFailureEvent?.error).toEqual(error);
      expect(receivedFailureEvent?.context).toEqual(failCtx);
    });

    it('should emit on global success$ stream', async () => {
      const key = 'globalSuccess';
      const apiResp: TestApiResponse = { id: key, value: 'globalData' };
      const sucCtx: TestSuccessContext = { callId: 'gs1' };
      let globalSuccess: DebouncerSuccessEvent<unknown, unknown> | undefined;

      service.success$.pipe(take(1)).subscribe((event: DebouncerSuccessEvent<unknown, unknown>) => globalSuccess = event);
      service.enqueue(key, mockApiCall(apiResp), sucCtx, defaultFailureContext, buildSuccess, buildFailure);
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(globalSuccess).toBeDefined();
      const typedGlobalSuccess = globalSuccess as TestSuccessEvent;
      expect(typedGlobalSuccess.key).toEqual(key);
      expect(typedGlobalSuccess.data).toEqual(apiResp);
      expect(typedGlobalSuccess.context).toEqual(sucCtx);
    });

    it('should emit on global failure$ stream', async () => {
      const key = 'globalFailure';
      const error = new Error('Global API Error');
      const failCtx: TestFailureContext = { callId: 'gf1', attempt: 1 };
      let globalFailure: DebouncerFailureEvent<unknown, unknown> | undefined;

      service.failure$.pipe(take(1)).subscribe((event: DebouncerFailureEvent<unknown, unknown>) => globalFailure = event);
      service.enqueue(key, mockApiCall({} as TestApiResponse, error), defaultSuccessContext, failCtx, buildSuccess, buildFailure);
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(globalFailure).toBeDefined();
      const typedGlobalFailure = globalFailure as TestFailureEvent;
      expect(typedGlobalFailure.key).toEqual(key);
      expect(typedGlobalFailure.error).toEqual(error);
      expect(typedGlobalFailure.context).toEqual(failCtx);
    });

    it('should emit events after debounce time elapses', async () => {
      const key = 'debounceCheckKey';
      const apiResp: TestApiResponse = { id: key, value: 'debounceData' };
      const factory = mockApiCall(apiResp);

      const spies = {
        responseNext: vi.fn(),
        responseError: vi.fn(),
        successEventNext: vi.fn(),
        failureEventNext: vi.fn(),
      };

      const { response$, successEvent$, failureEvent$ } = service.enqueue(
        key,
        factory,
        defaultSuccessContext,
        defaultFailureContext,
        buildSuccess,
        buildFailure
      );

      response$.subscribe({ next: spies.responseNext, error: spies.responseError });
      successEvent$.subscribe({ next: spies.successEventNext });
      failureEvent$.subscribe({ next: spies.failureEventNext });

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS * 0.99);

      expect(spies.responseNext).not.toHaveBeenCalled();
      expect(spies.responseError).not.toHaveBeenCalled();
      expect(spies.successEventNext).not.toHaveBeenCalled();
      expect(spies.failureEventNext).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS * 0.01 + 1);

      expect(spies.responseNext).toHaveBeenCalledWith(apiResp);
      expect(spies.successEventNext).toHaveBeenCalled();
    });

    it('should debounce calls with the same key', async () => {
      const key = 'testKey1';
      const response1: TestApiResponse = { id: key, value: 'first' };
      const response2: TestApiResponse = { id: key, value: 'second' };
      const factory1 = mockApiCall(response1);
      const factory2 = mockApiCall(response2);

      let result1Response: TestApiResponse | undefined;
      let result2Response: TestApiResponse | undefined;

      service.enqueue(key, factory1, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => result1Response = r);
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS / 2);
      service.enqueue(key, factory2, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => result2Response = r);

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);

      expect(result1Response).toBeUndefined();
      expect(result2Response).toEqual(response2);
    });

    it('should execute previous key immediately if a new key is enqueued', async () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const response1: TestApiResponse = { id: key1, value: 'data1' };
      const response2: TestApiResponse = { id: key2, value: 'data2' };
      const factory1 = mockApiCall(response1);
      const factory2 = mockApiCall(response2);

      let key1Response: TestApiResponse | undefined;
      let key2Response: TestApiResponse | undefined;

      service.enqueue(key1, factory1, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => key1Response = r);
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS / 2);

      service.enqueue(key2, factory2, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => key2Response = r);
      await vi.advanceTimersByTimeAsync(0);
      expect(key1Response).toEqual(response1);

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS);
      expect(key2Response).toEqual(response2);
    });

    it('processingKey$ should emit key during processing and null after', async () => {
      const key = 'processingTest';
      const apiResp: TestApiResponse = { id: key, value: 'procData' };
      const apiDelay = 50;
      const factory = mockApiCall(apiResp, undefined, apiDelay);
      const processingKeyValues: (string | null)[] = [];

      service.processingKey$.subscribe((k: string | null) => processingKeyValues.push(k));

      service.enqueue(key, factory, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure);
      expect(processingKeyValues[processingKeyValues.length -1]).toBeNull();

      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS -1);
      expect(processingKeyValues[processingKeyValues.length -1]).toBeNull();

      vi.advanceTimersByTime(1);
      expect(processingKeyValues.find(k => k === key)).not.toBeUndefined();
      expect(processingKeyValues[processingKeyValues.length -1]).toBe(key);

      vi.advanceTimersByTime(apiDelay + 10);
      expect(processingKeyValues[processingKeyValues.length -1]).toBeNull();

      const sub = service.processingKey$.subscribe();
      sub.unsubscribe();
    });
  });

  describe('flush', () => {
    it('flush(key) should execute a pending operation for that key immediately', async () => {
      const key = 'flushKey';
      const response: TestApiResponse = { id: key, value: 'flushedData' };
      const factory = mockApiCall(response);
      let receivedResponse: TestApiResponse | undefined;

      service.enqueue(key, factory, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => receivedResponse = r);
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS / 2);
      expect(receivedResponse).toBeUndefined();

      let flushCompleted = false;
      service.flush(key).subscribe({ complete: () => flushCompleted = true });
      await vi.advanceTimersByTimeAsync(0);
      expect(receivedResponse).toEqual(response);
      expect(flushCompleted).toBe(true);
    });

    it('flush(key) should do nothing if no operation for the key', async () => {
      let flushCompleted = false;
      service.flush('nonExistentKey').subscribe({ complete: () => flushCompleted = true });
      await vi.advanceTimersByTimeAsync(0);
      expect(flushCompleted).toBe(true);
    });

    it('flushCurrentActiveDebounce should execute the currently debouncing key', async () => {
      const key = 'currentFlush';
      const response: TestApiResponse = { id: key, value: 'currentFlushData' };
      const factory = mockApiCall(response);
      let receivedResponse: TestApiResponse | undefined;

      service.enqueue(key, factory, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => receivedResponse = r);
      vi.advanceTimersByTime(DEFAULT_DEBOUNCE_MS / 2);
      expect(receivedResponse).toBeUndefined();

      let flushCompleted = false;
      service.flushCurrentActiveDebounce().subscribe({ complete: () => flushCompleted = true });
      await vi.advanceTimersByTimeAsync(0);
      expect(receivedResponse).toEqual(response);
      expect(flushCompleted).toBe(true);
    });

    it('flushCurrentActiveDebounce should do nothing if no key is active', async () => {
      let flushCompleted = false;
      service.flushCurrentActiveDebounce().subscribe({ complete: () => flushCompleted = true });
      await vi.advanceTimersByTimeAsync(0);
      expect(flushCompleted).toBe(true);
    });
  });

  describe('setDebounceTime', () => {
    it('should update debounce time and affect new enqueue calls', async () => {
      const key = 'debounceTimeTest';
      const newDebounceTime = 100;
      const response: TestApiResponse = { id: key, value: 'shortDebounce' };
      const factory = mockApiCall(response);
      let receivedResponse: TestApiResponse | undefined;

      service.setDebounceTime(newDebounceTime);
      service.enqueue(key, factory, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure).response$.subscribe((r: TestApiResponse) => receivedResponse = r);

      vi.advanceTimersByTime(newDebounceTime / 2);
      expect(receivedResponse).toBeUndefined();

      vi.advanceTimersByTime(newDebounceTime / 2 + 1);
      expect(receivedResponse).toEqual(response);
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete all internal subjects', () => {
      const key = 'destroyTest';
      const factory = mockApiCall({ id: key, value: 'destroyData' });
      const enqueueResult = service.enqueue(key, factory, defaultSuccessContext, defaultFailureContext, buildSuccess, buildFailure);

      const spies = {
        response: vi.fn(),
        successEvent: vi.fn(),
        failureEvent: vi.fn(),
        globalSuccess: vi.fn(),
        globalFailure: vi.fn(),
        processingKey: vi.fn()
      };

      enqueueResult.response$.subscribe({ complete: spies.response });
      enqueueResult.successEvent$.subscribe({ complete: spies.successEvent });
      enqueueResult.failureEvent$.subscribe({ complete: spies.failureEvent });
      service.success$.subscribe({ complete: spies.globalSuccess });
      service.failure$.subscribe({ complete: spies.globalFailure });
      service.processingKey$.subscribe({ complete: spies.processingKey });

      vi.runAllTimers();
      service.ngOnDestroy();

      expect(spies.globalSuccess).toHaveBeenCalled();
      expect(spies.globalFailure).toHaveBeenCalled();
      expect(spies.processingKey).toHaveBeenCalled();
      expect(spies.response).toHaveBeenCalled();
      expect(spies.successEvent).toHaveBeenCalled();
    });
  });
});
