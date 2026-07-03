import { Routes } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('@features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'history',
    loadChildren: () => import('./features/history/history.routes').then(m => m.HISTORY_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: 'home',
    loadChildren: () => import('@features/home/home.routes').then(m => m.HOME_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: 'plans',
    loadChildren: () => import('@features/plans/plans.routes').then(m => m.PLANS_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: 'sessions',
    loadChildren: () => import('@features/sessions/sessions.routes').then(m => m.SESSIONS_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
