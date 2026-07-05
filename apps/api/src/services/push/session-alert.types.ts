/** A delayed session notification carried on the `session-alerts` storage queue. */
export type SessionAlertType = 'rest-over' | 'reminder';

export interface SessionAlertMessage {
  type: SessionAlertType;
  userId: string;
  sessionId: string;
  setId: string;
  /** When the alert was scheduled; used to skip it if the user has since acted. */
  scheduledFromIso: string;
}
