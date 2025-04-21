import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { LoginFormComponent } from './login-form.component';

// Mock components to avoid needing actual animations
@Component({
  selector: 'txg-email-input',
  template: '<div>Email Input Mock</div>'
})
class MockEmailInputComponent {
  @Input() parentForm!: FormGroup;
}

@Component({
  selector: 'txg-password-input',
  template: '<div>Password Input Mock</div>'
})
class MockPasswordInputComponent {
  @Input() parentForm!: FormGroup;
}

describe('LoginFormComponent', () => {
  let component: LoginFormComponent;
  let fixture: ComponentFixture<LoginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        LoginFormComponent,
        MockEmailInputComponent,
        MockPasswordInputComponent
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });

  it('should initialize with an empty form', () => {
    expect(component.loginForm.get('email')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  it('should have form controls marked as invalid when empty', () => {
    const emailControl = component.loginForm.get('email');
    const passwordControl = component.loginForm.get('password');

    expect(emailControl?.valid).toBeFalsy();
    expect(passwordControl?.valid).toBeFalsy();
  });

  it('should validate email format', () => {
    const emailControl = component.loginForm.get('email');

    emailControl?.setValue('not-an-email');
    expect(emailControl?.valid).toBeFalsy();

    emailControl?.setValue('test@example.com');
    expect(emailControl?.valid).toBeTruthy();
  });

  it('should emit form values when valid form is submitted', () => {
    const formSubmitSpy = vi.spyOn(component.formSubmit, 'emit');
    const testValues = {
      email: 'test@example.com',
      password: 'password123'
    };

    component.loginForm.setValue(testValues);

    component.onSubmit();

    expect(formSubmitSpy).toHaveBeenCalledWith(testValues);
  });

  it('should not emit form values when invalid form is submitted', () => {
    const formSubmitSpy = vi.spyOn(component.formSubmit, 'emit');

    // Form is invalid by default (empty)
    component.onSubmit();

    expect(formSubmitSpy).not.toHaveBeenCalled();
  });

  it('should mark all fields as touched when invalid form is submitted', () => {
    const markAllAsTouchedSpy = vi.spyOn(component.loginForm, 'markAllAsTouched');

    // Form is invalid by default (empty)
    component.onSubmit();

    expect(markAllAsTouchedSpy).toHaveBeenCalled();
  });

  it('should set loading state correctly', () => {
    expect(component.isLoading()).toBe(false);

    component.setLoading(true);
    expect(component.isLoading()).toBe(true);

    component.setLoading(false);
    expect(component.isLoading()).toBe(false);
  });
});
