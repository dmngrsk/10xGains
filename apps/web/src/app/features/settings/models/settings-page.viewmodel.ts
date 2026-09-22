import type { BodyFatMethod, Sex, MeasurementType } from '@txg/shared';

export interface SettingsPageViewModel {
  profile: ProfileSettingsCardViewModel;
  account: AccountSettingsCardViewModel;
  measurements: MeasurementsSettingsCardViewModel;
  isLoading: boolean;
  error: string | null;
}

export interface ProfileSettingsCardViewModel {
  firstName: string | null;
  email: string | null;
}

export interface AccountSettingsCardViewModel {
  googleLinked: boolean | null;
  identityCount: number;
}

export interface MeasurementsSettingsCardViewModel {
  heightCm: number | null;
  dateOfBirth: string | null;
  bodyFatMethod: BodyFatMethod | null;
  sex: Sex | null;
  frequencyDays: number | null;
  trackedTypes: MeasurementType[] | null;
  loggedTypes: MeasurementType[];
}

export type SettingsViewMode = 'workout' | 'measurements' | 'user';
