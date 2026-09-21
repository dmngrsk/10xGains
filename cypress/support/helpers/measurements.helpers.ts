import { dataCy } from '../selectors';

/**
 * Setup and UI flows for body-measurement specs, shared between them.
 *
 * The database-facing helpers wrap the `measurements:*` tasks; the UI ones each start from a
 * signed-in session and say which page they leave you on.
 */

interface MeasurementRow {
  measured_on: string;
  type: string;
  value: number;
}

/** The slice of the live Chart.js instance these specs read, exposed on window by the chart. */
interface MeasurementChart {
  data: { datasets: { label: string; data: { y: number }[] }[] };
}

interface ChartWindow {
  Chart: { getChart(canvas: HTMLCanvasElement): MeasurementChart };
}

/** The body-composition columns, as `measurements:getProfile` returns them. */
interface BodyCompositionProfile {
  body_fat_method: string | null;
  sex: string | null;
  height_cm: number | null;
  date_of_birth: string | null;
  measurement_frequency_days: number | null;
  tracked_measurement_types: string[] | null;
}

interface BodyCompositionFields {
  body_fat_method?: string | null;
  sex?: string | null;
  height_cm?: number | null;
  date_of_birth?: string | null;
  measurement_frequency_days?: number | null;
  tracked_measurement_types?: string[] | null;
}

function withUser(run: (userId: string) => void) {
  return cy.get('@currentUserId').then(userId => run(userId as unknown as string));
}

export function seedMeasurements(measurements: MeasurementRow[]) {
  return withUser(userId => cy.task('measurements:seed', { userId, measurements }));
}

export function setBodyComposition(fields: BodyCompositionFields) {
  return withUser(userId => cy.task('measurements:setProfile', { userId, ...fields }));
}

export function readMeasurements(assert: (rows: MeasurementRow[]) => void) {
  return withUser(userId => cy.task<MeasurementRow[]>('measurements:list', { userId }).should(assert));
}

export function readBodyComposition(assert: (profile: BodyCompositionProfile) => void) {
  return withUser(userId =>
    cy.task<BodyCompositionProfile>('measurements:getProfile', { userId }).should(assert));
}

/** Leaves you on the Body tab of /progress. */
export function openMeasurementsTab() {
  cy.navigateTo('progress');
  cy.getBySel(dataCy.progress.tabs.body).click();
  cy.getBySel(dataCy.progress.measurementsView).should('exist');
}

/** Leaves you on the Measurements tab of /settings. */
export function openMeasurementsSettings() {
  cy.navigateTo('settings');
  cy.getBySel(dataCy.settings.tabs.measurements).click();
  cy.getBySel(dataCy.measurements.settings.card).should('be.visible');
}

/** Opens the log dialog from whichever entry point the page is currently offering. */
export function openLogDialog({ fromEmptyState = false } = {}) {
  if (fromEmptyState) {
    cy.getBySel(dataCy.measurements.noDataNotice).find('button').click();
    return;
  }

  cy.getBySel(dataCy.measurements.logButton).click();
}

/**
 * Picks an option from a Material select.
 *
 * Two interaction artifacts, neither a layout bug. `scrollBehavior: 'center'` because Cypress
 * aligns a target to the scroll container's top before clicking, which parks it under the fixed
 * tab strip. And the trigger rather than the `mat-select` host, because the floating label sits
 * over the host's centre while it is empty, so the click lands on the arrow at the right edge
 * instead - where a person would aim anyway.
 */
export function chooseOption(selector: string, label: string) {
  cy.getBySel(selector).click('right', { scrollBehavior: 'center' });
  cy.get('mat-option').contains(label).click();
}

/**
 * Fills one field of the log dialog.
 *
 * Clicked on its right edge first: an empty Material field's label sits over its centre until
 * something focuses it, and Cypress refuses to click through an element it does not own. An
 * interaction artifact - a person tapping that label focuses the input, as Material intends.
 */
export function enterMeasurement(type: string, value: string) {
  return cy.getBySel(dataCy.measurements.logDialog.field(type)).click('right').clear().type(value);
}

/**
 * Sets a native date input.
 *
 * Typing is not an option: a `type="date"` field takes keystrokes in the browser's display format,
 * so an ISO string lands as garbage. The value goes through the prototype setter Angular's
 * `valueAccessor` listens behind, taken from the *application's* realm rather than the spec's -
 * the runner and the app under test are different windows, and a setter from the wrong one does
 * not drive the app's bindings.
 */
export function setDateInput(selector: string, value: string) {
  return cy.getBySel(selector).then($input => {
    const input = $input[0] as HTMLInputElement;
    const win = input.ownerDocument.defaultView as Window & typeof globalThis;
    const setValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!;

    setValue.call(input, value);
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    input.dispatchEvent(new win.Event('change', { bubbles: true }));
  });
}

/** Saves the log dialog and waits for the write to land. */
export function saveLogDialog() {
  cy.getBySel(dataCy.measurements.logDialog.save).click();
  cy.wait('@saveMeasurements');
}

/** Saves the settings card and waits for the write to land. */
export function saveMeasurementSettings() {
  cy.getBySel(dataCy.measurements.settings.save).click({ scrollBehavior: 'center' });
  cy.wait('@saveProfile');
}

/** Reads a plotted series off the live chart, since a canvas has no text to assert against. */
export function plottedSeries(labelFragment: string, run: (lastValue: string) => void) {
  return cy.window().then((win: unknown) => {
    const chart = (win as ChartWindow).Chart.getChart(
      Cypress.$(`[data-cy="${dataCy.measurements.chartCanvas}"]`)[0] as HTMLCanvasElement
    );
    const series = chart.data.datasets.find(d => d.label.includes(labelFragment));

    expect(series, `${labelFragment} is plotted`).to.not.equal(undefined);
    run(series!.data[series!.data.length - 1].y.toFixed(1));
  });
}
