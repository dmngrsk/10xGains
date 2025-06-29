import { SessionCardViewModel } from "@features/sessions/models/session-card.viewmodel";

export interface HomePageViewModel {
  sessions: SessionCardViewModel[] | null;
  activePlanId: string | null;
  name: string | null;
  isLoading: boolean;
  error: string | null;
}
