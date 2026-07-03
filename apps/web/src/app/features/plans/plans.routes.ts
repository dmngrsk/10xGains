import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { PlanEditPageComponent } from './pages/plan-edit-page/plan-edit-page.component';
import { PlanListPageComponent } from './pages/plan-list-page/plan-list-page.component';

export const PLANS_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: PlanListPageComponent,
    canActivate: [authGuard]
  },
  {
    path: ':planId',
    component: PlanEditPageComponent,
    canActivate: [authGuard]
  }
];
