import { Component, inject, Input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'txg-full-screen-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './full-screen-layout.component.html'
})
export class FullScreenLayoutComponent {
  @Input() title = '10xGains';

  private location = inject(Location);

  goBack(): void {
    this.location.back();
  }
}
