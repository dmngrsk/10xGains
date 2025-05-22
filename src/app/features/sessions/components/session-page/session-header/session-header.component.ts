import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SessionMetadataViewModel } from '../../../models/session-view.models';

@Component({
  selector: 'txg-session-header',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
  ],
  templateUrl: './session-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionHeaderComponent {
  @Input() metadata!: SessionMetadataViewModel;

  get dateText(): string | null {
    if (!this.metadata.date) return null;
    try {
      return new Date(this.metadata.date).toLocaleDateString();
    } catch {
      return this.metadata.date;
    }
  }

  get statusText(): string | null {
    if (!this.metadata.status) return null;
    return this.metadata.status.replace('_', ' ');
  }
}
