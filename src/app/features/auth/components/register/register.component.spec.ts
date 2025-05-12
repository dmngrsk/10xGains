import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { ActionsComponent } from './actions/actions.component';
import { RegisterFormValues , RegisterFormComponent } from './register-form/register-form.component';
import { RegisterComponent } from './register.component';
import { RegisterService } from './services/register.service';

@Component({
  selector: 'txg-auth-layout',
  template: '<ng-content></ng-content>'
})
class MockAuthLayoutComponent {
  @Input() title!: string;
  @Input() subtitle!: string;
}

@Component({
  selector: 'txg-register-form',
  template: '<div></div>'
})
class MockRegisterFormComponent {
  @Output() formSubmit = new EventEmitter<RegisterFormValues>();

  setLoading = vi.fn();
  setServerError = vi.fn();
}

@Component({
  selector: 'txg-register-actions',
  template: '<div></div>'
})
class MockActionsComponent {}

const mockRegisterService = {
  registerAndSignIn: vi.fn()
};

const mockRouter = {
  navigate: vi.fn()
};

const mockSnackBar = {
  open: vi.fn()
};

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let registerForm: MockRegisterFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BrowserAnimationsModule,
        RegisterComponent
      ],
      providers: [
        { provide: RegisterService, useValue: mockRegisterService },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar }
      ]
    })
    .overrideComponent(RegisterComponent, {
      remove: {
        imports: [
          AuthLayoutComponent,
          RegisterFormComponent,
          ActionsComponent
        ]
      },
      add: {
        imports: [
          MockAuthLayoutComponent,
          MockRegisterFormComponent,
          MockActionsComponent
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    registerForm = fixture.debugElement.query(
      sel => sel.name === 'txg-register-form'
    )?.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onFormSubmit', () => {
    const validForm: RegisterFormValues = {
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should register successfully and navigate to home', async () => {
      mockRegisterService.registerAndSignIn.mockResolvedValue({ success: true });

      await component.onFormSubmit(validForm);

      expect(registerForm.setLoading).toHaveBeenCalledWith(true);
      expect(registerForm.setServerError).toHaveBeenCalledWith(null);
      expect(mockRegisterService.registerAndSignIn).toHaveBeenCalledWith({
        email: validForm.email,
        password: validForm.password
      });
      expect(registerForm.setLoading).toHaveBeenCalledWith(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Registration successful! Welcome to 10xGains.',
        'Close',
        { duration: 5000 }
      );
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should handle registration failure', async () => {
      const errorMessage = 'Email already registered';
      mockRegisterService.registerAndSignIn.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      await component.onFormSubmit(validForm);

      expect(registerForm.setLoading).toHaveBeenCalledWith(false);
      expect(registerForm.setServerError).toHaveBeenCalledWith(errorMessage);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        errorMessage,
        'Close',
        { duration: 5000 }
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      mockRegisterService.registerAndSignIn.mockRejectedValue(new Error('Network error'));

      await component.onFormSubmit(validForm);

      expect(registerForm.setLoading).toHaveBeenCalledWith(false);
      expect(registerForm.setServerError).toHaveBeenCalledWith('An unexpected error occurred');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again later.',
        'Close',
        { duration: 5000 }
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
