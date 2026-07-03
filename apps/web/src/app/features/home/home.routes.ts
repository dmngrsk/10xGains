import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { HomePageComponent } from './pages/home-page/home-page.component';

export const HOME_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: HomePageComponent,
    canActivate: [authGuard]
  }
];
