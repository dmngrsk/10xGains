import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
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
export class HistoryListComponent implements OnDestroy {
  @Input() sessions: SessionCardViewModel[] = [];
  @Input() hasMore = false;
  @Input() isLoadingMore = false;

  @Output() sessionNavigated = new EventEmitter<string>();
  @Output() notesClicked = new EventEmitter<string>();
  @Output() editFiltersClicked = new EventEmitter<void>();
  @Output() loadMore = new EventEmitter<void>();

  private intersectionObserver?: IntersectionObserver;
  private observedSentinel?: HTMLElement;

  @ViewChild('sentinel') set sentinel(sentinel: ElementRef<HTMLElement> | undefined) {
    const element = sentinel?.nativeElement;
    if (element === this.observedSentinel) {
      return;
    }

    if (this.observedSentinel) {
      this.intersectionObserver?.unobserve(this.observedSentinel);
    }

    this.observedSentinel = element;

    if (element) {
      this.observer().observe(element);
    }
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

  private observer(): IntersectionObserver {
    this.intersectionObserver ??= new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMore && !this.isLoadingMore) {
        this.loadMore.emit();
      }
    }, { rootMargin: '200px' });

    return this.intersectionObserver;
  }
}
