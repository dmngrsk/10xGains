import { PlanViewModel } from './plan.viewmodel';

export interface PlanEditPageViewModel {
  plan: PlanViewModel | null;
  isPreview: boolean;
  sessionCount: number;
  isLoading: boolean;
  error: string | null;
}

export const initialPlanEditPageViewModel: PlanEditPageViewModel = {
  plan: null,
  isPreview: false,
  sessionCount: 0,
  isLoading: false,
  error: null,
};
