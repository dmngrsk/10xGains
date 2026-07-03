import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { HistoryPageComponent } from './pages/history-page/history-page.component';

export const HISTORY_ROUTES: Route[] = [
  {
    path: '',
    component: HistoryPageComponent,
    canActivate: [authGuard],
  }
];
