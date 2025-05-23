import { SessionCardViewModel } from "@features/sessions/models/session-card.viewmodel";

export interface HomePageViewModel {
  isLoading: boolean;
  error: string | null;
  name: string | null;
  activeTrainingPlanId: string | null;
  sessions: SessionCardViewModel[] | null;
}
