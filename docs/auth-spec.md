# Authentication Module Specification (US-001)

## 1. User Interface Architecture

### 1.1. Directory and File Structure
- `src/app/features/auth/`
  - `auth.routes.ts` – routing configuration for the auth module
  - `pages/`
    - `login/`
      - `login-page.component.ts|html|scss`
    - `register/`
      - `register-page.component.ts|html|scss`
    - `reset-password/`
      - `reset-password-page.component.ts|html|scss`
    - `callback/`
      - `callback-page.component.ts` – handles Supabase auth redirects
- `src/app/shared/ui/layouts`
  - `auth-layout/`
    - `auth-layout.component.ts|html|scss` – shared layout for authentication pages

### 1.2. Routing and Lazy Loading
```ts
// src/app/features/auth/auth.routes.ts
export const AUTH_ROUTES: Routes = [
  {
    path: 'callback',
    loadComponent: () => import('./pages/callback/callback-page.component').then(c => c.CallbackPageComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page.component').then(c => c.LoginPageComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register-page.component').then(c => c.RegisterPageComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password-page.component').then(c => c.ResetPasswordPageComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
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

### 1.4. Pages and Forms
- **LoginPageComponent**
  - Fields: `email`, `password`
  - Validators: `required`, `email`
- **RegisterPageComponent**
  - Fields: `email`, `password`, `confirmPassword`
  - Reactive Forms with validators: `required`, `email`, `minLength(8)`, and a custom `passwordMatchValidator`
- **ResetPasswordPageComponent**
  - Field: `email` with `required` and `email` validators
- **CallbackPageComponent**
  - No form. Handles auth callbacks from Supabase for actions like email verification and password resets. Redirects the user to the appropriate page after the action is complete.
- Shared UI elements: `<mat-form-field>`, `<input matInput>`, and buttons disabled when the form is invalid.

### 1.5. Validation and Error Messages
- Empty fields → "This field is required."
- Invalid email format → "Invalid email format."
- Password too short → "Password must be at least 8 characters."
- Passwords do not match → "Passwords must match."
- Server errors (e.g., user already exists, invalid credentials) → display the Supabase error message or a unified notification.

### 1.6. User Scenarios
1. **Registration**: User completes the form → `authService.register()` → The subsequent flow depends on the Supabase email provider configuration:
   - **With Email Verification**: On success, the app shows "Registration initiated, please check your email for a verification link." Supabase sends an email. The user clicks the link and is redirected to `/auth/callback?type=register`. The callback handler creates a default user profile, shows a success snackbar, and redirects to `/auth/login`.
   - **Without Email Verification**: The user is automatically logged in and redirected to the `/home` page. A default user profile is created in the background.
2. **Login**: `authService.login()` → on success store session and token, then redirect to `/home`.
3. **Logout**: `authService.logout()` → clear session → redirect to `/auth/login`.
4. **Password Recovery**:
   - Request reset: User provides email on `/auth/reset-password`. Call `authService.resetPassword()`, which sends a magic link.
   - Reset password: User clicks the link, which logs them in and redirects to `/auth/callback?type=reset-password`. The callback handler redirects to the `/settings` page, where the user can securely update their password.

## 2. Application Logic (Shared AuthService)

The `AuthService` located at `@shared/services/auth.service.ts` will handle all interactions with the Supabase client for authentication.

### 2.1. Registration (Sign Up)
- Call: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: '<your-app-url>/auth/callback?type=register' } })`
- On success: Show a message prompting the user to check their email. The rest of the flow is handled by the callback page.

### 2.2. Login (Sign In)
- Call: `supabase.auth.signInWithPassword({ email, password })`
- On success: save session and token, redirect to `/home`.

### 2.3. Logout (Sign Out)
- Call: `supabase.auth.signOut()`
- Clear the local session and redirect to `/auth/login`.

### 2.4. Forgot & Reset Password
- Request: `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<your-app-url>/auth/callback?type=reset-password' })`
- Reset: The user is redirected to a protected `settings` page to update their password after clicking the magic link. The `updateUser` logic will be handled on that page, not directly in the auth feature.

### 2.5. Error Handling and Validation
- Client-side (Reactive Forms) validators: `required`, `email`, `minLength`, `passwordMatch`.
- `AuthService` catches and maps Supabase errors into defined `ErrorResponse` types.
- Components display error or success messages using snack bars and inline form feedback.

### 2.6. Guards and Session Management
- **AuthGuard**: blocks unauthenticated access to protected routes by checking for an active session. Located at `@shared/utils/guards/auth.guard.ts`.
- **NoAuthGuard**: prevents authenticated users from accessing `/auth/*` routes, redirecting them to `/home`. Located at `@shared/utils/guards/no-auth.guard.ts`.

### 2.7. Navigation After Auth Events
- After successful login: redirect to `/home`.
- After logout: redirect to `/auth/login`.
- After successful registration (and email verification): redirect to `/auth/login`.
- After password reset: redirect to `/settings`.
