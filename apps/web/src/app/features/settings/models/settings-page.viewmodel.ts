export interface SettingsPageViewModel {
  profile: ProfileSettingsCardViewModel;
  account: AccountSettingsCardViewModel;
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

export type SettingsViewMode = 'workout' | 'user';
