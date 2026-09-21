/**
 * The rule both chart chip rows share: a chart always draws something.
 *
 * An empty chart is a dead end. Nothing is plotted, so nothing is left on screen to suggest which
 * chip to press next, and the axes collapse to a blank box. Rather than repopulate the row on the
 * user's behalf - which silently undoes a deliberate sequence of taps - the last selected chip
 * simply refuses to turn off.
 *
 * It is enforced in two places on purpose. The facade refuses the model change, so no caller can
 * empty the selection; the chip row refuses the interaction, because Material has already flipped
 * the chip's own state by the time the event arrives and an unchanged model will not flip it back.
 */
export function wouldEmptySelection<T extends { selected: boolean }>(
  items: readonly T[],
  target: T | undefined
): boolean {
  if (!target?.selected) {
    return false;
  }

  return items.filter(item => item.selected).length === 1;
}
