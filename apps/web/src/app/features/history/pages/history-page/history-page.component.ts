import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, computed, Signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { format } from 'date-fns';
import { filter, switchMap } from 'rxjs/operators';
import { HistoryFiltersViewModel, HistoryPageViewModel, HistoryViewMode } from '@features/history/models/history-page.viewmodel';
import { SessionNotesDialogComponent, SessionNotesDialogData, SessionNotesDialogResult } from '@features/sessions/components/dialogs/session-notes-dialog/session-notes-dialog.component';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { LocalStorageService } from '@shared/services/local-storage.service';
import { NavigationHistoryService } from '@shared/services/navigation-history.service';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { HistoryCalendarFilterResult, HistoryFilterDialogComponent, HistoryFilterDialogData, HistoryFilterDialogResult } from './components/dialogs/history-filter-dialog/history-filter-dialog.component';
import { SessionPickerDialogComponent, SessionPickerDialogData } from './components/dialogs/session-picker-dialog/session-picker-dialog.component';
import { HistoryCalendarComponent } from './components/history-calendar/history-calendar.component';
import { HistoryListComponent } from './components/history-list/history-list.component';
import { HistoryTabsComponent } from './components/history-tabs/history-tabs.component';
import { HistoryPageFacade } from './history-page.facade';

const VIEW_MODE_STORAGE_KEY = 'txg.history.view-mode';
const NOTES_ONLY_STORAGE_KEY = 'txg.history.notes-only';
const VIEW_MODES: HistoryViewMode[] = ['list', 'calendar'];
const MONTH_PARAM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

@Component({
  selector: 'txg-history-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
    HistoryCalendarComponent,
    HistoryListComponent,
    HistoryTabsComponent,
    NoticeComponent,
  ],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent implements OnInit {
  private readonly facade = inject(HistoryPageFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localStorage = inject(LocalStorageService);
  private readonly navigationHistory = inject(NavigationHistoryService);

  readonly viewModel: Signal<HistoryPageViewModel> = this.facade.viewModel;
  readonly isLoadingSignal: Signal<boolean> = computed(() => this.viewModel().isLoading);
  readonly listedSessions: Signal<SessionCardViewModel[]> = computed(() =>
    this.viewModel().notesOnly ? this.viewModel().noteSessions : this.viewModel().sessions);
  // The notes are swept in full rather than paged, so there is never another page of them to fetch.
  readonly hasMoreSessions: Signal<boolean> = computed(() =>
    !this.viewModel().notesOnly && this.viewModel().sessions.length < this.viewModel().totalSessions);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const requestedViewMode = params.has('view') ? params.get('view') : this.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    // The first tab of the strip, so a first visit opens where the strip says it starts.
    const viewMode: HistoryViewMode = VIEW_MODES.includes(requestedViewMode as HistoryViewMode)
      ? requestedViewMode as HistoryViewMode
      : 'list';

    const monthParam = params.get('month');
    const month = monthParam && MONTH_PARAM_PATTERN.test(monthParam) ? monthParam : format(new Date(), 'yyyy-MM');

    const requestedNotesOnly = params.has('notes') ? params.get('notes') : this.localStorage.getItem(NOTES_ONLY_STORAGE_KEY);
    const notesOnly = requestedNotesOnly === '1';

    this.facade.seedViewState(viewMode, month, notesOnly);
    this.syncViewQueryParams();

    if (this.navigationHistory.isPopState && this.facade.isLoaded()) {
      return;
    }

    this.facade.loadHistoryPageData();
  }

  onSessionNavigated(sessionId: string): void {
    this.router.navigate(['/sessions', sessionId]);
  }

  onNotesClicked(sessionId: string): void {
    const session = this.listedSessions().find(s => s.id === sessionId);
    if (!session) return;

    const dialogData: SessionNotesDialogData = {
      sessionNotes: session.notes,
    };

    this.dialog
      .open(SessionNotesDialogComponent, { width: '400px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((result): result is SessionNotesDialogResult => !!result && result.sessionNotes !== session.notes),
        switchMap(result => this.facade.saveSessionNotes(sessionId, result.sessionNotes))
      )
      .subscribe(success => {
        if (success) {
          this.snackBar.open('Notes saved successfully.', 'Close', { duration: 2000 });
        } else {
          this.snackBar.open('Failed to save notes. Please try again.', 'Close', { duration: 3000 });
        }
      });
  }

  onLoadMoreSessions(): void {
    this.facade.loadSessions(true);
  }

  onViewModeChanged(mode: HistoryViewMode): void {
    this.facade.setViewMode(mode);
    this.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    this.syncViewQueryParams();
  }

  onNotesOnlyToggled(): void {
    const notesOnly = !this.viewModel().notesOnly;

    this.facade.setNotesOnly(notesOnly);
    this.localStorage.setItem(NOTES_ONLY_STORAGE_KEY, notesOnly ? '1' : '0');
    this.syncViewQueryParams();
  }

  onMonthChanged(month: string): void {
    this.facade.setCalendarMonth(month);
    this.syncViewQueryParams();
  }

  onDayClicked(sessions: SessionCardViewModel[]): void {
    if (sessions.length === 0) {
      return;
    }

    if (sessions.length === 1) {
      this.onSessionNavigated(sessions[0].id);
      return;
    }

    const dialogData: SessionPickerDialogData = {
      date: sessions[0].sessionDate!,
      sessions,
    };

    this.dialog
      .open(SessionPickerDialogComponent, { width: '400px', data: dialogData })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((sessionId): sessionId is string => !!sessionId)
      )
      .subscribe(sessionId => this.onSessionNavigated(sessionId));
  }

  onFilterButtonClicked(): void {
    const { viewMode, filters, calendarMonth } = this.viewModel();

    if (viewMode === 'calendar') {
      this.openFilterDialog({ mode: 'calendar', selectedPlanId: filters.selectedPlanId, month: calendarMonth, availablePlans: filters.availablePlans ?? [] })
        .subscribe(result => {
          const calendarResult = result as HistoryCalendarFilterResult;
          this.facade.updateCalendarFilters(calendarResult.selectedPlanId, calendarResult.month);
          this.syncViewQueryParams();
        });
    }

    if (viewMode === 'list') {
      this.openFilterDialog({ mode: 'list', filters })
        .subscribe(result => this.facade.updateFilters(result as HistoryFiltersViewModel));
    }
  }

  onErrorButtonClicked(): void {
    this.facade.loadHistoryPageData();
  }

  private openFilterDialog(data: HistoryFilterDialogData): Observable<HistoryFilterDialogResult> {
    return this.dialog.open(HistoryFilterDialogComponent, { width: '450px', data, disableClose: true })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef), filter((result): result is HistoryFilterDialogResult => !!result));
  }

  private syncViewQueryParams(): void {
    const { viewMode, calendarMonth, notesOnly } = this.viewModel();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: viewMode,
        month: viewMode === 'calendar' ? calendarMonth : null,
        notes: viewMode === 'list' && notesOnly ? '1' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
