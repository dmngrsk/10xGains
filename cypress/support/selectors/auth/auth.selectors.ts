export const authSelectors = {
  login: {
    emailInput: 'login-email-input',
    passwordInput: 'login-password-input',
    signInButton: 'login-sign-in-button',
    errorMessage: 'login-error-message',
    signUpButton: 'login-sign-up-button',
    forgotPasswordButton: 'login-forgot-password-button',
  },
  register: {
    emailInput: 'register-email-input',
    passwordInput: 'register-password-input',
    confirmPasswordInput: 'register-confirm-password-input',
    signUpButton: 'register-sign-up-button',
    successNotice: 'auth-layout-subtitle',
  },
  forgotPassword: {
    emailInput: 'forgot-password-email-input',
    requestPasswordResetButton: 'forgot-password-request-password-reset-button',
    successNotice: 'auth-layout-subtitle',
  },
  changePassword: {
    newPasswordInput: 'change-password-new-password-input',
    confirmNewPasswordInput: 'change-password-confirm-new-password-input',
    changePasswordButton: 'change-password-action-button',
  },
};
