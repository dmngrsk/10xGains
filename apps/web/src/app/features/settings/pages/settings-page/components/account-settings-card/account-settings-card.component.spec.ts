import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AccountSettingsCardComponent } from './account-settings-card.component';
import { AccountSettingsCardViewModel } from '../../../../models/settings-page.viewmodel';

describe('AccountSettingsCardComponent', () => {
  const createFixture = (account: AccountSettingsCardViewModel | null) => {
    const fixture = TestBed.createComponent(AccountSettingsCardComponent);
    fixture.componentInstance.account = account;
    fixture.detectChanges();
    return fixture;
  };

  const query = (fixture: ReturnType<typeof createFixture>, dataCy: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-cy=${dataCy}]`);

  it('should hide the Google button until the identities have loaded', () => {
    const fixture = createFixture({ googleLinked: null, identityCount: 0 });

    expect(query(fixture, 'settings-connect-google-button')).toBeNull();
    expect(query(fixture, 'settings-disconnect-google-button')).toBeNull();
  });

  it('should offer to connect when Google is not linked', () => {
    const fixture = createFixture({ googleLinked: false, identityCount: 1 });

    expect(query(fixture, 'settings-connect-google-button')).not.toBeNull();
    expect(query(fixture, 'settings-disconnect-google-button')).toBeNull();
  });

  it('should enable disconnect when Google is one of several identities', () => {
    const fixture = createFixture({ googleLinked: true, identityCount: 2 });
    const disconnectButton = query(fixture, 'settings-disconnect-google-button') as HTMLButtonElement;

    expect(disconnectButton).not.toBeNull();
    expect(disconnectButton.disabled).toBe(false);
    expect(query(fixture, 'settings-connect-google-button')).toBeNull();
  });

  it('should disable disconnect when Google is the sole identity', () => {
    const fixture = createFixture({ googleLinked: true, identityCount: 1 });

    expect((query(fixture, 'settings-disconnect-google-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('should always show the Change Password button', () => {
    const fixture = createFixture({ googleLinked: true, identityCount: 1 });

    expect(query(fixture, 'settings-change-password-button')?.textContent?.trim()).toBe('Change Password');
  });

  it('should emit googleConnected and googleDisconnected when the buttons are clicked', () => {
    const connectFixture = createFixture({ googleLinked: false, identityCount: 1 });
    let connected = false;
    connectFixture.componentInstance.googleConnected.subscribe(() => (connected = true));
    (query(connectFixture, 'settings-connect-google-button') as HTMLButtonElement).click();
    expect(connected).toBe(true);

    const disconnectFixture = createFixture({ googleLinked: true, identityCount: 2 });
    let disconnected = false;
    disconnectFixture.componentInstance.googleDisconnected.subscribe(() => (disconnected = true));
    (query(disconnectFixture, 'settings-disconnect-google-button') as HTMLButtonElement).click();
    expect(disconnected).toBe(true);
  });
});
