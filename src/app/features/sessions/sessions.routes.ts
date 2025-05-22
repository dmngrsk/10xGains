import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { SessionPageComponent } from './components/session-page/session-page.component';

export const SESSIONS_ROUTES: Route[] = [
  {
    path: ':sessionId',
    component: SessionPageComponent,
    canActivate: [authGuard]
  },
];
