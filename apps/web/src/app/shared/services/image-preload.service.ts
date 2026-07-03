import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ImagePreloadService {
  preload(...urls: string[]): Observable<void> {
    const promises = urls.map(url => this.createImagePromise(url));
    return from(Promise.all(promises)).pipe(map(() => {}));
  }

  private createImagePromise(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(`Failed to load image at ${url}`);
      img.src = url;
    });
  }
}
