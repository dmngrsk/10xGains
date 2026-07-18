import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocalStorageService);
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should round-trip a value', () => {
    service.setItem('key', 'value');

    expect(service.getItem('key')).toBe('value');
  });

  it('should return null for a missing key', () => {
    expect(service.getItem('missing')).toBeNull();
  });

  it('should remove a stored value', () => {
    service.setItem('key', 'value');

    service.removeItem('key');

    expect(service.getItem('key')).toBeNull();
  });

  it('should swallow storage errors instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });

    expect(() => service.setItem('key', 'value')).not.toThrow();
    expect(service.getItem('key')).toBeNull();
  });
});
