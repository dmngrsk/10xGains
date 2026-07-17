import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionWarmupBubbleComponent } from './session-warmup-bubble.component';
import { SessionWarmupSetViewModel } from '../../../../models/session-page.viewmodel';

const createMockWarmupSet = (overrides: Partial<SessionWarmupSetViewModel> = {}): SessionWarmupSetViewModel => ({
  id: 'warmup-0',
  reps: 5,
  weight: 32.5,
  ...overrides,
});

describe('SessionWarmupBubbleComponent', () => {
  let component: SessionWarmupBubbleComponent;

  beforeEach(() => {
    component = new SessionWarmupBubbleComponent();
  });

  it('should emit bubbleClicked exactly once per click in toggle mode', () => {
    component.isToggle = true;
    const spy = vi.spyOn(component.bubbleClicked, 'emit');

    component.onBubbleClicked();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('should emit bubbleClicked exactly once per click in warmup set mode, without mutating the set', () => {
    component.warmupSet = createMockWarmupSet({ reps: 3, weight: 45 });
    const spy = vi.spyOn(component.bubbleClicked, 'emit');
    const originalSet = { ...component.warmupSet };

    component.onBubbleClicked();

    expect(spy).toHaveBeenCalledOnce();
    expect(component.warmupSet).toEqual(originalSet);
  });
});
