export interface SettingsPageViewModel {
  profile: ProfileSettingsCardViewModel;
  isLoading: boolean;
  error: string | null;
}

export interface ProfileSettingsCardViewModel {
  firstName: string | null;
  email: string | null;
  aiSuggestionsRemaining: number | null;
}
