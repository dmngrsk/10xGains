import { Location, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input, Signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { EnvironmentService } from '@shared/services/environment.service';
import { NavigationHistoryService } from '@shared/services/navigation-history.service';

@Component({
  selector: 'txg-top-navigation-bar',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    NgOptimizedImage
  ],
  templateUrl: './top-navigation-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopNavigationBarComponent {
  @Input() title: string = '10xGains';
  @Input() backNavigation?: string | null;

  private router = inject(Router);
  private location = inject(Location);
  private environmentService: EnvironmentService = inject(EnvironmentService);
  private navigationHistory = inject(NavigationHistoryService);

  readonly showBackNavigation: Signal<boolean> = computed(() => {
    return !!this.backNavigation;
  });

  readonly showEnvironmentInfo: Signal<boolean> = computed(() => {
    return !this.environmentService.production;
  });

  get buildName(): string {
    return this.environmentService.buildName;
  }

  get buildVersion(): string {
    return this.environmentService.buildVersion;
  }

  onNavigateBack(): void {
    if (this.navigationHistory.canGoBack) {
      this.location.back();
      return;
    }

    if (this.backNavigation) {
      this.router.navigate([this.backNavigation]);
      return;
    }

    this.location.back();
  }
}
