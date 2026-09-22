import { MatChipSelectionChange } from '@angular/material/chips';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartChipRowComponent, ChartChipViewModel } from './chart-chip-row.component';

const chip = (id: string, selected: boolean): ChartChipViewModel =>
  ({ id, label: id, colorToken: '--txg-chart-series-1', selected });

const userToggle = (selected: boolean) =>
  ({ isUserInput: true, source: { selected } }) as MatChipSelectionChange;

describe('ChartChipRowComponent', () => {
  let component: ChartChipRowComponent;

  beforeEach(() => {
    component = new ChartChipRowComponent();
    component.chips = [chip('a', true), chip('b', true)];
  });

  it('should emit the chip id when the user toggles one', () => {
    const spy = vi.spyOn(component.chipToggled, 'emit');

    component.onSelectionChanged('a', userToggle(false));

    expect(spy).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('should NOT emit when the selection changes programmatically', () => {
    const spy = vi.spyOn(component.chipToggled, 'emit');

    component.onSelectionChanged('a', { isUserInput: false } as MatChipSelectionChange);

    expect(spy).not.toHaveBeenCalled();
  });

  it('should leave the selected state to the parent, emitting on every user toggle', () => {
    const spy = vi.spyOn(component.chipToggled, 'emit');

    component.onSelectionChanged('a', userToggle(false));
    component.onSelectionChanged('a', userToggle(true));

    expect(spy).toHaveBeenCalledTimes(2);
  });

  /**
   * Material flips the chip before this fires, and an unchanged model will not flip it back - the
   * binding sees the same value and writes nothing. So the refusal restores the chip itself.
   */
  describe('the last selected chip', () => {
    beforeEach(() => {
      component.chips = [chip('a', true), chip('b', false)];
    });

    it('should not emit when turning it off would leave the chart empty', () => {
      const spy = vi.spyOn(component.chipToggled, 'emit');

      component.onSelectionChanged('a', userToggle(false));

      expect(spy).not.toHaveBeenCalled();
    });

    it('should put the chip back on', () => {
      const event = userToggle(false);

      component.onSelectionChanged('a', event);

      expect(event.source.selected).toBe(true);
    });

    it('should still let an unselected chip be turned on', () => {
      const spy = vi.spyOn(component.chipToggled, 'emit');

      component.onSelectionChanged('b', userToggle(true));

      expect(spy).toHaveBeenCalledExactlyOnceWith('b');
    });
  });
});
