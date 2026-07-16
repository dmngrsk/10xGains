import { dataCy } from '../../support/selectors';

/**
 * The slice of the live Chart.js instance PROG-08 introspects, exposed on window by the chart
 * component. Declared here rather than imported from chart.js: the spec only reads these few
 * members, and importing the real types would pull the library into the spec bundle.
 */
interface ProgressChart {
  data: { datasets: { label: string; data: { x: number }[] }[] };
  tooltip: { getActiveElements(): { datasetIndex: number; index: number }[] };
  getSortedVisibleDatasetMetas(): { index: number; data: { x: number; y: number }[] }[];
}

interface ChartWindow {
  Chart: { getChart(canvas: HTMLCanvasElement): ProgressChart };
}

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const formatDate = (date: Date): string => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
const WORKOUT_A_ONLY_FROM = formatDate(daysAgo(31));
const WORKOUT_A_ONLY_TO = formatDate(daysAgo(29));

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

      // The scaffolded session history is anchored to the recent past, so it
      // falls within the default "Last 3 months" range and the chart renders on
      // load. Widen to "All time" for deterministic assertions regardless of the
      // default range.
      cy.getBySel(dataCy.progress.chartCanvas).should('be.visible');

      cy.getBySel(dataCy.progress.filterButton).click();
      cy.getBySel(dataCy.shared.dateRange.presetButton).click();
      cy.getBySel(dataCy.shared.dateRange.presetOption).contains('All time').click();
      cy.getBySel(dataCy.progress.filterDialog.applyFiltersButton).click();

      // Filters are applied on the dialog's afterClosed, so wait for the summary to catch up -
      // reopening the dialog before then would hand it the previous range.
      cy.getBySel(dataCy.progress.filterSummary).should('contain.text', 'All time');
    });

    it('renders the chart with one chip per exercise of the plan', { tags: ['PROG-01'] }, () => {
      cy.getBySel(dataCy.progress.chartCanvas).should('be.visible');
      cy.getBySel(dataCy.progress.exerciseChip).should('have.length', 3);

      cy.getBySel(dataCy.progress.exerciseChip).eq(0).should('contain.text', 'Squat');
      cy.getBySel(dataCy.progress.exerciseChip).eq(1).should('contain.text', 'Bench Press');
      cy.getBySel(dataCy.progress.exerciseChip).eq(2).should('contain.text', 'Deadlift');

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
      cy.getBySel(dataCy.shared.dateRange.presetButton).click();
      cy.getBySel(dataCy.shared.dateRange.presetOption).contains('All time').click();
      cy.getBySel(dataCy.progress.filterDialog.applyFiltersButton).click();

      cy.getBySel(dataCy.progress.filterSummary).should('contain.text', 'All plans');
      cy.getBySel(dataCy.progress.exerciseChip).should('have.length', 3);

      // Reopening must still show the choice: a mat-select clears its trigger if the
      // selected option's value is null, which would blank the field out.
      cy.getBySel(dataCy.progress.filterButton).click();
      cy.getBySel(dataCy.progress.filterDialog.planSelect).should('contain.text', 'All plans');
    });

    it('narrows the plotted series to the filtered date range', { tags: ['PROG-04'] }, () => {
      cy.getBySel(dataCy.progress.exerciseChip).should('have.length', 3);

      cy.getBySel(dataCy.progress.filterButton).click();
      cy.getBySel(dataCy.shared.dateRange.startInput).clear().type(WORKOUT_A_ONLY_FROM);
      cy.getBySel(dataCy.shared.dateRange.endInput).clear().type(WORKOUT_A_ONLY_TO);
      cy.getBySel(dataCy.progress.filterDialog.applyFiltersButton).click();

      cy.getBySel(dataCy.progress.exerciseChip).should('have.length', 2);
      cy.getBySel(dataCy.progress.exerciseChip).should('contain.text', 'Squat');
      cy.getBySel(dataCy.progress.exerciseChip).should('contain.text', 'Bench Press');
      cy.getBySel(dataCy.progress.exerciseChip).should('not.contain.text', 'Deadlift');
    });
  });

  describe('when the progress page has no data or encounters errors', () => {
    it('shows the empty state notice when no data matches the filters', { tags: ['PROG-05'] }, () => {
      cy.intercept('GET', '**/api/progress/exercises*', { statusCode: 200, fixture: 'shared/common-data-empty.json' });
      cy.navigateTo('progress');

      cy.getBySel(dataCy.progress.emptyNotice).should('exist');
    });

    it('displays an error notice if the progress data fails to load', { tags: ['PROG-06'] }, () => {
      cy.intercept('GET', '**/api/progress/exercises*', { statusCode: 500, fixture: 'shared/common-error.json' });
      cy.navigateTo('progress');

      cy.getBySel(dataCy.progress.errorNotice).should('exist');
    });

    it('reloads the progress data when the user clicks the retry button', { tags: ['PROG-07'] }, () => {
      cy.intercept({ method: 'GET', url: '**/api/progress/exercises*', times: 1 }, { statusCode: 500, fixture: 'shared/common-error.json' });
      cy.navigateTo('progress');

      cy.getBySel(dataCy.progress.errorNotice).should('exist');
      cy.getBySel(dataCy.progress.errorNotice).find('button').contains('Try Again').click();

      // The reloaded real data is anchored to the recent past, so it falls
      // within the default 3-month range and the chart renders.
      cy.getBySel(dataCy.progress.chartCanvas).should('be.visible');
    });
  });

  describe('when interacting with the progress chart', () => {
    beforeEach(() => {
      cy.navigateTo('progress');
      cy.getBySel(dataCy.progress.chartCanvas).should('be.visible');
    });

    it('activates every point of the pressed day across series', { tags: ['PROG-08'] }, () => {
      cy.getBySel(dataCy.progress.chartCanvas).then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;

        cy.window().then((win) => {
          const chart = (win as unknown as ChartWindow).Chart.getChart(canvas);

          // Deadlift only appears on Workout B days, which also carry a Squat point, so
          // any Deadlift point sits on a day shared by two series.
          const deadliftMeta = chart.getSortedVisibleDatasetMetas()
            .find(meta => chart.data.datasets[meta.index].label === 'Deadlift');
          const point = deadliftMeta!.data[0];

          // Coordinates are element-relative, so Cypress derives the offsets Chart.js reads.
          cy.wrap(canvas)
            .trigger('mouseover', point.x, point.y)
            .trigger('mousemove', point.x, point.y);

          // Chart.js throttles pointer handling through requestAnimationFrame, so the tooltip
          // lands a frame later - retry the assertion rather than reading it straight away.
          cy.wrap(null).should(() => {
            const active = chart.tooltip.getActiveElements();
            expect(active).to.have.length(2);

            const days = active.map(el => chart.data.datasets[el.datasetIndex].data[el.index].x);
            expect(days[0]).to.equal(days[1]);
          });
        });
      });
    });
  });
});
