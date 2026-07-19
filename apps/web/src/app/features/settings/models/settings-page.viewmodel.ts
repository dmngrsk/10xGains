export interface SettingsPageViewModel {
  profile: ProfileSettingsCardViewModel;
  account: AccountSettingsCardViewModel;
  isLoading: boolean;
  error: string | null;
}

export interface ProfileSettingsCardViewModel {
  firstName: string | null;
  email: string | null;
  aiSuggestionsRemaining: number | null;
}

export interface AccountSettingsCardViewModel {
  googleLinked: boolean | null;
  identityCount: number;
}
