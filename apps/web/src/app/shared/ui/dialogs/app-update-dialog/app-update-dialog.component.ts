import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'txg-app-update-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './app-update-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppUpdateDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<AppUpdateDialogComponent, boolean>>(MatDialogRef);

  onReload(): void {
    this.dialogRef.close(true);
  }
}
