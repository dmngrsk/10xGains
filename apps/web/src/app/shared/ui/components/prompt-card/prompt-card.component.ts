import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'txg-prompt-card',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './prompt-card.component.html',
  styleUrl: './prompt-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptCardComponent {
  @Input({ required: true }) titleText!: string;
  @Input() iconName?: string;
  @Input() buttonText?: string;
  @Input() buttonDataCy?: string;

  @Output() buttonClicked = new EventEmitter<void>();

  onButtonClicked(): void {
    this.buttonClicked.emit();
  }
}
