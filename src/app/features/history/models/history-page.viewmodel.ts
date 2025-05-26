import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';

export interface HistoryPageViewModel {
  filters: HistoryFiltersViewModel;
  sessions: SessionCardViewModel[];
  totalSessions: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
}

export interface HistoryFiltersViewModel {
  selectedTrainingPlanId: string;
  dateFrom: string | null;
  dateTo: string | null;
  pageSize: number;
  availableTrainingPlans: HistoryFilterTrainingPlan[] | null;
  pageSizeOptions: number[];
}

export interface HistoryFilterTrainingPlan {
  id: string;
  name: string;
}
