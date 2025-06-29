import { PlanViewModel } from './plan.viewmodel';

export interface PlanListPageViewModel {
  activePlan: PlanViewModel | null;
  plans: PlanViewModel[];
  totalPlans: number;
  isLoading: boolean;
  error: string | null;
}
