import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MeasurementsViewComponent } from '@features/measurements/pages/measurements-view/measurements-view.component';
import { ProgressFiltersViewModel, ProgressPageViewModel, ProgressViewMode } from '@features/progress/models/progress-page.viewmodel';
import { LocalStorageService } from '@shared/services/local-storage.service';
import { ChartChipRowComponent } from '@shared/ui/components/chart-chip-row/chart-chip-row.component';
import type { ChartChipViewModel } from '@shared/ui/components/chart-chip-row/chart-chip-row.component';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { formatDateRangeSummary } from '@shared/utils/dates/date-range-presets';
import { ProgressFilterDialogComponent } from './components/dialogs/progress-filter-dialog/progress-filter-dialog.component';
import { ProgressChartComponent } from './components/progress-chart/progress-chart.component';
import { ProgressTabsComponent } from './components/progress-tabs/progress-tabs.component';
import { ProgressPageFacade } from './progress-page.facade';

const VIEW_MODE_STORAGE_KEY = 'txg.progress.view-mode';
const VIEW_MODES: ProgressViewMode[] = ['lifts', 'body'];

@Component({
  selector: 'txg-progress-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    ChartChipRowComponent,
    ProgressChartComponent,
    ProgressTabsComponent,
    MeasurementsViewComponent,
    NoticeComponent,
  ],
  templateUrl: './progress-page.component.html',
  styleUrl: './progress-page.component.scss',
  providers: [ProgressPageFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressPageComponent implements OnInit {
  private readonly facade = inject(ProgressPageFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localStorage = inject(LocalStorageService);

  readonly viewMode = signal<ProgressViewMode>('lifts');

  readonly viewModel: Signal<ProgressPageViewModel> = this.facade.viewModel;
  readonly isLoadingSignal: Signal<boolean> = computed(() =>
    this.viewMode() === 'lifts' && this.viewModel().isLoading);

  readonly selectedSeries = computed(() => this.viewModel().series.filter(s => s.selected));

  readonly chips = computed<ChartChipViewModel[]>(() => this.viewModel().series.map(s => ({
    id: s.exerciseId,
    label: s.exerciseName,
    colorToken: s.colorToken,
    selected: s.selected,
  })));
  readonly isAllPlansSelected = computed(() => this.viewModel().filters.selectedPlanId === null);

  readonly filterPlanName = computed(() => {
    const filters = this.viewModel().filters;
    return filters.selectedPlanId
      ? filters.availablePlans.find(p => p.id === filters.selectedPlanId)?.name ?? 'Unknown plan'
      : 'All plans';
  });

  readonly filterDateRange = computed(() => formatDateRangeSummary(this.viewModel().filters.dateRange));

  readonly noDataAtAll = computed(() => {
    const { series, filters } = this.viewModel();
    return series.length === 0
      && filters.selectedPlanId === null
      && filters.dateRange.dateFrom === null
      && filters.dateRange.dateTo === null;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const requested = params.has('view') ? params.get('view') : this.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    this.viewMode.set(VIEW_MODES.includes(requested as ProgressViewMode) ? requested as ProgressViewMode : 'lifts');
    this.syncViewQueryParams();

    this.facade.loadProgressPageData();
  }

  onViewModeChanged(mode: ProgressViewMode): void {
    this.viewMode.set(mode);
    this.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    this.syncViewQueryParams();
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

  private syncViewQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: this.viewMode() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
