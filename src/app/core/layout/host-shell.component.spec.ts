import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';

import { AuthStateService } from '../auth/auth-state.service';
import { ConfirmationDialogComponent } from '../../features/host/shared/confirmation-dialog.component';
import { HostShellComponent } from './host-shell.component';

describe('HostShellComponent', () => {
  let signOutSpy: jasmine.Spy;

  beforeEach(async () => {
    signOutSpy = jasmine.createSpy('signOut').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [HostShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: {
            profile: signal({ displayName: 'Alvin Host' }),
            isHostAdmin: () => true,
            signOut: signOutSpy
          }
        }
      ]
    }).compileComponents();
  });

  it('keeps five primary mobile tabs and moves account actions into the header menu', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const mobileTabs = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.host-mobile-tab'));
    expect(mobileTabs).toHaveSize(5);
    expect(mobileTabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/host/dashboard',
      '/host/session-overview',
      '/host/pot-calculator',
      '/host/chat',
      '/host/sessions/history'
    ]);

    const menuToggle = compiled.querySelector<HTMLButtonElement>('.host-account-menu-toggle');
    expect(menuToggle).not.toBeNull();
    expect(menuToggle?.querySelector('.pokertrack-profile-avatar')?.textContent?.trim()).toBe('AH');
    menuToggle?.click();
    fixture.detectChanges();

    const menu = compiled.querySelector<HTMLElement>('.host-account-menu');
    expect(menu).not.toBeNull();
    expect(menu?.querySelector<HTMLAnchorElement>('a[href="/host/profile"]')).not.toBeNull();
    expect(menu?.querySelector<HTMLAnchorElement>('a[href="/host/players"]')).not.toBeNull();
    expect(menu?.querySelector<HTMLButtonElement>('.host-account-signout')).not.toBeNull();
  });

  it('provides the chat back control inside the top navigation', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.detectChanges();
    const navigation = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.host-shell-nav'
    );
    const backLink = navigation?.querySelector<HTMLAnchorElement>('.chat-shell-back');

    expect(backLink).not.toBeNull();
    expect(backLink?.getAttribute('href')).toBe('/host/dashboard');
    expect(backLink?.getAttribute('aria-label')).toBe('Back to Home');
  });

  it('allows the account menu to escape the header navigation without clipping', () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navigation = compiled.querySelector<HTMLElement>('.host-shell-nav')!;

    compiled.querySelector<HTMLButtonElement>('.host-account-menu-toggle')!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.host-account-menu')).not.toBeNull();
    expect(getComputedStyle(navigation).overflowX).toBe('visible');
    expect(getComputedStyle(navigation).overflowY).toBe('visible');
  });

  it('navigates from account links and signs out after confirmation', async () => {
    const fixture = TestBed.createComponent(HostShellComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.host-account-menu-toggle')!;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);

    menuToggle.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLAnchorElement>('a[href="/host/profile"]')!.click();
    expect(navigationTarget(router, navigateSpy.calls.mostRecent().args[0])).toBe('/host/profile');

    navigateSpy.calls.reset();
    menuToggle.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLAnchorElement>('a[href="/host/players"]')!.click();
    expect(navigationTarget(router, navigateSpy.calls.mostRecent().args[0])).toBe('/host/players');

    navigateSpy.calls.reset();
    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.returnValue({
      afterClosed: () => of(true)
    } as MatDialogRef<ConfirmationDialogComponent, boolean>);
    menuToggle.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.host-account-signout')!.click();
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalled();
    expect(signOutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});

function navigationTarget(router: Router, target: string | UrlTree): string {
  return typeof target === 'string' ? target : router.serializeUrl(target);
}
