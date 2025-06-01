import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { PlanEditComponent } from './pages/plan-edit/plan-edit.component';
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
    component: PlanEditComponent,
    canActivate: [authGuard]
  }
];
