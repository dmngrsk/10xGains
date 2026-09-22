import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, computed, Signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionCardComponent } from '@features/sessions/components/session-card/session-card.component';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { SessionNotificationService } from '@shared/services/session-notification.service';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { PromptCardComponent } from '@shared/ui/components/prompt-card/prompt-card.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { HomePageFacade } from './home-page.facade';

@Component({
  selector: 'txg-home-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    SessionCardComponent,
    NoticeComponent,
    PromptCardComponent
  ],
  templateUrl: './home-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit {
  private readonly facade = inject(HomePageFacade);
  private readonly router = inject(Router);
  private readonly sessionNotifications = inject(SessionNotificationService);

  readonly viewModel = this.facade.viewModel;

  readonly isLoadingSignal: Signal<boolean> = computed(() => this.viewModel().isLoading);

  readonly activeSession: Signal<SessionCardViewModel | null> = computed(() => {
    const sessions = this.viewModel().sessions;
    return sessions && sessions.length > 0 ? sessions[0] : null;
  });

  readonly hasMeasurementPrompt: Signal<boolean> = computed(() => !!this.viewModel().measurementPrompt);

  readonly measurementPromptDays: Signal<string | null> = computed(() => {
    const days = this.viewModel().measurementPrompt?.daysSinceLast ?? null;
    return days === null ? null : `${days} ${days === 1 ? 'day' : 'days'}`;
  });

  readonly measurementPromptCadence: Signal<string> = computed(() => {
    const prompt = this.viewModel().measurementPrompt;
    return prompt ? describeCadence(prompt.frequencyDays) : '';
  });

  get greetingText(): string {
    return this.viewModel().name ? `Hi, ${this.viewModel().name}!` : 'Welcome to 10xGains!';
  }

  ngOnInit(): void {
    this.facade.loadHomePageData();
  }

  onPlanListNavigated(): void {
    this.router.navigate(['/plans']);
  }

  onSessionCreated(): void {
    this.facade.createSession();
  }

  onSessionNavigated(sessionId: string): void {
    void this.sessionNotifications.requestPermission();
    this.router.navigate(['/sessions', sessionId]);
  }

  onSessionAbandoned(): void {
    this.facade.abandonSession();
  }

  onMeasurementsNavigated(): void {
    this.router.navigate(['/progress'], { queryParams: { view: 'body' } });
  }
}

function describeCadence(frequencyDays: number): string {
  if (frequencyDays === 7) {
    return 'weekly';
  }
  if (frequencyDays === 14) {
    return 'fortnightly';
  }
  if (frequencyDays === 28) {
    return 'monthly';
  }
  return `every ${frequencyDays} days`;
}
