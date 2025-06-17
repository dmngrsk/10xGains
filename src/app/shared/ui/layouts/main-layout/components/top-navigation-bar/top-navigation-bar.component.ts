import { Location, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input, Signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router } from '@angular/router';
import { EnvironmentService } from '@shared/services/environment.service';

@Component({
  selector: 'txg-top-navigation-bar',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatIconModule,
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

  readonly showBackNavigation: Signal<boolean> = computed(() => {
    return !!this.backNavigation;
  });

  readonly showEnvironmentInfo: Signal<boolean> = computed(() => {
    return !this.environmentService.production;
  });

  get buildName(): string {
    return this.environmentService.buildName;
  }

  get buildSha(): string {
    return this.environmentService.buildSha;
  }

  onNavigateBack(): void {
    if (this.backNavigation) {
      this.router.navigate([this.backNavigation]);
    } else {
      this.location.back();
    }
  }
}
