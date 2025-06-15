import { Routes } from '@angular/router';
import { noAuthGuard } from '@shared/utils/guards/no-auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'callback',
    loadComponent: () => import('./pages/callback/callback.component').then(c => c.CallbackComponent)
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
