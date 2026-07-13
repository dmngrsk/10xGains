import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { ProgressPageComponent } from './pages/progress-page/progress-page.component';

export const PROGRESS_ROUTES: Route[] = [
  {
    path: '',
    component: ProgressPageComponent,
    canActivate: [authGuard],
  }
];
