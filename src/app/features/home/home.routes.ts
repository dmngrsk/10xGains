import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { HomePageComponent } from './home-page.component';

export const HOME_ROUTES: Route[] = [
  {
    path: '',
    component: HomePageComponent,
    canActivate: [authGuard]
  }
];
