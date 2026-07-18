import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { SessionPickerDialogComponent, SessionPickerDialogData } from './session-picker-dialog.component';

const SESSIONS: SessionCardViewModel[] = [
  {
    id: 'session-1',
    title: 'Workout A',
    sessionDate: new Date(2026, 4, 10, 8, 30),
    status: 'COMPLETED',
    notes: null,
    exercises: [{ name: 'Squat', sets: [] }, { name: 'Bench Press', sets: [] }],
  },
  {
    id: 'session-2',
    title: 'Workout B',
    sessionDate: new Date(2026, 4, 10, 18, 0),
    status: 'COMPLETED',
    notes: null,
    exercises: [{ name: 'Deadlift', sets: [] }],
  },
];

describe('SessionPickerDialogComponent', () => {
  let fixture: ComponentFixture<SessionPickerDialogComponent>;
  let close: ReturnType<typeof vi.fn>;

  const createComponent = () => {
    close = vi.fn();

    const data: SessionPickerDialogData = { date: new Date(2026, 4, 10), sessions: SESSIONS };

    TestBed.configureTestingModule({
      imports: [SessionPickerDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });

    fixture = TestBed.createComponent(SessionPickerDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('should render one row per session', () => {
    createComponent();

    const rows = fixture.nativeElement.querySelectorAll('[data-cy="history-session-picker-dialog-session"]');

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Workout A');
    expect(rows[1].textContent).toContain('Workout B');
  });

  it('should show a dot marker and the inlined exercise names on each row', () => {
    createComponent();

    const rows = fixture.nativeElement.querySelectorAll('[data-cy="history-session-picker-dialog-session"]');

    expect(rows[0].querySelector('.txg-session-dot')).not.toBeNull();
    expect(rows[0].textContent).toContain('Squat · Bench Press');
    expect(rows[1].querySelector('.txg-session-dot')).not.toBeNull();
    expect(rows[1].textContent).toContain('Deadlift');
  });

  it('should close with the chosen session id', () => {
    createComponent();

    const rows = fixture.nativeElement.querySelectorAll('[data-cy="history-session-picker-dialog-session"]');
    (rows[1] as HTMLButtonElement).click();

    expect(close).toHaveBeenCalledExactlyOnceWith('session-2');
  });

  it('should close without a result when cancelled', () => {
    const component = createComponent();

    component.onCancelled();

    expect(close).toHaveBeenCalledWith();
  });
});
