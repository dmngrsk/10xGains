import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'txg-notice',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './notice.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeComponent implements OnInit {
  @Input() iconName?: string;
  @Input() titleText?: string;
  @Input() errorText?: string;
  @Input() descriptionText?: string;
  @Input() buttonText?: string;
  @Input() isError: boolean = false;

  @Output() buttonClicked = new EventEmitter<void>();

  ngOnInit(): void {
    if (this.isError) {
      this.iconName = this.iconName ?? 'error_outline';
      this.titleText = this.titleText ?? 'An Error Occurred';
      this.descriptionText = this.descriptionText ?? 'Please try again later.';
    }
  }

  onButtonClicked(): void {
    this.buttonClicked.emit();
  }
}
