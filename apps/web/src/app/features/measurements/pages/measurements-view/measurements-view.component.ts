import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  MeasurementFiltersViewModel,
  MeasurementsViewModel,
} from '@features/measurements/models/measurements.viewmodel';
import { ChartChipRowComponent } from '@shared/ui/components/chart-chip-row/chart-chip-row.component';
import type { ChartChipViewModel } from '@shared/ui/components/chart-chip-row/chart-chip-row.component';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { formatDateRangeSummary } from '@shared/utils/dates/date-range-presets';
import { LogMeasurementDialogComponent } from './components/dialogs/log-measurement-dialog/log-measurement-dialog.component';
import { MeasurementFilterDialogComponent } from './components/dialogs/measurement-filter-dialog/measurement-filter-dialog.component';
import { MeasurementChartComponent } from './components/measurement-chart/measurement-chart.component';
import { MeasurementsViewFacade } from './measurements-view.facade';
import type { CreateMeasurementCommand } from '@txg/shared';

@Component({
  selector: 'txg-measurements-view',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MeasurementChartComponent,
    ChartChipRowComponent,
    NoticeComponent,
  ],
  templateUrl: './measurements-view.component.html',
  styleUrl: './measurements-view.component.scss',
  providers: [MeasurementsViewFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementsViewComponent implements OnInit {
  private readonly facade = inject(MeasurementsViewFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewModel: Signal<MeasurementsViewModel> = this.facade.viewModel;
  readonly filterSummary = computed(() => formatDateRangeSummary(this.viewModel().filters.dateRange));
  readonly selectedSeries = computed(() => this.viewModel().series.filter(s => s.selected));

  readonly chips = computed<ChartChipViewModel[]>(() => this.viewModel().series.map(s => ({
    id: s.id,
    label: s.shortLabel,
    colorToken: s.colorToken,
    selected: s.selected,
  })));
  readonly hasSelection = computed(() => this.selectedSeries().length > 0);

  ngOnInit(): void {
    this.facade.seedDateRange();
    this.facade.loadMeasurements();
  }

  onFilterClicked(): void {
    this.dialog.open(MeasurementFilterDialogComponent, {
      width: '450px',
      maxWidth: '92vw',
      data: { filters: this.viewModel().filters },
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef), filter((result): result is MeasurementFiltersViewModel => !!result))
      .subscribe(filters => this.facade.updateFilters(filters));
  }

  openLogDialog(): void {
    this.dialog.open(LogMeasurementDialogComponent, {
      width: '450px',
      maxWidth: '92vw',
      data: this.facade.buildLogDialogData(),
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef), filter((commands): commands is CreateMeasurementCommand[] => !!commands?.length))
      .subscribe(commands => this.save(commands, 'Measurements saved.'));
  }

  onSeriesToggled(seriesId: string): void {
    this.facade.toggleSeries(seriesId);
  }

  onRetryClicked(): void {
    this.facade.loadMeasurements();
  }

  onOpenSettingsClicked(): void {
    this.router.navigate(['/settings'], { queryParams: { view: 'measurements' } });
  }

  private save(commands: CreateMeasurementCommand[], successMessage: string): void {
    this.facade.saveMeasurements(commands)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.snackBar.open(successMessage, 'Close', { duration: 3000 }),
        error: (error: Error) => {
          console.error('Error saving measurements:', error);
          this.snackBar.open('Failed to save measurements. Please try again.', 'Close', { duration: 3000 });
        },
      });
  }
}
