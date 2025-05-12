import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, Validators, FormControl, FormBuilder, FormGroup } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { startWith, map, debounceTime, switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { ExerciseDto } from '@shared/api/api.types';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';

interface AddExerciseDialogAutocompleteOption {
  id: string;
  name: string;
  isCreateNewOption?: boolean;
}

export interface AddExerciseDialogData {
  exercises: Pick<ExerciseDto, 'id' | 'name'>[];
}

export type AddExerciseDialogCloseResult =
| { saveExisting: true; value: Pick<ExerciseDto, 'id'> }
| { saveNew: true; value: Pick<ExerciseDto, 'name' | 'description'> }
| undefined;

@Component({
  selector: 'txg-add-exercise-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatIconModule,
    MatAutocompleteModule,
    MatSlideToggleModule
  ],
  templateUrl: './add-exercise-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddExerciseDialogComponent implements OnInit {
  exerciseForm: FormGroup;
  isCreatingNewExercise = signal<boolean>(false);

  filteredExercises$!: Observable<AddExerciseDialogAutocompleteOption[]>;

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddExerciseDialogComponent, AddExerciseDialogCloseResult>,
    @Inject(MAT_DIALOG_DATA) public data: AddExerciseDialogData,
  ) {
    this.exerciseForm = this.fb.group({
      exerciseControl: new FormControl<string | AddExerciseDialogAutocompleteOption>('', Validators.required),
      newExerciseName: [''],
      newExerciseDescription: ['']
    });
  }

  ngOnInit(): void {
    this.filteredExercises$ = this.exerciseForm.get('exerciseControl')!.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map(value => typeof value === 'string' ? value : value?.name || ''),
      switchMap(name => this.filterExercisesAndAddCreateOption(name))
    );
  }

  private filterExercisesAndAddCreateOption(value: string): Observable<AddExerciseDialogAutocompleteOption[]> {
    const filterValue = value.toLowerCase();
    const options: AddExerciseDialogAutocompleteOption[] = this.data.exercises
      .filter((ex: Pick<ExerciseDto, 'id' | 'name'>) => ex.name.toLowerCase().includes(filterValue))
      .map((ex: Pick<ExerciseDto, 'id' | 'name'>) => ({ id: ex.id, name: ex.name, isCreateNewOption: false }));

    if (filterValue && !options.some(opt => opt.name.toLowerCase() === filterValue)) {
      if (!options.some(opt => opt.isCreateNewOption)) {
         options.push({ id: 'CREATE_NEW_EXERCISE', name: `Create new exercise: "${value}"`, isCreateNewOption: true });
      }
    } else {
      const createIndex = options.findIndex(opt => opt.isCreateNewOption);
      if (createIndex > -1) {
        options.splice(createIndex, 1);
      }
    }
    return of(options);
  }

  displayExercise(option: AddExerciseDialogAutocompleteOption | null): string {
    if (typeof option === 'string') return option;
    return option?.name || '';
  }

  onAutocompleteInput(event: Event): void {
    const inputValue = (event.target as HTMLInputElement).value;
    if (!inputValue) {
      this.isCreatingNewExercise.set(false);
      this.exerciseForm.get('newExerciseName')?.clearValidators();
      this.exerciseForm.get('newExerciseName')?.updateValueAndValidity();
    }
  }

  onSelectionChanged(event: MatAutocompleteSelectedEvent): void {
    const selectedOption = event.option.value as AddExerciseDialogAutocompleteOption;
    if (selectedOption.isCreateNewOption) {
      const exerciseNameFromOption = selectedOption.name.match(/"(.*?)"/)?.[1] || '';
      this.exerciseForm.get('newExerciseName')?.setValue(exerciseNameFromOption);
      this.isCreatingNewExercise.set(true);
      this.exerciseForm.get('newExerciseName')?.setValidators(Validators.required);
    } else {
      this.isCreatingNewExercise.set(false);
      this.exerciseForm.get('newExerciseName')?.clearValidators();
      this.exerciseForm.get('newExerciseName')?.setValue('');
      this.exerciseForm.get('newExerciseDescription')?.setValue('');
    }
    this.exerciseForm.get('newExerciseName')?.updateValueAndValidity();
  }

  isSaveDisabled(): boolean {
    if (this.isCreatingNewExercise()) {
      return this.exerciseForm.get('newExerciseName')?.invalid ?? true;
    } else {
      const selection = this.exerciseForm.get('exerciseControl')?.value;
      if (!selection || typeof selection === 'string' || (selection as AddExerciseDialogAutocompleteOption).isCreateNewOption) {
        return true;
      }
      return this.exerciseForm.get('exerciseControl')?.invalid ?? true;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  async onSave(): Promise<void> {
    this.exerciseForm.get('exerciseControl')?.markAsTouched();
    if (this.isCreatingNewExercise()) {
        this.exerciseForm.get('newExerciseName')?.markAsTouched();
    }

    if (this.isSaveDisabled()) {
      return;
    }

    try {
      if (this.isCreatingNewExercise()) {
        const newExerciseNameFromForm = this.exerciseForm.get('newExerciseName')?.value?.trim();
        if (!newExerciseNameFromForm) {
          this.exerciseForm.get('newExerciseName')?.setErrors({ required: true });
          return;
        }

        this.dialogRef.close({
          saveNew: true,
          value: {
            name: newExerciseNameFromForm,
            description: this.exerciseForm.get('newExerciseDescription')?.value?.trim() || null
          }
        });
      } else {
        const autocompleteSelection = this.exerciseForm.get('exerciseControl')?.value as AddExerciseDialogAutocompleteOption;
        this.dialogRef.close({ saveExisting: true, value: { id: autocompleteSelection.id } });
      }
    } catch (error) {
      console.error('Error saving exercise selection:', error);
      this.dialogRef.close();
    }
  }
}
