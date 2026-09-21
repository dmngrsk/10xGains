import { dataCy } from '../selectors';

/** Every exercise chip, in render order. The ids are uuids, so they are matched by prefix. */
export const exerciseChips = () =>
  cy.getBySel(dataCy.progress.chipRow).find('[data-cy^="progress-exercise-chip-"]');
