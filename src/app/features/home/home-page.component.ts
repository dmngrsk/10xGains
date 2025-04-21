import { Component } from '@angular/core';
import { UserInfoComponent } from './components/user-info.component';

@Component({
  selector: 'txg-home-page',
  standalone: true,
  imports: [UserInfoComponent],
  template: `
    <div class="container mx-auto p-4">
      <h1 class="text-2xl mb-4">10xGains</h1>
      <txg-user-info></txg-user-info>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class HomePageComponent {}
