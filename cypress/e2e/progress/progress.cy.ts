import { dataCy } from '../../support/selectors';

describe('Exercise Progress', { tags: ['@progress'] }, () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when viewing the progress page with completed sessions', () => {
    beforeEach(() => {
      cy.navigateTo('progress');

      // The scaffolded session history has fixed mid-2025 dates, which fall
      // outside the default "Last 3 months" range, so the page starts empty.
      cy.getBySel(dataCy.progress.emptyNotice).should('exist');

      cy.getBySel(dataCy.progress.filterButton).click();
      cy.getBySel(dataCy.progress.filterDialog.rangeSelect).click();
      cy.get('mat-option').contains('All time').click();
      cy.getBySel(dataCy.progress.filterDialog.applyFiltersButton).click();
    });

    it('renders the chart with one chip per exercise of the plan', { tags: ['PROG-01'] }, () => {
      cy.getBySel(dataCy.progress.chartCanvas).should('be.visible');
      cy.getBySel(dataCy.progress.exerciseChip).should('have.length', 3);

      ['Squat', 'Bench Press', 'Deadlift'].forEach(exerciseName => {
        cy.getBySel(dataCy.progress.exerciseChip).should('contain.text', exerciseName);
      });

      cy.getBySel(dataCy.progress.filterSummary).should('contain.text', 'All time');
    });

    it('toggles a series when its exercise chip is clicked', { tags: ['PROG-02'] }, () => {
      cy.getBySel(dataCy.progress.exerciseChip).first().should('have.class', 'mat-mdc-chip-selected');

      cy.getBySel(dataCy.progress.exerciseChip).first().click();
      cy.getBySel(dataCy.progress.exerciseChip).first().should('not.have.class', 'mat-mdc-chip-selected');
      cy.getBySel(dataCy.progress.chartCanvas).should('be.visible');

      cy.getBySel(dataCy.progress.exerciseChip).first().click();
      cy.getBySel(dataCy.progress.exerciseChip).first().should('have.class', 'mat-mdc-chip-selected');
    });

    it('allows widening the scope to all training plans', { tags: ['PROG-03'] }, () => {
      cy.getBySel(dataCy.progress.filterSummary).should('contain.text', 'Test Training Plan');

      cy.getBySel(dataCy.progress.filterButton).click();
      cy.getBySel(dataCy.progress.filterDialog.planSelect).click();
      cy.get('mat-option').contains('All plans').click();
      cy.getBySel(dataCy.progress.filterDialog.rangeSelect).click();
      cy.get('mat-option').contains('All time').click();
      cy.getBySel(dataCy.progress.filterDialog.applyFiltersButton).click();

      cy.getBySel(dataCy.progress.filterSummary).should('contain.text', 'All plans');
      cy.getBySel(dataCy.progress.exerciseChip).should('have.length', 3);

      // Reopening must still show the choice: a mat-select clears its trigger if the
      // selected option's value is null, which would blank the field out.
      cy.getBySel(dataCy.progress.filterButton).click();
      cy.getBySel(dataCy.progress.filterDialog.planSelect).should('contain.text', 'All plans');
    });
  });

  describe('when the progress page has no data or encounters errors', () => {
    it('shows the empty state notice when no data matches the filters', { tags: ['PROG-04'] }, () => {
      cy.intercept('GET', '**/api/progress/exercises*', { statusCode: 200, fixture: 'shared/common-data-empty.json' });
      cy.navigateTo('progress');

      cy.getBySel(dataCy.progress.emptyNotice).should('exist');
    });

    it('displays an error notice if the progress data fails to load', { tags: ['PROG-05'] }, () => {
      cy.intercept('GET', '**/api/progress/exercises*', { statusCode: 500, fixture: 'shared/common-error.json' });
      cy.navigateTo('progress');

      cy.getBySel(dataCy.progress.errorNotice).should('exist');
    });

    it('reloads the progress data when the user clicks the retry button', { tags: ['PROG-06'] }, () => {
      cy.intercept({ method: 'GET', url: '**/api/progress/exercises*', times: 1 }, { statusCode: 500, fixture: 'shared/common-error.json' });
      cy.navigateTo('progress');

      cy.getBySel(dataCy.progress.errorNotice).should('exist');
      cy.getBySel(dataCy.progress.errorNotice).find('button').contains('Try Again').click();

      // The reloaded real data is older than the default 3-month range.
      cy.getBySel(dataCy.progress.emptyNotice).should('exist');
    });
  });
});
