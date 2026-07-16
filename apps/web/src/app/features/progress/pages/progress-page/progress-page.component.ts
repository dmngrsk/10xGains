import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProgressFiltersViewModel, ProgressPageViewModel } from '@features/progress/models/progress-page.viewmodel';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { formatDateRangeSummary } from '@shared/utils/dates/date-range-presets';
import { ProgressFilterDialogComponent } from './components/dialogs/progress-filter-dialog/progress-filter-dialog.component';
import { ExerciseChipRowComponent } from './components/exercise-chip-row/exercise-chip-row.component';
import { ProgressActionsBarComponent } from './components/progress-actions-bar/progress-actions-bar.component';
import { ProgressChartComponent } from './components/progress-chart/progress-chart.component';
import { ProgressPageFacade } from './progress-page.facade';

@Component({
  selector: 'txg-progress-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatButtonModule,
    ExerciseChipRowComponent,
    ProgressChartComponent,
    ProgressActionsBarComponent,
    NoticeComponent,
  ],
  templateUrl: './progress-page.component.html',
  providers: [ProgressPageFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressPageComponent implements OnInit {
  private readonly facade = inject(ProgressPageFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewModel: Signal<ProgressPageViewModel> = this.facade.viewModel;
  readonly isLoadingSignal: Signal<boolean> = computed(() => this.viewModel().isLoading);

  readonly selectedSeries = computed(() => this.viewModel().series.filter(s => s.selected));
  readonly isAllPlansSelected = computed(() => this.viewModel().filters.selectedPlanId === null);

  readonly filterSummary = computed(() => {
    const filters = this.viewModel().filters;
    const planName = filters.selectedPlanId
      ? filters.availablePlans.find(p => p.id === filters.selectedPlanId)?.name ?? 'Unknown plan'
      : 'All plans';
    return `${planName} – ${formatDateRangeSummary(filters.dateRange)}`;
  });

  readonly noDataAtAll = computed(() => {
    const { series, filters } = this.viewModel();
    return series.length === 0
      && filters.selectedPlanId === null
      && filters.dateRange.dateFrom === null
      && filters.dateRange.dateTo === null;
  });

  ngOnInit(): void {
    this.facade.loadProgressPageData();
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
    this.facade.loadProgressPageData();
  }

  onGoHomeClicked(): void {
    this.router.navigate(['/home']);
  }
}
