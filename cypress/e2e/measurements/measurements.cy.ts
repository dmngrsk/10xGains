import {
  chooseOption,
  enterMeasurement,
  openLogDialog,
  openMeasurementsSettings,
  openMeasurementsTab,
  plottedSeries,
  readBodyComposition,
  readMeasurements,
  saveLogDialog,
  saveMeasurementSettings,
  seedMeasurements,
  setBodyComposition,
  setDateInput,
} from '../../support/helpers/measurements.helpers';
import { dataCy } from '../../support/selectors';
import { JP_EXAMPLE, MANUAL_BODY_FAT, NAVY_EXAMPLE, calendarDate } from '../../support/test-data/measurements';

describe('Measurement Tracking', { tags: ['@measurements'] }, () => {
  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '**/api/measurements').as('saveMeasurements');
    cy.intercept('PUT', '**/api/profiles/*').as('saveProfile');
  });

  afterEach(() => {
    cy.teardown();
  });

  describe('when viewing the body tab with nothing logged yet', () => {
    beforeEach(() => {
      openMeasurementsTab();
    });

    it('allows a user to record a round and see it charted', { tags: ['MEAS-01'] }, () => {
      // The empty state is the way in: there is no chart to log from yet.
      openLogDialog({ fromEmptyState: true });
      enterMeasurement('BODY_WEIGHT', '79.1');
      saveLogDialog();

      cy.getBySel(dataCy.measurements.chartCanvas).should('be.visible');
      cy.getBySel(dataCy.measurements.chip('BODY_WEIGHT')).should('contain.text', 'Weight');

      readMeasurements(rows => {
        expect(rows).to.have.length(1);
        expect(rows[0]).to.include({ type: 'BODY_WEIGHT', value: 79.1, measured_on: calendarDate() });
      });
    });
  });

  describe('when viewing the body tab with rounds already logged', () => {
    beforeEach(() => {
      seedMeasurements([
        { measured_on: calendarDate(7), type: 'BODY_WEIGHT', value: 80.5 },
        ...['BODY_WEIGHT', 'NECK', 'CHEST', 'WAIST', 'HIPS', 'THIGH', 'CALF', 'BICEPS', 'FOREARM']
          .map(type => ({ measured_on: calendarDate(1), type, value: 40 })),
      ]);
      openMeasurementsTab();
      cy.getBySel(dataCy.measurements.content).should('be.visible');
    });

    describe('correcting what was logged', () => {
      // The schema holds one row per type per day, so re-logging a type is an edit. With the list
      // view gone this is also the only way to correct a reading.
      it('edits the day rather than appending when a type is logged twice', { tags: ['MEAS-02'] }, () => {
        openLogDialog();
        setDateInput(dataCy.measurements.logDialog.date, calendarDate(7));
        enterMeasurement('BODY_WEIGHT', '78.4');
        saveLogDialog();

        readMeasurements(rows => {
          const onThatDay = rows.filter(r => r.measured_on === calendarDate(7) && r.type === 'BODY_WEIGHT');
          expect(onThatDay, 'still one body weight row for the day').to.have.length(1);
          expect(onThatDay[0].value).to.equal(78.4);
        });
      });
    });

    describe('choosing what the chart shows', () => {
      /**
       * The chip cannot be turned off, and must not *look* turned off either.
       *
       * Material flips the chip's own state before the handler runs, and a model that refuses the
       * change will not flip it back - the binding sees the same value and writes nothing. Only a
       * real chip can prove the restore works, which is why this is here rather than in a unit test.
       */
      it('refuses to turn off the last selected chip', { tags: ['MEAS-03'] }, () => {
        // Body weight is the only series selected by default, so one tap would empty the chart.
        cy.getBySel(dataCy.measurements.chip('BODY_WEIGHT'))
          .should('have.class', 'mat-mdc-chip-selected')
          .click();

        cy.getBySel(dataCy.measurements.chip('BODY_WEIGHT'))
          .should('have.class', 'mat-mdc-chip-selected');
        cy.getBySel(dataCy.measurements.chartCanvas).should('be.visible');
      });

      // Three rows of chips have to come out of the chart's space, not the page's. Layout, so it
      // cannot be asserted anywhere but in a browser.
      it('fits the chart, the chips and the page into one viewport', { tags: ['MEAS-04'] }, () => {
        cy.getBySel(dataCy.measurements.chipRow).should($row => {
          const el = $row[0];
          expect(el.scrollHeight, 'the chips overflow downwards').to.be.greaterThan(el.clientHeight);
          expect(el.scrollWidth, 'and never sideways').to.equal(el.clientWidth);
        });

        // The layout scrolls an inner column rather than the document, so that is what must fit.
        cy.get('.txg-scroll-gutter').should($scroller => {
          const el = $scroller[0];
          expect(el.scrollHeight, 'the page column fits its viewport').to.be.at.most(el.clientHeight + 2);
        });

        // The chart claims the leftover height, so it is the thing that can grow into the chips.
        // Asserted on the live boxes rather than a screenshot: a capture resizes the viewport, and
        // Chart.js re-renders a frame later, which makes every screenshot of this look overlapped.
        cy.getBySel(dataCy.measurements.chipRow).then($row => {
          cy.get('canvas').should($canvas => {
            const chartBottom = $canvas[0].getBoundingClientRect().bottom;
            const chipsTop = $row[0].getBoundingClientRect().top;

            expect(chartBottom, 'the chart stops above the chip row').to.be.at.most(chipsTop);
          });
        });
      });
    });
  });

  describe('when viewing the measurements settings tab', () => {
    beforeEach(() => {
      openMeasurementsSettings();
    });

    /**
     * The round trip, not the form.
     *
     * A settings field that never persisted once shipped green, because the test read the form
     * back instead of the database: Zod strips unknown keys, so the API dropped the field in
     * silence. This reloads and reads the row, which is the only assertion that would have caught
     * it. Which boxes the method ticks is component state and is unit-tested.
     */
    it('round-trips the body-composition settings through the database', { tags: ['MEAS-05'] }, () => {
      // Method first: the sex field is hidden until a formula that reads it is chosen.
      chooseOption(dataCy.measurements.settings.method, 'US Navy');
      chooseOption(dataCy.measurements.settings.variant, 'Male');
      cy.getBySel(dataCy.measurements.settings.frequency('weekly')).click({ scrollBehavior: 'center' });

      // Tapping the chosen cadence again means nothing, and must not leave none chosen: Material
      // deselects the chip, and an unchanged model will not put it back.
      cy.getBySel(dataCy.measurements.settings.frequency('weekly'))
        .click({ scrollBehavior: 'center' })
        .should('have.class', 'mat-mdc-chip-selected');

      saveMeasurementSettings();

      cy.reload();
      cy.getBySel(dataCy.measurements.settings.card).should('be.visible');
      cy.getBySel(dataCy.measurements.settings.track('WAIST'))
        .should('have.class', 'mat-mdc-checkbox-checked');

      readBodyComposition(profile => {
        expect(profile.body_fat_method, 'the method reached the database').to.equal('NAVY');
        expect(profile.sex, 'and so did the formula variant').to.equal('MALE');
        expect(profile.measurement_frequency_days, 'and so did the cadence').to.equal(7);
        expect(profile.tracked_measurement_types, "and so did the method's own inputs")
          .to.include.members(['NECK', 'WAIST']);
      });
    });
  });

  // The published worked examples, asserted on the plotted value. Each method is here because
  // they reach the chart by different routes: tape measurements straight from the regression,
  // calipers through a density conversion and an age term, and a manual figure through no formula
  // at all.
  describe('when a body-fat method is configured', () => {
    describe('the US Navy method', () => {
      it('plots the worked example end to end', { tags: ['MEAS-06'] }, () => {
        setBodyComposition({
          body_fat_method: 'NAVY',
          sex: 'MALE',
          height_cm: NAVY_EXAMPLE.height,
        });
        seedMeasurements([
          { measured_on: calendarDate(1), type: 'NECK', value: NAVY_EXAMPLE.neck },
          { measured_on: calendarDate(1), type: 'WAIST', value: NAVY_EXAMPLE.waist },
        ]);
        openMeasurementsTab();

        cy.getBySel(dataCy.measurements.estimateBlocked).should('not.exist');
        // Not clicked: the chosen method's estimate is selected by default, so a click turns it off.
        cy.getBySel(dataCy.measurements.chip('estimate-NAVY'))
          .should('have.class', 'mat-mdc-chip-selected');
        cy.getBySel(dataCy.measurements.chartCanvas).should('be.visible');

        plottedSeries('Navy', value => expect(value).to.equal(NAVY_EXAMPLE.expected));
      });

      /**
       * Height is the one formula term that is a profile setting rather than a round of measuring,
       * so it reaches the estimator by a different path than everything else on the chart. This
       * walks that path: blocked, set in Settings, unblocked.
       */
      it('builds the estimate once a height is saved in Settings', { tags: ['MEAS-07'] }, () => {
        setBodyComposition({ body_fat_method: 'NAVY', sex: 'MALE' });
        seedMeasurements([
          { measured_on: calendarDate(1), type: 'NECK', value: NAVY_EXAMPLE.neck },
          { measured_on: calendarDate(1), type: 'WAIST', value: NAVY_EXAMPLE.waist },
        ]);

        openMeasurementsTab();
        cy.getBySel(dataCy.measurements.estimateBlocked).should('contain.text', 'height');

        // The height field appears only for the method that reads it.
        openMeasurementsSettings();
        cy.getBySel(dataCy.measurements.settings.height).clear().type(`${NAVY_EXAMPLE.height}`);
        saveMeasurementSettings();

        readBodyComposition(profile => {
          expect(profile.height_cm, 'height is a profile column, not a measurement row')
            .to.equal(NAVY_EXAMPLE.height);
        });
        readMeasurements(rows => {
          expect(rows.map(r => r.type), 'and no row was written for it')
            .to.have.members(['NECK', 'WAIST']);
        });

        openMeasurementsTab();
        cy.getBySel(dataCy.measurements.estimateBlocked).should('not.exist');
        plottedSeries('Navy', value => expect(value).to.equal(NAVY_EXAMPLE.expected));
      });
    });

    describe('the Jackson-Pollock methods', () => {
      it('plots the worked example end to end', { tags: ['MEAS-08'] }, () => {
        setBodyComposition({
          body_fat_method: 'JP7',
          sex: 'MALE',
          date_of_birth: JP_EXAMPLE.dateOfBirth,
        });
        seedMeasurements(
          JP_EXAMPLE.sites.map(([type, value]) => ({ measured_on: calendarDate(1), type, value }))
        );
        openMeasurementsTab();

        cy.getBySel(dataCy.measurements.estimateBlocked).should('not.exist');
        cy.getBySel(dataCy.measurements.chartCanvas).should('be.visible');

        plottedSeries('Jackson-Pollock 7', value => expect(value).to.equal(JP_EXAMPLE.expected));
      });
    });

    describe('the manual method', () => {
      // The one case where the number on the chart came out of the database rather than a formula.
      it('charts a body-fat figure typed in by hand', { tags: ['MEAS-09'] }, () => {
        setBodyComposition({
          body_fat_method: 'MANUAL',
          tracked_measurement_types: ['BODY_WEIGHT', 'BODY_FAT'],
        });
        openMeasurementsTab();

        openLogDialog({ fromEmptyState: true });
        enterMeasurement('BODY_FAT', MANUAL_BODY_FAT);
        saveLogDialog();

        cy.getBySel(dataCy.measurements.estimateBlocked).should('not.exist');
        cy.getBySel(dataCy.measurements.chip('BODY_FAT')).should('have.class', 'mat-mdc-chip-selected');

        plottedSeries('Body fat', value => expect(value).to.equal(MANUAL_BODY_FAT));

        readMeasurements(rows => {
          const bodyFat = rows.filter(r => r.type === 'BODY_FAT');
          expect(bodyFat, 'the figure was stored as a reading').to.have.length(1);
          expect(bodyFat[0].value).to.equal(Number(MANUAL_BODY_FAT));
        });
      });
    });
  });

  describe('when a round is overdue', () => {
    // Whole days, not elapsed hours: a round logged eight days ago is overdue on a weekly cadence
    // whatever the clock said at the time.
    it('prompts on the home page and leads to the body tab', { tags: ['MEAS-10'] }, () => {
      setBodyComposition({ measurement_frequency_days: 7 });
      seedMeasurements([{ measured_on: calendarDate(8), type: 'BODY_WEIGHT', value: 79.1 }]);

      cy.visit('/home');

      cy.getBySel(dataCy.home.measurementPrompt)
        .should('be.visible')
        .and('contain.text', '8 days');

      cy.getBySel(dataCy.home.measurementPromptButton).click();

      cy.url().should('include', 'view=body');
      cy.getBySel(dataCy.progress.measurementsView).should('exist');
    });
  });
});
