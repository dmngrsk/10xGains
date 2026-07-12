import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { NOTES_MAX_LENGTH, SessionNotesDialogComponent, SessionNotesDialogData, SessionNotesDialogResult } from './session-notes-dialog.component';

describe('SessionNotesDialogComponent', () => {
  let fixture: ComponentFixture<SessionNotesDialogComponent>;
  let component: SessionNotesDialogComponent;
  let backdropClickSubject: Subject<MouseEvent>;
  let dialogRefMock: { close: ReturnType<typeof vi.fn>; backdropClick: () => Subject<MouseEvent> };

  const setup = async (data: SessionNotesDialogData): Promise<void> => {
    backdropClickSubject = new Subject<MouseEvent>();
    dialogRefMock = {
      close: vi.fn(),
      backdropClick: () => backdropClickSubject,
    };

    await TestBed.configureTestingModule({
      imports: [SessionNotesDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionNotesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should prefill both note fields from the dialog data', async () => {
    await setup({ sessionNotes: 'session text', planNotes: 'plan text' });

    expect(component.notesForm.value.sessionNotes).toBe('session text');
    expect(component.notesForm.value.planNotes).toBe('plan text');
  });

  it('should show the plan notes field below the session notes field when planNotes is provided', async () => {
    await setup({ sessionNotes: null, planNotes: null });

    const sessionInput = fixture.nativeElement.querySelector('[data-cy="session-notes-dialog-session-input"]');
    const planInput = fixture.nativeElement.querySelector('[data-cy="session-notes-dialog-plan-input"]');
    expect(sessionInput).toBeTruthy();
    expect(planInput).toBeTruthy();
    // DOCUMENT_POSITION_FOLLOWING: the plan section is rendered under the session section.
    expect(sessionInput.compareDocumentPosition(planInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should hide the plan notes field when planNotes is undefined (history view)', async () => {
    await setup({ sessionNotes: 'from history' });

    const planInput = fixture.nativeElement.querySelector('[data-cy="session-notes-dialog-plan-input"]');
    expect(planInput).toBeFalsy();
  });

  it('should close with the entered notes when Save is pressed', async () => {
    await setup({ sessionNotes: null, planNotes: null });

    component.notesForm.setValue({ sessionNotes: 'new session note', planNotes: 'new plan note' });
    component.onSave();

    expect(dialogRefMock.close).toHaveBeenCalledWith({
      sessionNotes: 'new session note',
      planNotes: 'new plan note',
    } satisfies SessionNotesDialogResult);
  });

  it('should close with the entered notes on backdrop click, same as Save', async () => {
    await setup({ sessionNotes: null, planNotes: null });

    component.notesForm.setValue({ sessionNotes: 'typed then clicked away', planNotes: '' });
    backdropClickSubject.next(new MouseEvent('click'));

    expect(dialogRefMock.close).toHaveBeenCalledWith({
      sessionNotes: 'typed then clicked away',
      planNotes: null,
    } satisfies SessionNotesDialogResult);
  });

  it('should normalize whitespace-only notes to null', async () => {
    await setup({ sessionNotes: 'old', planNotes: 'old plan' });

    component.notesForm.setValue({ sessionNotes: '   ', planNotes: '' });
    component.onSave();

    expect(dialogRefMock.close).toHaveBeenCalledWith({
      sessionNotes: null,
      planNotes: null,
    } satisfies SessionNotesDialogResult);
  });

  it('should omit planNotes from the result when the plan section is hidden', async () => {
    await setup({ sessionNotes: 'history note' });

    component.onSave();

    expect(dialogRefMock.close).toHaveBeenCalledWith({ sessionNotes: 'history note' });
  });

  it('should cap the result at the maximum note length', async () => {
    await setup({ sessionNotes: null, planNotes: null });

    component.notesForm.setValue({ sessionNotes: 'x'.repeat(NOTES_MAX_LENGTH + 100), planNotes: '' });
    component.onSave();

    const result = vi.mocked(dialogRefMock.close).mock.calls[0][0] as SessionNotesDialogResult;
    expect(result.sessionNotes).toHaveLength(NOTES_MAX_LENGTH);
  });

  it('should render textareas with the maxlength guard', async () => {
    await setup({ sessionNotes: null, planNotes: null });

    const sessionInput: HTMLTextAreaElement = fixture.nativeElement.querySelector('[data-cy="session-notes-dialog-session-input"]');
    expect(sessionInput.getAttribute('maxlength')).toBe(String(NOTES_MAX_LENGTH));
  });
});
