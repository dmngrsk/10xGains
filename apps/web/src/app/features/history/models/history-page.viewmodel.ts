import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';

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
  dateRange: DateRangeValue;
  pageSize: number;
  availablePlans: HistoryFilterPlan[] | null;
  pageSizeOptions: number[];
}

export interface HistoryFilterPlan {
  id: string;
  name: string;
}
