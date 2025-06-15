import { authSelectors } from './auth';
import { historySelectors } from './history';
import { homeSelectors } from './home';
import { plansSelectors } from './plans';
import { sessionsSelectors } from './sessions';
import { settingsSelectors } from './settings';
import { sharedSelectors } from './shared';

export const dataCy = {
  auth: authSelectors,
  history: historySelectors,
  home: homeSelectors,
  plans: plansSelectors,
  sessions: sessionsSelectors,
  settings: settingsSelectors,
  shared: sharedSelectors,
};
