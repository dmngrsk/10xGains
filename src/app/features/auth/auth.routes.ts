import { Routes } from '@angular/router';
import { noAuthGuard } from '@shared/utils/guards/no-auth.guard';

export const AUTH_ROUTES: Routes = [
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
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password-page.component').then(c => c.ForgotPasswordPageComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'change-password',
    loadComponent: () => import('./pages/change-password/change-password-page.component').then(c => c.ChangePasswordPageComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'callback',
    loadComponent: () => import('./pages/callback/callback-page.component').then(c => c.CallbackPageComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
