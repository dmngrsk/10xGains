import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { LongPressDirective } from '@shared/utils/directives/long-press.directive';
import { SessionWarmupSetViewModel } from '../../../../models/session-page.viewmodel';

@Component({
  selector: 'txg-session-warmup-bubble',
  standalone: true,
  imports: [
    MatButtonModule,
    LongPressDirective,
  ],
  templateUrl: './session-warmup-bubble.component.html',
  styleUrl: './session-warmup-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionWarmupBubbleComponent {
  @Input() warmupSet?: SessionWarmupSetViewModel;
  @Input() isToggle: boolean = false;

  @Output() bubbleClicked = new EventEmitter<void>();

  onBubbleClicked(): void {
    this.bubbleClicked.emit();
  }
}
