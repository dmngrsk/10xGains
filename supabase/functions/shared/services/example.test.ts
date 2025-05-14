import { describe, it, expect } from 'vitest';
import { add } from './example.ts';

describe('applyExerciseProgression', () => {
  it('should be a function', () => {
    expect(typeof add).toBe('function');
  });

  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it('should add two negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });
});
