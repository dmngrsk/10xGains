import { Routes } from '@angular/router';
import { noAuthGuard } from '@shared/guards/no-auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(c => c.LoginComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then(c => c.RegisterComponent),
    canActivate: [noAuthGuard]
  },
  /*{
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password.component').then(c => c.ForgotPasswordComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('./components/reset-password/reset-password.component').then(c => c.ResetPasswordComponent),
    canActivate: [noAuthGuard]
  },*/
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
