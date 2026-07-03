import { Route } from '@angular/router';
import { authGuard } from '@shared/utils/guards/auth.guard';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';

export const SETTINGS_ROUTES: Route[] = [
  {
    path: '',
    component: SettingsPageComponent,
    canActivate: [authGuard],
  }
];
