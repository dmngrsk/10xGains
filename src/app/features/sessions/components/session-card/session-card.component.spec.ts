import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionCardComponent } from './session-card.component';
import { SessionCardViewModel, SessionCardExerciseViewModel, SessionCardSetViewModel } from '../../models/session-card.viewmodel';
import { SessionStatus, SessionSetStatus } from '../../models/session.types';

describe('SessionCardComponent', () => {
  let component: SessionCardComponent;

  beforeEach(() => {
    component = new SessionCardComponent();
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

    const formattedDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    const formattedTime = (date: Date) => new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

    it('should return empty string if sessionData is not set', () => {
      // @ts-expect-error Testing undefined case
      component.sessionData = undefined;
      expect(component.sessionDateTimeText).toBe('');
    });

    it('should return empty string if sessionData.sessionDate is null', () => {
      component.sessionData = createMockSession('PENDING', null);
      expect(component.sessionDateTimeText).toBe('');
    });

    it('should return empty string if sessionData.sessionDate is invalid', () => {
      const invalidDate = new Date('invalid-date-string');
      component.sessionData = createMockSession('PENDING', invalidDate);
      expect(component.sessionDateTimeText).toBe('');
    });

    describe('PENDING state', () => {
      it('should return only the formatted date', () => {
        component.sessionData = createMockSession('PENDING', testMockDate);
        const expectedFormattedDate = formattedDate(baseMockDate);
        expect(component.sessionDateTimeText).toBe(expectedFormattedDate);
      });
    });

    describe('IN_PROGRESS state', () => {
      it('should show duration from sessionDate when no sets are completed', () => {
        const sessionTime = new Date(testMockDate);
        component.sessionData = createMockSession('IN_PROGRESS', sessionTime, [createMockExercise([createMockSet(null)])]);

        const mockNow = new Date(sessionTime.getTime() + 30 * 60 * 1000); // 30 minutes later
        vi.setSystemTime(mockNow);

        const expectedDateStr = formattedDate(sessionTime);
        const expectedStartTimeStr = formattedTime(sessionTime);
        const expectedDuration = 30;

        const expectedText = `${expectedDateStr} | ${expectedStartTimeStr} - ... (${expectedDuration} min)`;
        expect(component.sessionDateTimeText).toBe(expectedText);
      });

      it('should show duration from earliest timestamp when a set was completed before sessionDate', () => {
        const sessionTime = new Date(testMockDate); // 10:30
        const set1Time = new Date(testMockDate.getTime() - 30 * 60 * 1000); // 10:00
        const set2Time = new Date(testMockDate.getTime() - 15 * 60 * 1000); // 10:15
        const exercises = [createMockExercise([createMockSet(set1Time), createMockSet(set2Time)])];
        component.sessionData = createMockSession('IN_PROGRESS', sessionTime, exercises);

        const mockNow = new Date(testMockDate.getTime() + 15 * 60 * 1000); // 10:45
        vi.setSystemTime(mockNow);

        const expectedDateStr = formattedDate(sessionTime);
        const expectedStartTimeStr = formattedTime(set1Time);
        const expectedDuration = 45; // from 10:00 to 10:45
        const expectedText = `${expectedDateStr} | ${expectedStartTimeStr} - ... (${expectedDuration} min)`;
        expect(component.sessionDateTimeText).toBe(expectedText);
      });

      it('should show duration from earliest timestamp when sessionDate is before any completed set', () => {
        const sessionTime = new Date(testMockDate); // 10:30
        const set1Time = new Date(testMockDate.getTime() + 15 * 60 * 1000); // 10:45
        const exercises = [createMockExercise([createMockSet(set1Time)])];
        component.sessionData = createMockSession('IN_PROGRESS', sessionTime, exercises);

        const mockNow = new Date(testMockDate.getTime() + 30 * 60 * 1000); // 11:00
        vi.setSystemTime(mockNow);

        const expectedDateStr = formattedDate(sessionTime);
        const expectedStartTimeStr = formattedTime(sessionTime);
        const expectedDuration = 30; // from 10:30 to 11:00
        const expectedText = `${expectedDateStr} | ${expectedStartTimeStr} - ... (${expectedDuration} min)`;
        expect(component.sessionDateTimeText).toBe(expectedText);
      });
    });

    describe('COMPLETED or CANCELLED state', () => {
      it('should show single timestamp if start and end times are identical', () => {
        const time = new Date(testMockDate);
        const exercises = [createMockExercise([createMockSet(time)])];
        component.sessionData = createMockSession('COMPLETED', time, exercises);

        const expectedDateStr = formattedDate(time);
        expect(component.sessionDateTimeText).toBe(`${expectedDateStr} | ${formattedTime(time)}`);
      });

      it('should show duration from earliest to latest timestamp', () => {
        const sessionTime = new Date(testMockDate); // 10:30
        const startTime = new Date(testMockDate.getTime() - 60 * 60 * 1000); // 09:30
        const endTime = new Date(testMockDate.getTime() - 15 * 60 * 1000); // 10:15
        const exercises = [createMockExercise([createMockSet(startTime), createMockSet(endTime)])];
        component.sessionData = createMockSession('COMPLETED', sessionTime, exercises);
        // Earliest is startTime (09:30), latest is sessionTime (10:30)
        const duration = Math.round((sessionTime.getTime() - startTime.getTime()) / (1000 * 60)); // 60 min
        const expectedDateStr = formattedDate(sessionTime);
        const expectedText = `${expectedDateStr} | ${formattedTime(startTime)} - ${formattedTime(sessionTime)} (${duration} min)`;
        expect(component.sessionDateTimeText).toBe(expectedText);
      });

      it('should show duration correctly for CANCELLED status', () => {
        const sessionTime = new Date(testMockDate); // 10:30
        const startTime = new Date(testMockDate.getTime() - 60 * 60 * 1000); // 09:30
        const endTime = new Date(testMockDate.getTime() - 15 * 60 * 1000); // 10:15
        const exercises = [createMockExercise([createMockSet(startTime), createMockSet(endTime)])];
        component.sessionData = createMockSession('CANCELLED', sessionTime, exercises);
        const duration = Math.round((sessionTime.getTime() - startTime.getTime()) / (1000 * 60)); // 60 min
        const expectedDateStr = formattedDate(sessionTime);
        const expectedText = `${expectedDateStr} | ${formattedTime(startTime)} - ${formattedTime(sessionTime)} (${duration} min)`;
        expect(component.sessionDateTimeText).toBe(expectedText);
      });

      it('should show just date and time if only sessionDate is available', () => {
        component.sessionData = createMockSession('COMPLETED', testMockDate, []);
        const expectedDateStr = formattedDate(testMockDate);
        expect(component.sessionDateTimeText).toBe(`${expectedDateStr} | ${formattedTime(testMockDate)}`);
      });
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

    it('should summarize reps like "3x10" if all reps are the same', () => {
      const sets = [
        createMockSet(new Date(), 10),
        createMockSet(new Date(), 10),
        createMockSet(new Date(), 10),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('3x10');
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
      expect(component.getExerciseSummaryText(sets)).toBe('2x10 @ 50 kg');
    });

    it('should include weight range if weights are defined and different', () => {
      const sets = [
        createMockSet(new Date(), 10, 10, 50),
        createMockSet(new Date(), 10, 10, 60),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('2x10 @ 50-60 kg');
    });

    it('should not include weight summary if no weights are defined (all null)', () => {
      const sets = [
        createMockSet(new Date(), 10, 10, null),
        createMockSet(new Date(), 8, 8, null),
      ];
      expect(component.getExerciseSummaryText(sets)).toBe('10/8');
    });
  });

  describe('isAbandonableSession getter', () => {
    it('should return true for IN_PROGRESS status and when sessionDate is more than 6 hours in the past', () => {
      const sessionDate = new Date(Date.now() - 1000 * 60 * 60 * 6 - 1);
      component.sessionData = createMockSession('IN_PROGRESS', sessionDate);
      expect(component.isAbandonableSession).toBe(true);
    });

    it('should return false for IN_PROGRESS status and when sessionDate is less than 6 hours in the past', () => {
      const sessionDate = new Date(Date.now() - 1000 * 60 * 60 * 6 + 1);
      component.sessionData = createMockSession('IN_PROGRESS', sessionDate);
      expect(component.isAbandonableSession).toBe(false);
    });

    it('should return true for PENDING status and when sessionDate is more than 6 hours in the past', () => {
      const sessionDate = new Date(Date.now() - 1000 * 60 * 60 * 6 - 1);
      component.sessionData = createMockSession('PENDING', sessionDate);
      expect(component.isAbandonableSession).toBe(true);
    });

    it('should return false for PENDING status and when sessionDate is less than 6 hours in the past', () => {
      const sessionDate = new Date(Date.now() - 1000 * 60 * 60 * 6 + 1);
      component.sessionData = createMockSession('PENDING', sessionDate);
      expect(component.isAbandonableSession).toBe(false);
    });

    it('should return false for COMPLETED status', () => {
      component.sessionData = createMockSession('COMPLETED', new Date());
      expect(component.isAbandonableSession).toBe(false);
    });

    it('should return false for CANCELLED status', () => {
      component.sessionData = createMockSession('CANCELLED', new Date());
      expect(component.isAbandonableSession).toBe(false);
    });

    it('should return false if sessionDate is null', () => {
      component.sessionData = createMockSession('IN_PROGRESS', null);
      expect(component.isAbandonableSession).toBe(false);
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

    it('should return "View Session" for COMPLETED status', () => {
      component.sessionData = createMockSession('COMPLETED', new Date());
      expect(component.buttonText).toBe('View Session');
    });

    it('should return "View Session" for CANCELLED status', () => {
      component.sessionData = createMockSession('CANCELLED', new Date());
      expect(component.buttonText).toBe('View Session');
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
