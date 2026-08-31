import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';

export type HistoryViewMode = 'list' | 'calendar';

export interface HistoryPageViewModel {
  filters: HistoryFiltersViewModel;
  sessions: SessionCardViewModel[];
  totalSessions: number;
  viewMode: HistoryViewMode;
  /** Narrows the list to the sessions carrying a note, and shows the note in place of the workout. */
  notesOnly: boolean;
  calendarMonth: string; // 'yyyy-MM'
  calendarSessions: SessionCardViewModel[];
  noteSessions: SessionCardViewModel[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
}

export interface HistoryFiltersViewModel {
  selectedPlanId: string;
  dateRange: DateRangeValue;
  availablePlans: HistoryFilterPlan[] | null;
}

export interface HistoryFilterPlan {
  id: string;
  name: string;
}
