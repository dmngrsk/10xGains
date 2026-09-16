import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { MAT_BOTTOM_SHEET_DEFAULT_OPTIONS, MatBottomSheetConfig } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { AppUpdateService } from '@shared/services/app-update.service';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(() => inject(AppUpdateService).initialize()),
    { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { ...new MatDialogConfig(), autoFocus: 'dialog' } },
    { provide: MAT_BOTTOM_SHEET_DEFAULT_OPTIONS, useValue: { ...new MatBottomSheetConfig(), autoFocus: 'dialog' } },
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.enableServiceWorker,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
