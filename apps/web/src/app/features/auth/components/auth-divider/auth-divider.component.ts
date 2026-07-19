import { Component, Input } from '@angular/core';

@Component({
  selector: 'txg-auth-divider',
  standalone: true,
  templateUrl: './auth-divider.component.html'
})
export class AuthDividerComponent {
  @Input() label = 'or';
}
