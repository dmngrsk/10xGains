import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Component, EventEmitter, Output } from '@angular/core';
import { LoginComponent } from './login.component';
import { LoginService } from './services/login.service';
import { LoginFormValues } from '../../shared/types';
import { AuthLayoutComponent } from '../shared/auth-layout/auth-layout.component';
import { LoginFormComponent } from './login-form/login-form.component';
import { ActionsComponent } from './actions/actions.component';

// Mock components
@Component({
  selector: 'txg-auth-layout',
  template: '<ng-content></ng-content>'
})
class MockAuthLayoutComponent {}

@Component({
  selector: 'txg-login-form',
  template: '<div></div>'
})
class MockLoginFormComponent {
  @Output() formSubmit = new EventEmitter<LoginFormValues>();

  setLoading = vi.fn();
}

@Component({
  selector: 'txg-login-actions',
  template: '<div></div>'
})
class MockActionsComponent {}

// Mock services
const mockLoginService = {
  login: vi.fn()
};

const mockRouter = {
  navigate: vi.fn()
};

const mockSnackBar = {
  open: vi.fn()
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let loginForm: MockLoginFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BrowserAnimationsModule,
        LoginComponent
      ],
      providers: [
        { provide: LoginService, useValue: mockLoginService },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar }
      ]
    })
    .overrideComponent(LoginComponent, {
      remove: {
        imports: [
          AuthLayoutComponent,
          LoginFormComponent,
          ActionsComponent
        ]
      },
      add: {
        imports: [
          MockAuthLayoutComponent,
          MockLoginFormComponent,
          MockActionsComponent
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Get a reference to the mocked form component
    loginForm = fixture.debugElement.query(
      sel => sel.name === 'txg-login-form'
    )?.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onFormSubmit', () => {
    const validForm: LoginFormValues = {
      email: 'test@example.com',
      password: 'password123'
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should login successfully and navigate', async () => {
      mockLoginService.login.mockResolvedValue(undefined);

      await component.onFormSubmit(validForm);

      expect(loginForm.setLoading).toHaveBeenCalledWith(true);
      expect(mockLoginService.login).toHaveBeenCalledWith({
        email: validForm.email,
        password: validForm.password
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
      expect(loginForm.setLoading).toHaveBeenCalledWith(false);

      // No snackbar should be shown on success as we're redirecting
      expect(mockSnackBar.open).not.toHaveBeenCalled();
    });

    it('should handle login error', async () => {
      const errorMessage = 'Invalid email or password';
      mockLoginService.login.mockRejectedValue(new Error(errorMessage));

      await component.onFormSubmit(validForm);

      expect(loginForm.setLoading).toHaveBeenCalledWith(true);
      expect(mockLoginService.login).toHaveBeenCalledWith({
        email: validForm.email,
        password: validForm.password
      });
      expect(loginForm.setLoading).toHaveBeenCalledWith(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        errorMessage,
        'Close',
        { duration: 5000 }
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should handle generic error', async () => {
      mockLoginService.login.mockRejectedValue('Unknown error');

      await component.onFormSubmit(validForm);

      expect(loginForm.setLoading).toHaveBeenCalledWith(true);
      expect(mockLoginService.login).toHaveBeenCalledWith({
        email: validForm.email,
        password: validForm.password
      });
      expect(loginForm.setLoading).toHaveBeenCalledWith(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'An error occurred. Please try again later.',
        'Close',
        { duration: 5000 }
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
