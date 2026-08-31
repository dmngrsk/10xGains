import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, Signal, ViewChild, effect, signal, WritableSignal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NavigationStart, Router } from '@angular/router';
import { EnvironmentService } from '@shared/services/environment.service';
import { NavigationHistoryService } from '@shared/services/navigation-history.service';
import { ScrollPositionService } from '@shared/services/scroll-position.service';
import { BottomNavigationBarComponent } from './components/bottom-navigation-bar/bottom-navigation-bar.component';
import { TopNavigationBarComponent } from './components/top-navigation-bar/top-navigation-bar.component';

@Component({
  selector: 'txg-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    BottomNavigationBarComponent,
    TopNavigationBarComponent,
  ],
  templateUrl: './main-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  @Input() title: string = '10xGains';
  @Input() loadingSignal?: Signal<boolean>;
  @Input() backNavigation?: string | null;
  environmentService: EnvironmentService = inject(EnvironmentService);

  private router = inject(Router);
  private navigationHistory = inject(NavigationHistoryService);
  private scrollPositions = inject(ScrollPositionService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('scroller') set scrollerRef(ref: ElementRef<HTMLElement> | undefined) {
    this.scroller = ref?.nativeElement;
    this.restoreScrollPosition();
  }

  private scroller?: HTMLElement;

  private fullScreenLoaderCompleted: WritableSignal<boolean> = signal(false);

  readonly showFullScreenLoader: Signal<boolean> = computed(() => {
    return !!this.loadingSignal && this.loadingSignal() && !this.fullScreenLoaderCompleted();
  });

  readonly showProgressBar: Signal<boolean> = computed(() => {
    return !!this.loadingSignal && this.loadingSignal() && this.fullScreenLoaderCompleted();
  });

  readonly showContent: Signal<boolean> = computed(() => {
    return !this.loadingSignal || !this.loadingSignal();
  });

  readonly showBottomNavigation: Signal<boolean> = computed(() => {
    return this.backNavigation === undefined;
  });

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event instanceof NavigationStart && this.scroller) {
          this.scrollPositions.save(this.router.url, this.scroller.scrollTop);
        }
      });

    effect(() => {
      if (this.loadingSignal && !this.loadingSignal() && !this.fullScreenLoaderCompleted()) {
        this.fullScreenLoaderCompleted.set(true);
      }
    });
  }

  private restoreScrollPosition(): void {
    if (!this.scroller || !this.navigationHistory.isPopState) {
      return;
    }

    const top = this.scrollPositions.read(this.router.url);
    if (!top) {
      return;
    }

    requestAnimationFrame(() => this.scroller?.scrollTo({ top }));
  }
}
