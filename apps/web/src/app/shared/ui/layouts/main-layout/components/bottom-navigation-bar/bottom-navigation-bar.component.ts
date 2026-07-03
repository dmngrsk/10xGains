import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  label: string;
  icon: string;
  path?: string;
  disabled?: boolean;
  dataCy?: string;
}

@Component({
  selector: 'txg-bottom-navigation-bar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  templateUrl: './bottom-navigation-bar.component.html',
  styleUrls: ['./bottom-navigation-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BottomNavigationBarComponent {
  navLinks: NavLink[] = [
    { label: 'Home', icon: 'home', path: '/home', dataCy: 'bottom-navigation-home' },
    { label: 'Plans', icon: 'list_alt', path: '/plans', dataCy: 'bottom-navigation-plans' },
    { label: 'History', icon: 'history', path: '/history', dataCy: 'bottom-navigation-history' },
    { label: 'Progress', icon: 'stacked_line_chart', disabled: true, dataCy: 'bottom-navigation-progress' },
    { label: 'Settings', icon: 'settings', path: '/settings', dataCy: 'bottom-navigation-settings' }
  ];
}
