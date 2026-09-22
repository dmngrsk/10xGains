import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProgressFiltersViewModel, ProgressPageViewModel } from '@features/progress/models/progress-page.viewmodel';
import { ChartChipRowComponent } from '@shared/ui/components/chart-chip-row/chart-chip-row.component';
import type { ChartChipViewModel } from '@shared/ui/components/chart-chip-row/chart-chip-row.component';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { ProgressFilterDialogComponent } from './components/dialogs/progress-filter-dialog/progress-filter-dialog.component';
import { ProgressChartComponent } from './components/progress-chart/progress-chart.component';
import { LiftsViewFacade } from './lifts-view.facade';

@Component({
  selector: 'txg-lifts-view',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ChartChipRowComponent,
    NoticeComponent,
    ProgressChartComponent,
  ],
  templateUrl: './lifts-view.component.html',
  styleUrl: './lifts-view.component.scss',
  providers: [LiftsViewFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiftsViewComponent implements OnInit {
  private readonly facade = inject(LiftsViewFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewModel: Signal<ProgressPageViewModel> = this.facade.viewModel;

  readonly selectedSeries = computed(() => this.viewModel().series.filter(s => s.selected));

  readonly chips = computed<ChartChipViewModel[]>(() => this.viewModel().series.map(s => ({
    id: s.exerciseId,
    label: s.exerciseName,
    colorToken: s.colorToken,
    selected: s.selected,
  })));
  readonly isAllPlansSelected = computed(() => this.viewModel().filters.selectedPlanId === null);

  readonly noDataAtAll = computed(() => {
    const { series, filters } = this.viewModel();
    return series.length === 0
      && filters.selectedPlanId === null
      && filters.dateRange.dateFrom === null
      && filters.dateRange.dateTo === null;
  });

  ngOnInit(): void {
    this.facade.loadLiftsViewData();
  }

  onExerciseToggled(exerciseId: string): void {
    this.facade.toggleExercise(exerciseId);
  }

  onFilterButtonClicked(): void {
    const dialogData = {
      width: '450px',
      data: { filters: this.viewModel().filters },
      disableClose: true,
    };

    this.dialog.open(ProgressFilterDialogComponent, dialogData)
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef), filter(b => b))
      .subscribe((result: ProgressFiltersViewModel | undefined) => this.facade.updateFilters(result!));
  }

  onErrorButtonClicked(): void {
    this.facade.loadLiftsViewData();
  }

  onGoHomeClicked(): void {
    this.router.navigate(['/home']);
  }
}
