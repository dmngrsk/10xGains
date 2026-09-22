import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MeasurementsViewComponent } from '@features/measurements/pages/measurements-view/measurements-view.component';
import { ProgressViewMode } from '@features/progress/models/progress-page.viewmodel';
import { LiftsViewComponent } from '@features/progress/pages/lifts-view/lifts-view.component';
import { LocalStorageService } from '@shared/services/local-storage.service';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { ProgressTabsComponent } from './components/progress-tabs/progress-tabs.component';

const VIEW_MODE_STORAGE_KEY = 'txg.progress.view-mode';
const VIEW_MODES: ProgressViewMode[] = ['lifts', 'body'];

@Component({
  selector: 'txg-progress-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    ProgressTabsComponent,
    LiftsViewComponent,
    MeasurementsViewComponent,
  ],
  templateUrl: './progress-page.component.html',
  styleUrl: './progress-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly localStorage = inject(LocalStorageService);

  readonly viewMode = signal<ProgressViewMode>('lifts');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const requested = params.has('view') ? params.get('view') : this.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    this.viewMode.set(VIEW_MODES.includes(requested as ProgressViewMode) ? requested as ProgressViewMode : 'lifts');
    this.syncViewQueryParams();
  }

  onViewModeChanged(mode: ProgressViewMode): void {
    this.viewMode.set(mode);
    this.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    this.syncViewQueryParams();
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
