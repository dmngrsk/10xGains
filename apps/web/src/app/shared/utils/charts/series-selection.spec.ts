import { describe, expect, it } from 'vitest';
import { wouldEmptySelection } from './series-selection';

const item = (id: string, selected: boolean) => ({ id, selected });

describe('wouldEmptySelection', () => {
  it('should be true for the only selected item', () => {
    const items = [item('a', true), item('b', false)];

    expect(wouldEmptySelection(items, items[0])).toBe(true);
  });

  it('should be false while another item is still selected', () => {
    const items = [item('a', true), item('b', true)];

    expect(wouldEmptySelection(items, items[0])).toBe(false);
  });

  // Turning one *on* can never empty the selection, whatever else is off.
  it('should be false for an unselected item', () => {
    const items = [item('a', true), item('b', false)];

    expect(wouldEmptySelection(items, items[1])).toBe(false);
  });

  it('should be false for an item that is not in the list', () => {
    expect(wouldEmptySelection([item('a', true)], undefined)).toBe(false);
  });

  it('should be false when nothing is selected at all', () => {
    const items = [item('a', false), item('b', false)];

    expect(wouldEmptySelection(items, items[0])).toBe(false);
  });
});
