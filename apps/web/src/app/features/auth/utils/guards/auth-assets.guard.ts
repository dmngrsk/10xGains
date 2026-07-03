import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable } from 'rxjs';
import { ImagePreloadService } from '@shared/services/image-preload.service';

export const authAssetsGuard: ResolveFn<void> = (): Observable<void> => {
  const imagePreloader = inject(ImagePreloadService);

  return imagePreloader.preload('assets/images/logo-auth.png');
};
