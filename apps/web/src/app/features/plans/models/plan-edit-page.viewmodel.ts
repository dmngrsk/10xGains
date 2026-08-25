import { PlanViewModel } from './plan.viewmodel';

export interface PlanEditPageViewModel {
  plan: PlanViewModel | null;
  sessionCount: number;
  openSessionCount: number;
  isLoading: boolean;
  error: string | null;
}

export const initialPlanEditPageViewModel: PlanEditPageViewModel = {
  plan: null,
  sessionCount: 0,
  openSessionCount: 0,
  isLoading: false,
  error: null,
};
