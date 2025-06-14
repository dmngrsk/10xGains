import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { UpsertUserProfileCommand } from '@shared/api/api.types';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';
import { ProfileSettingsCardViewModel } from '../../../../models/settings-page.viewmodel';

@Component({
  selector: 'txg-profile-settings-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './profile-settings-card.component.html'
})
export class ProfileSettingsCardComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() profile!: ProfileSettingsCardViewModel;
  @Output() profileSaved = new EventEmitter<UpsertUserProfileCommand | null>();

  profileForm!: FormGroup;

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  ngOnInit(): void {
    this.profileForm = this.fb.group({
      firstName: [this.profile?.firstName || '', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: [{ value: this.profile?.email || '', disabled: true }],
      aiSuggestionsRemaining: [{ value: this.profile?.aiSuggestionsRemaining || 0, disabled: true }]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile'] && this.profileForm) {
      this.profileForm.get('firstName')?.setValue(this.profile.firstName || '', { emitEvent: false });
      this.profileForm.get('email')?.setValue(this.profile.email || '', { emitEvent: false });
      this.profileForm.get('aiSuggestionsRemaining')?.setValue(this.profile.aiSuggestionsRemaining || 0, { emitEvent: false });
      this.profileForm.markAsPristine();
    }
  }

  onProfileSaved(): void {
    if (this.profileForm.valid && this.profileForm.dirty) {
      this.profileSaved.emit({ first_name: this.profileForm.value.firstName });
    }
  }
}
