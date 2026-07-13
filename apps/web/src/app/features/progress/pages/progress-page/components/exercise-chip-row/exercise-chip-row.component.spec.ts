import { MatChipSelectionChange } from '@angular/material/chips';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExerciseChipRowComponent } from './exercise-chip-row.component';

describe('ExerciseChipRowComponent', () => {
  let component: ExerciseChipRowComponent;

  beforeEach(() => {
    component = new ExerciseChipRowComponent();
  });

  it('should emit the exercise id when a chip is toggled by the user', () => {
    const spy = vi.spyOn(component.exerciseToggled, 'emit');

    component.onSelectionChanged('ex-1', { isUserInput: true } as MatChipSelectionChange);

    expect(spy).toHaveBeenCalledExactlyOnceWith('ex-1');
  });

  it('should NOT emit when the chip selection changes programmatically', () => {
    const spy = vi.spyOn(component.exerciseToggled, 'emit');

    component.onSelectionChanged('ex-1', { isUserInput: false } as MatChipSelectionChange);

    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit again on a repeated user toggle, leaving the selected state to the parent', () => {
    const spy = vi.spyOn(component.exerciseToggled, 'emit');

    component.onSelectionChanged('ex-1', { isUserInput: true } as MatChipSelectionChange);
    component.onSelectionChanged('ex-1', { isUserInput: true } as MatChipSelectionChange);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('ex-1');
  });
});
