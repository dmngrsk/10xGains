import { TrainingPlanViewModel } from './training-plan.viewmodel';

export interface PlanListPageViewModel {
  activePlan: TrainingPlanViewModel | null;
  plans: TrainingPlanViewModel[];
  totalPlans: number;
  isLoading: boolean;
  error: string | null;
}
