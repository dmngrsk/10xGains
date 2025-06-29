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
  selectedPlanId: string;
  dateFrom: string | null;
  dateTo: string | null;
  pageSize: number;
  availablePlans: HistoryFilterPlan[] | null;
  pageSizeOptions: number[];
}

export interface HistoryFilterPlan {
  id: string;
  name: string;
}
