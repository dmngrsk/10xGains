import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptCardComponent } from './prompt-card.component';

@Component({
  standalone: true,
  imports: [PromptCardComponent],
  template: `<txg-prompt-card
    [titleText]="titleText()"
    [buttonText]="buttonText()"
    buttonDataCy="prompt-action"
    (buttonClicked)="onClicked()">
    <p>It has been <strong>8 days</strong> since your last measurements.</p>
  </txg-prompt-card>`,
})
class TestHostComponent {
  titleText = signal('Time to measure');
  buttonText = signal<string | undefined>('Log measurements');
  onClicked = vi.fn();
}

describe('PromptCardComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the title, the projected body and the action', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Time to measure');
    expect(text).toContain('It has been 8 days since your last measurements.');
    expect(fixture.nativeElement.querySelector('[data-cy="prompt-action"]')).toBeTruthy();
  });

  // Projected rather than a string input, so a host can emphasise a figure mid-sentence.
  it('should keep the markup a host projects into the body', () => {
    expect(fixture.nativeElement.querySelector('mat-card-content strong')?.textContent).toBe('8 days');
  });

  it('should emit when the action is pressed', () => {
    fixture.nativeElement.querySelector('button').click();

    expect(hostComponent.onClicked).toHaveBeenCalledOnce();
  });

  // A prompt with nothing to do is a statement, and a bare card reads better than a dead button.
  it('should omit the action when no button text is given', () => {
    hostComponent.buttonText.set(undefined);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
