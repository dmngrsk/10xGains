import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, computed, Signal, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { HistoryFiltersViewModel, HistoryPageViewModel } from '@features/history/models/history-page.viewmodel';
import { SessionListComponent } from '@features/sessions/components/session-list/session-list.component';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { HistoryFilterDialogComponent } from './components/dialogs/history-filter-dialog/history-filter-dialog.component';
import { HistoryActionsBarComponent } from './components/history-actions-bar/history-actions-bar.component';
import { HistoryPageFacade } from './history-page.facade';

@Component({
  selector: 'txg-history-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    SessionListComponent,
    MatDialogModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
    HistoryActionsBarComponent,
    NoticeComponent,
  ],
  templateUrl: './history-page.component.html',
  providers: [HistoryPageFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent implements OnInit {
  private readonly facade = inject(HistoryPageFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewModel: Signal<HistoryPageViewModel> = this.facade.viewModel;
  readonly isLoading: Signal<boolean> = computed(() => this.pageRecentlyChanged() || this.viewModel().isLoading);

  readonly filterSpecified = computed(() => {
    const { selectedTrainingPlanId: _1, availableTrainingPlans: _2, pageSize: _3, pageSizeOptions: _4, ...filters } = this.viewModel().filters;
    return Object.values(filters).some(value => !!value);
  });

  readonly pageRecentlyChanged = signal(false);
  private readonly pageChangedSubject = new Subject<PageEvent>();

  ngOnInit(): void {
    this.facade.loadHistoryPageData();

    this.pageChangedSubject.pipe(
      tap(() => this.pageRecentlyChanged.set(true)),
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(event => {
      this.facade.updatePagination(event.pageIndex, event.pageSize);
      this.pageRecentlyChanged.set(false);
    });
  }

  onSessionNavigated(sessionId: string): void {
    this.router.navigate(['/sessions', sessionId]);
  }

  onPageChanged(event: PageEvent): void {
    this.pageChangedSubject.next(event);
  }

  onFilterButtonClicked(): void {
    const dialogData = {
      width: '450px',
      data: { filters: this.viewModel().filters },
      disableClose: true,
    };

    this.dialog.open(HistoryFilterDialogComponent, dialogData)
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef), filter(b => b))
      .subscribe((result: HistoryFiltersViewModel | undefined) => this.facade.updateFilters(result!));
  }

  onErrorButtonClicked(): void {
    this.facade.loadHistoryPageData();
  }
}
