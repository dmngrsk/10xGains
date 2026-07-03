import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SessionMetadataViewModel } from '../../../../models/session-page.viewmodel';

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
}
