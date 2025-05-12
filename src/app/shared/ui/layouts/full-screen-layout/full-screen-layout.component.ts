import { CommonModule, Location } from '@angular/common';
import { Component, inject, Input , Signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule, Router } from '@angular/router';


@Component({
  selector: 'txg-full-screen-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule
  ],
  templateUrl: './full-screen-layout.component.html'
})
export class FullScreenLayoutComponent {
  @Input() title = '10xGains';
  @Input() backRoute?: string;
  @Input() loadingSignal?: Signal<boolean>;

  private location = inject(Location);
  private router = inject(Router);

  goBack(): void {
    if (this.backRoute) {
      this.router.navigate([this.backRoute]);
    } else {
      this.location.back();
    }
  }
}
