import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Signal, effect, signal, WritableSignal, computed, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { EnvironmentService } from '@shared/services/environment.service';
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
