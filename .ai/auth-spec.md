# Authentication Module Specification (US-001)

## 1. User Interface Architecture

### 1.1. Directory and File Structure
- `src/app/features/auth/`
  - `auth.routes.ts` – routing configuration for the auth module
  - `components/`
    - `login/`
      - `login.component.ts|html|scss`
    - `register/`
      - `register.component.ts|html|scss`
    - `forgot-password/`
      - `forgot-password.component.ts|html|scss`
    - `reset-password/`
      - `reset-password.component.ts|html|scss`
    - `shared/`
      - `auth-layout/`
        - `auth-layout.component.ts|html|scss` – shared layout for authentication pages
  - `services/`
    - `auth.service.ts` – Supabase client integration and API call logic
    - `auth.models.ts` – data interfaces (AuthRequest, AuthResponse, ErrorResponse)
  - `guards/`
    - `auth.guard.ts` – protects routes that require authentication
    - `no-auth.guard.ts` – prevents authenticated users from accessing auth routes

### 1.2. Routing and Lazy Loading
```ts
// auth.routes.ts
export const AUTH_ROUTES: Route[] = [
  { path: 'login', component: LoginComponent, canActivate: [NoAuthGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [NoAuthGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [NoAuthGuard] },
  { path: 'reset-password/:token', component: ResetPasswordComponent, canActivate: [NoAuthGuard] },
];

// app.routes.ts
{
  path: 'auth',
  loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
}
```

### 1.3. Layouts and Styles
- **AuthLayoutComponent**: a centered Angular Material card layout for authentication pages, complete with background styling and links for login, registration, and password recovery.
- **AppLayoutComponent** (unchanged): used for protected areas of the application.
- Utilize Tailwind CSS for responsive spacing and consistent margins.

### 1.4. Components and Forms
- **RegisterComponent**
  - Fields: `email`, `password`, `confirmPassword`
  - Reactive Forms with validators: `required`, `email`, `minLength(8)`, and a custom `passwordMatchValidator`
- **LoginComponent**
  - Fields: `email`, `password`
  - Validators: `required`, `email`
- **ForgotPasswordComponent**
  - Field: `email` with `required` and `email` validators
- **ResetPasswordComponent**
  - Fields: `newPassword`, `confirmPassword` with the same validators as the registration form
- Shared UI elements: `<mat-form-field>`, `<input matInput>`, and buttons disabled when the form is invalid.

### 1.5. Validation and Error Messages
- Empty fields → "This field is required."
- Invalid email format → "Invalid email format."
- Password too short → "Password must be at least 8 characters."
- Passwords do not match → "Passwords must match."
- Server errors (e.g., user already exists, invalid credentials) → display the Supabase error message or a unified notification.

### 1.6. User Scenarios
1. **Registration**: User completes the form → `authService.register()` → on success show "Registration complete, please check your email." → redirect to `/auth/login`.
2. **Login**: `authService.login()` → on success store session and token, then redirect to `/home`.
3. **Logout**: `authService.logout()` → clear session → redirect to `/auth/login`.
4. **Password Recovery**:
   - Request reset: call `authService.requestPasswordRecovery()` on `/auth/forgot-password`, sending an email with the reset link.
   - Reset password: on `/auth/reset-password/:token` call `authService.resetPassword(token, newPassword)`, show a success message, and redirect to login.

## 2. Application Logic (Angular AuthService)

### 2.1. Registration (Sign Up)
- Call: `supabaseService.client.auth.signUp({ email, password })`
- On success: redirect to `/auth/login` with a confirmation message.

### 2.2. Login (Sign In)
- Call: `supabaseService.client.auth.signInWithPassword({ email, password })`
- On success: save session and token, redirect to `/home`.

### 2.3. Logout (Sign Out)
- Call: `supabaseService.client.auth.signOut()`
- Clear the local session and redirect to `/auth/login`.

### 2.4. Forgot & Reset Password
- Request: `supabaseService.client.auth.resetPasswordForEmail(email, { redirectTo: '<your-app-url>/auth/reset-password' })`
- Reset: `supabaseService.client.auth.updateUser({ password: newPassword }, { token })`
- Handle notifications via snack bars and inline form messages.

### 2.5. Error Handling and Validation
- Client-side (Reactive Forms) validators: `required`, `email`, `minLength`, `passwordMatch`.
- AuthService catches and maps Supabase errors into defined `ErrorResponse` types.
- Components display error or success messages using snack bars and inline form feedback.

### 2.6. Guards and Session Management
- **AuthGuard**: blocks unauthenticated access to protected routes by checking for an active session via `supabaseService.client.auth.getSession()`.
- **NoAuthGuard**: prevents authenticated users from accessing `auth/*` routes, redirecting them to `/home`.

### 2.7. Navigation After Auth Events
- After successful login: redirect to `/home`.
- After logout: redirect to `/auth/login`.
