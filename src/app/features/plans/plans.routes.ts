import { Route } from '@angular/router';
import { PlanListComponent } from './components/plan-list/plan-list.component';
import { authGuard } from '../../shared/guards/auth.guard';

export const PLANS_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: PlanListComponent,
    canActivate: [authGuard]
  }
];
