import { Route } from '@angular/router';
import { authGuard } from '@shared/guards/auth.guard';
import { PlanListComponent } from './components/plan-list/plan-list.component';

export const PLANS_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: PlanListComponent,
    canActivate: [authGuard]
  },
  {
    path: ':planId/edit',
    loadComponent: () => import('./components/plan-edit/plan-edit.component').then(m => m.PlanEditComponent),
    canActivate: [authGuard]
  }
];
