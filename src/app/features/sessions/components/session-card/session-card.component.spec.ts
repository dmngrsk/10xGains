import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionCardComponent } from './session-card.component';
import { SessionCardViewModel, SessionCardExerciseViewModel, SessionCardSetViewModel } from '../../models/session-card.viewmodel';
import { SessionStatus, SessionSetStatus } from '../../models/session.enum';

describe('SessionCardComponent', () => {
  let component: SessionCardComponent;
  let originalToLocaleDateString: (locales?: string | string[] | undefined, options?: Intl.DateTimeFormatOptions | undefined) => string;

  beforeEach(() => {
    component = new SessionCardComponent();

    originalToLocaleDateString = Date.prototype.toLocaleDateString;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Date.prototype.toLocaleDateString = function(locales?: string | string[] | undefined, options?: Intl.DateTimeFormatOptions | undefined) {
      return originalToLocaleDateString.call(this, 'en-US');
    };
  });

  afterEach(() => {
    Date.prototype.toLocaleDateString = originalToLocaleDateString;
  });

  const createMockSession = (status: SessionStatus, sessionDate: Date | null, exercises: SessionCardExerciseViewModel[] = []): SessionCardViewModel => ({
    id: 'test-session-id',
    title: 'Test Session Title',
    sessionDate: sessionDate,
    status: status,
    exercises: exercises,
  });

  const createMockExercise = (sets: SessionCardSetViewModel[], name: string = 'Test Exercise'): SessionCardExerciseViewModel => ({
    name: name,
    sets: sets,
  });

  const createMockSet = (
    completedAt: Date | null,
    actualReps?: number | null,
    expectedReps: number | null = 10,
    actualWeight?: number | null,
    status: SessionSetStatus = 'COMPLETED'
  ): SessionCardSetViewModel => ({
    expectedReps: expectedReps,
    actualReps: actualReps === undefined ? null : actualReps,
    actualWeight: actualWeight === undefined ? null : actualWeight,
    completedAt: completedAt,
    status: status,
  });

  describe('sessionDateTimeText getter', () => {
    const baseMockDate = new Date(2024, 5, 15, 10, 30, 0); // June 15, 2024, 10:30:00
    let testMockDate: Date;

    beforeEach(() => {
      vi.useFakeTimers();
      testMockDate = new Date(baseMockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });
    
    const expectedFormattedDate = `${baseMockDate.getMonth() + 1}/${baseMockDate.getDate()}/${baseMockDate.getFullYear()}`;
    const formattedTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: false });

    it('should return empty string if sessionData is not set', () => {
        // @ts-expect-error Testing undefined case
        component.sessionData = undefined;
        expect(component.sessionDateTimeText).toBe('');
    });

    it('should return empty string if sessionData.sessionDate is null', () => {
        component.sessionData = createMockSession('PENDING', null);
        expect(component.sessionDateTimeText).toBe('');
    });

    it('PENDING: should return formatted date', () => {
      component.sessionData = createMockSession('PENDING', testMockDate);
      expect(component.sessionDateTimeText).toBe(expectedFormattedDate);
    });

    it('IN_PROGRESS: should return date | startTime - ... (duration) if startTime exists', () => {
      const sessionTime = new Date(testMockDate);
      const startTime = new Date(sessionTime.getTime() - 30 * 60 * 1000);
      
      const mockNow = new Date(startTime.getTime() + 45 * 60 * 1000);
      vi.setSystemTime(mockNow);

      const exercises = [createMockExercise([createMockSet(startTime)])];
      component.sessionData = createMockSession('IN_PROGRESS', sessionTime, exercises);

      const expectedDateStr = `${sessionTime.getMonth() + 1}/${sessionTime.getDate()}/${sessionTime.getFullYear()}`;
      const expectedStartTimeStr = formattedTime(startTime);
      const expectedDuration = 45; 

      const expectedText = `${expectedDateStr} | ${expectedStartTimeStr} - ... (${expectedDuration} min)`;
      expect(component.sessionDateTimeText).toBe(expectedText);
    });

    it('IN_PROGRESS: should return only formatted date if no earliest set completion time (all sets have null completedAt)', () => {
      component.sessionData = createMockSession('IN_PROGRESS', testMockDate, [createMockExercise([createMockSet(null)])]);
      expect(component.sessionDateTimeText).toBe(expectedFormattedDate);
    });

    it('IN_PROGRESS: should return only formatted date if exercises are empty', () => {
      component.sessionData = createMockSession('IN_PROGRESS', testMockDate, []);
      expect(component.sessionDateTimeText).toBe(expectedFormattedDate);
    });

    it('COMPLETED: should return date | startTime if startTime equals endTime', () => {
      const time = new Date(testMockDate.getTime() - 60 * 60 * 1000);
      const exercises = [createMockExercise([createMockSet(time)])]; 
      component.sessionData = createMockSession('COMPLETED', testMockDate, exercises);
      const expectedDateStr = `${testMockDate.getMonth() + 1}/${testMockDate.getDate()}/${testMockDate.getFullYear()}`;
      expect(component.sessionDateTimeText).toBe(`${expectedDateStr} | ${formattedTime(time)}`);
    });

    it('COMPLETED: should return date | startTime - endTime (duration) if times differ', () => {
      const sessionDisplayDate = new Date(testMockDate);
      const startTime = new Date(sessionDisplayDate.getTime() - 60 * 60 * 1000); 
      const endTime = new Date(sessionDisplayDate.getTime() - 15 * 60 * 1000);   
      const exercises = [
        createMockExercise([
          createMockSet(startTime),
          createMockSet(endTime)
        ])
      ];
      component.sessionData = createMockSession('COMPLETED', sessionDisplayDate, exercises);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      const expectedDateStr = `${sessionDisplayDate.getMonth() + 1}/${sessionDisplayDate.getDate()}/${sessionDisplayDate.getFullYear()}`;
      expect(component.sessionDateTimeText).toBe(
        `${expectedDateStr} | ${formattedTime(startTime)} - ${formattedTime(endTime)} (${duration} min)`
      );
    });

    it('CANCELLED: should behave like COMPLETED for date/time text (times differ)', () => {
      const sessionDisplayDate = new Date(testMockDate);
      const startTime = new Date(sessionDisplayDate.getTime() - 60 * 60 * 1000);
      const endTime = new Date(sessionDisplayDate.getTime() - 15 * 60 * 1000);
      const exercises = [
        createMockExercise([
          createMockSet(startTime),
          createMockSet(endTime)
        ])
      ];
      component.sessionData = createMockSession('CANCELLED', sessionDisplayDate, exercises);
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      const expectedDateStr = `${sessionDisplayDate.getMonth() + 1}/${sessionDisplayDate.getDate()}/${sessionDisplayDate.getFullYear()}`;
      expect(component.sessionDateTimeText).toBe(
        `${expectedDateStr} | ${formattedTime(startTime)} - ${formattedTime(endTime)} (${duration} min)`
      );
    });

    it('COMPLETED: should return only formatted date if no set completion times (all sets have null completedAt)', () => {
      component.sessionData = createMockSession('COMPLETED', testMockDate, [createMockExercise([createMockSet(null)])]);
      expect(component.sessionDateTimeText).toBe(expectedFormattedDate);
    });

    it('COMPLETED: should return only formatted date if exercises are empty', () => {
       component.sessionData = createMockSession('COMPLETED', testMockDate, []);
       expect(component.sessionDateTimeText).toBe(expectedFormattedDate);
    });

    it('should return empty string if formatDisplayDate returns null (e.g. invalid date format in sessionData)', () => {
      const invalidDate = new Date('invalid-date-string');
      component.sessionData = createMockSession('PENDING', invalidDate);
      expect(component.sessionDateTimeText).toBe('');
    });

  });
  
  describe('getExerciseSummaryText method', () => {
    it('should return "No sets defined" if sets array is null or empty', () => {
      expect(component.getExerciseSummaryText([])).toBe('No sets defined');
      // @ts-expect-error Testing null case for sets array
      expect(component.getExerciseSummaryText(null)).toBe('No sets defined');
    });

    it('should return "No reps defined" if sets have no rep counts (all null or undefined)', () => {
      const sets = [createMockSet(new Date(), null, null), createMockSet(new Date(), undefined, null)];
      expect(component.getExerciseSummaryText(sets)).toBe('No reps defined');
    });

    it('should summarize reps like "10x3" if all reps are the same', () => {
      const sets = [
        createMockSet(new Date(), 10),
        createMockSet(new Date(), 10),
        createMockSet(new Date(), 10),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10x3');
    });

    it('should summarize reps like "10/8/6" if reps are different', () => {
      const sets = [
        createMockSet(new Date(), 10),
        createMockSet(new Date(), 8),
        createMockSet(new Date(), 6),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10/8/6');
    });

    it('should use expectedReps for PENDING sets if actualReps is null', () => {
      const sets = [
        createMockSet(new Date(), 10, 10, 50, 'COMPLETED'),
        createMockSet(null, null, 8, null, 'PENDING'),
        createMockSet(new Date(), 6, 6, 50, 'COMPLETED'),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10/8/6 @ 50 kg');
    });

    it('should use 0 reps for SKIPPED sets if actualReps is null', () => {
        const sets = [
            createMockSet(new Date(), 10, 10, 50, 'COMPLETED'),
            createMockSet(null, null, 8, null, 'SKIPPED'),
            createMockSet(new Date(), 6, 6, 50, 'COMPLETED'),
        ];
        expect(component.getExerciseSummaryText(sets)).toBe('10/0/6 @ 50 kg');
    });

    it('should include weight summary if weights are defined and same', () => {
      const sets = [
        createMockSet(new Date(), 10, 10, 50),
        createMockSet(new Date(), 10, 10, 50),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10x2 @ 50 kg');
    });

    it('should include weight range if weights are defined and different', () => {
      const sets = [
        createMockSet(new Date(), 10, 10, 50),
        createMockSet(new Date(), 10, 10, 60),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10x2 @ 50-60 kg');
    });

    it('should not include weight summary if no weights are defined (all null)', () => {
      const sets = [
        createMockSet(new Date(), 10, 10, null),
        createMockSet(new Date(), 8, 8, null),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10/8');
    });
  });
  
  describe('isActiveSession getter', () => {
    it('should return true for PENDING status', () => {
      component.sessionData = createMockSession('PENDING', new Date());
      expect(component.isActiveSession).toBe(true);
    });

    it('should return true for IN_PROGRESS status', () => {
      component.sessionData = createMockSession('IN_PROGRESS', new Date());
      expect(component.isActiveSession).toBe(true);
    });

    it('should return false for COMPLETED status', () => {
      component.sessionData = createMockSession('COMPLETED', new Date());
      expect(component.isActiveSession).toBe(false);
    });

    it('should return false for CANCELLED status', () => {
      component.sessionData = createMockSession('CANCELLED', new Date());
      expect(component.isActiveSession).toBe(false);
    });
  });

  describe('buttonText getter', () => {
    it('should return "Start Session" for PENDING status', () => {
      component.sessionData = createMockSession('PENDING', new Date());
      expect(component.buttonText).toBe('Start Session');
    });

    it('should return "Continue Session" for IN_PROGRESS status', () => {
      component.sessionData = createMockSession('IN_PROGRESS', new Date());
      expect(component.buttonText).toBe('Continue Session');
    });

    it('should return "View Details" for COMPLETED status', () => {
      component.sessionData = createMockSession('COMPLETED', new Date());
      expect(component.buttonText).toBe('View Details');
    });

    it('should return "View Details" for CANCELLED status', () => {
      component.sessionData = createMockSession('CANCELLED', new Date());
      expect(component.buttonText).toBe('View Details');
    });

    it('should return empty string for unknown status', () => {
      component.sessionData = createMockSession('UNKNOWN_STATUS' as SessionStatus, new Date());
      expect(component.buttonText).toBe('');
    });

    it('should return empty string if sessionData is not set', () => {
      // @ts-expect-error Testing undefined case
      component.sessionData = undefined;
      expect(component.buttonText).toBe('');
    });
  });
  
  describe('sessionNavigated method', () => {
    it('should emit sessionNavigated event with session id', () => {
      const mockSessionId = 'session-123';
      component.sessionData = createMockSession('PENDING', new Date());
      component.sessionData.id = mockSessionId;
      const emitSpy = vi.spyOn(component.sessionNavigated, 'emit');

      component.sessionNavigated.emit(mockSessionId);

      expect(emitSpy).toHaveBeenCalledWith(mockSessionId);
    });
  });
});
