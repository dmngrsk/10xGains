import { exercisesTasks } from './tasks/exercises';
import { measurementsTasks } from './tasks/measurements';
import { plansTasks } from './tasks/plans';
import { profilesTasks } from './tasks/profiles';
import { sessionsTasks } from './tasks/sessions';
import { usersTasks } from './tasks/users';

// Cypress node tasks, grouped by scope in ./tasks/*. Registered in cypress.config.ts via
// `on('task', tasks)`. Each task name follows the `scope:action` convention.
export const tasks = {
  ...exercisesTasks,
  ...measurementsTasks,
  ...plansTasks,
  ...profilesTasks,
  ...sessionsTasks,
  ...usersTasks
};
