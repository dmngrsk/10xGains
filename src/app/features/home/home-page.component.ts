import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { UserInfoComponent } from './components/user-info.component';

@Component({
  selector: 'txg-home-page',
  standalone: true,
  imports: [UserInfoComponent, MatIconModule, MatButtonModule, RouterModule],
  template: `
    <div class="container mx-auto p-4">
      <h1 class="text-2xl mb-4">10xGains</h1>
      <txg-user-info></txg-user-info>
      <a [routerLink]="['/plans']">
        <button mat-raised-button color="primary">
          <mat-icon>list</mat-icon>
          Lista planów
        </button>
      </a>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class HomePageComponent {}
