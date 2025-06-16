export const environment = {
  production: false,
  enableServiceWorker: false,
  build: {
    name: '__BUILD_NAME__',
    sha: '__BUILD_SHA__',
  },
  supabase: {
    url: '__SUPABASE_URL__',
    key: '__SUPABASE_ANON_KEY__',
  }
};
