import { Route } from '@angular/router';
import { HomePageComponent } from './home-page';
import { authGuard } from '../../shared/guards/auth.guard';

export const HOME_ROUTES: Route[] = [
  {
    path: '',
    component: HomePageComponent,
    canActivate: [authGuard]
  }
];
