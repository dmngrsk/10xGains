export const authSelectors = {
  login: {
    emailInput: 'login-email-input',
    passwordInput: 'login-password-input',
    signInButton: 'login-sign-in-button',
    errorMessage: 'login-error-message',
    signUpButton: 'login-sign-up-button',
    resetPasswordButton: 'login-reset-password-button',
  },
  register: {
    emailInput: 'register-email-input',
    passwordInput: 'register-password-input',
    confirmPasswordInput: 'register-confirm-password-input',
    signUpButton: 'register-sign-up-button',
    successNotice: 'auth-layout-subtitle',
  },
  resetPassword: {
    emailInput: 'reset-password-email-input',
    requestSignInLinkButton: 'reset-password-request-link-button',
    successNotice: 'auth-layout-subtitle',
  },
  changePassword: {
    newPasswordInput: 'change-password-new-password-input',
    confirmNewPasswordInput: 'change-password-confirm-new-password-input',
    changePasswordButton: 'change-password-action-button',
  },
};
