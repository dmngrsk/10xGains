import { Routes } from '@angular/router';
import { noAuthGuard } from '@shared/utils/guards/no-auth.guard';
import { authAssetsGuard } from './utils/guards/auth-assets.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'callback',
    loadComponent: () => import('./pages/callback/callback.component').then(c => c.CallbackComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page.component').then(c => c.LoginPageComponent),
    canActivate: [noAuthGuard, authAssetsGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register-page.component').then(c => c.RegisterPageComponent),
    canActivate: [noAuthGuard, authAssetsGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password-page.component').then(c => c.ResetPasswordPageComponent),
    canActivate: [noAuthGuard, authAssetsGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
