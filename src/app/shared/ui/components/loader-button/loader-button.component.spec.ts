import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoaderButtonComponent } from './loader-button.component';

@Component({
  standalone: true,
  imports: [LoaderButtonComponent],
  template: `<txg-loader-button [isLoading]="isLoading" [disabled]="disabled">Click me</txg-loader-button>`,
})
class TestHostComponent {
  isLoading = false;
  disabled = false;
}

describe('LoaderButtonComponent', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let buttonElement: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    buttonElement = fixture.nativeElement.querySelector('button');
    fixture.detectChanges();
  });

  it('should create', () => {
    const loaderButtonDebugElement = fixture.debugElement.query(
      By.directive(LoaderButtonComponent)
    );
    const loaderButtonComponent = loaderButtonDebugElement.componentInstance;
    expect(loaderButtonComponent).toBeTruthy();
  });

  it('should render the button with projected content', () => {
    expect(buttonElement).toBeTruthy();
    expect(buttonElement.textContent).toContain('Click me');
  });

  it('should not show the spinner by default', () => {
    const spinner = fixture.nativeElement.querySelector('mat-progress-spinner');
    expect(spinner).toBeFalsy();
  });

  it('should not be disabled by default', () => {
    expect(buttonElement.disabled).toBe(false);
  });

  describe('when isLoading is true', () => {
    beforeEach(() => {
      hostComponent.isLoading = true;
      fixture.detectChanges();
      buttonElement = fixture.nativeElement.querySelector('button');
    });

    it('should show the spinner', () => {
      const spinner = fixture.nativeElement.querySelector('mat-progress-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should disable the button', () => {
      expect(buttonElement.disabled).toBe(true);
    });
  });

  describe('when disabled is true', () => {
    beforeEach(() => {
      hostComponent.disabled = true;
      fixture.detectChanges();
      buttonElement = fixture.nativeElement.querySelector('button');
    });

    it('should disable the button', () => {
      expect(buttonElement.disabled).toBe(true);
    });
  });

  it('button should be disabled if isLoading is true, even if disabled input is false', () => {
    hostComponent.isLoading = true;
    hostComponent.disabled = false;
    fixture.detectChanges();
    buttonElement = fixture.nativeElement.querySelector('button');
    expect(buttonElement.disabled).toBe(true);
  });
});
