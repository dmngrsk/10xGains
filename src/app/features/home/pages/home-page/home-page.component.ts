import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, computed, Signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { SessionCardComponent } from '@features/sessions/components/session-card/session-card.component';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { CreateSessionCardComponent } from './create-session-card/create-session-card.component';
import { HomePageFacade } from './home-page.facade';

@Component({
  selector: 'txg-home-page',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    MainLayoutComponent,
    CreateSessionCardComponent,
    SessionCardComponent,
  ],
  templateUrl: './home-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit {
  private readonly homeFacade = inject(HomePageFacade);
  private readonly router = inject(Router);

  readonly viewModel = this.homeFacade.viewModel;
  readonly isLoadingSignal: Signal<boolean> = computed(() => this.viewModel().isLoading);

  readonly activeSession: Signal<SessionCardViewModel | null> = computed(() => {
    const sessions = this.viewModel().sessions;
    return sessions && sessions.length > 0 ? sessions[0] : null;
  });

  get greetingText(): string {
    return this.viewModel().name ? `Hi, ${this.viewModel().name}!` : 'Welcome to 10xGains!';
  }

  ngOnInit(): void {
    this.homeFacade.loadHomePageData();
  }

  onSessionCreated(): void {
    this.homeFacade.createSession();
  }

  onSessionNavigated(sessionId: string): void {
    this.router.navigate(['/sessions', sessionId]);
  }
}
