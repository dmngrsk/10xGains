import { CommonModule, Location, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Signal, effect, signal, WritableSignal, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';

@Component({
  selector: 'txg-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    BottomNavigationComponent
  ],
  templateUrl: './main-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  @Input() title: string = '10xGains';
  @Input() loadingSignal?: Signal<boolean>;
  @Input() backNavigation?: string | null;

  private router = inject(Router);
  private location = inject(Location);

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

  readonly showBackNavigation: Signal<boolean> = computed(() => {
    return this.backNavigation !== undefined;
  });

  readonly showBottomNavigation: Signal<boolean> = computed(() => {
    return this.backNavigation === undefined;
  });

  constructor() {
    effect(() => {
      if (this.loadingSignal && !this.loadingSignal() && !this.fullScreenLoaderCompleted()) {
        this.fullScreenLoaderCompleted.set(true);
      }
    });
  }

  onNavigateBack(): void {
    if (this.backNavigation) {
      this.router.navigate([this.backNavigation]);
    } else {
      this.location.back();
    }
  }
}
