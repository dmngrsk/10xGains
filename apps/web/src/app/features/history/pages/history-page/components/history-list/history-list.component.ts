import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SessionListComponent } from '@features/sessions/components/session-list/session-list.component';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';

@Component({
  selector: 'txg-history-list',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    SessionListComponent,
    NoticeComponent,
  ],
  templateUrl: './history-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryListComponent implements AfterViewInit, OnDestroy {
  @Input() sessions: SessionCardViewModel[] = [];
  @Input() hasMore = false;
  @Input() isLoadingMore = false;

  @Output() sessionNavigated = new EventEmitter<string>();
  @Output() notesClicked = new EventEmitter<string>();
  @Output() editFiltersClicked = new EventEmitter<void>();
  @Output() loadMore = new EventEmitter<void>();

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLElement>;

  private intersectionObserver?: IntersectionObserver;

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  onSessionNavigated(sessionId: string): void {
    this.sessionNavigated.emit(sessionId);
  }

  onNotesClicked(sessionId: string): void {
    this.notesClicked.emit(sessionId);
  }

  onEditFiltersClicked(): void {
    this.editFiltersClicked.emit();
  }

  private setupIntersectionObserver(): void {
    // The sentinel is only rendered once there is a page left to fetch, so it comes and goes
    // with the list; observing the host keeps one observer across those appearances.
    this.intersectionObserver?.disconnect();

    this.intersectionObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMore && !this.isLoadingMore) {
        this.loadMore.emit();
      }
    }, { rootMargin: '200px' });

    if (this.sentinel?.nativeElement) {
      this.intersectionObserver.observe(this.sentinel.nativeElement);
      return;
    }

    setTimeout(() => this.setupIntersectionObserver(), 100);
  }
}
