import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ServerClockService {
  private offsetMs = 0;

  now(): number {
    return Date.now() + this.offsetMs;
  }

  sync(serverTime: string | number | Date): void {
    const serverMs = new Date(serverTime).getTime();
    if (Number.isNaN(serverMs)) {
      return;
    }

    this.offsetMs = serverMs - Date.now();
  }
}
