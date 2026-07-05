import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PushSubscriptionDto, UpsertPushSubscriptionCommand } from '@txg/shared';
import { ApiService, ApiServiceResponse } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class PushService {
  private apiService = inject(ApiService);

  /**
   * Registers (or refreshes) a Web Push subscription for the current user.
   */
  saveSubscription(command: UpsertPushSubscriptionCommand): Observable<ApiServiceResponse<PushSubscriptionDto>> {
    return this.apiService.post<UpsertPushSubscriptionCommand, PushSubscriptionDto>('/push/subscriptions', command);
  }

  /**
   * Removes a Web Push subscription for the current user by its endpoint.
   */
  deleteSubscription(endpoint: string): Observable<ApiServiceResponse<null>> {
    return this.apiService.delete(`/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`);
  }
}
