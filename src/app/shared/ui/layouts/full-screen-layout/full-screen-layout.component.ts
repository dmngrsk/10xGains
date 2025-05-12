import { Component, inject, Input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Signal } from '@angular/core';

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
