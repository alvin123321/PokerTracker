import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';

import { ConfirmationDialogComponent } from '../../features/host/shared/confirmation-dialog.component';
import { AuthStateService } from '../auth/auth-state.service';
import { PlayerShellComponent } from './player-shell.component';

describe('PlayerShellComponent', () => {
  let signOutSpy: jasmine.Spy;

  beforeEach(async () => {
    signOutSpy = jasmine.createSpy('signOut').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [PlayerShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: {
            profile: signal({ displayName: 'Jamie Player' }),
            signOut: signOutSpy
          }
        }
      ]
    }).compileComponents();
  });

  it('opens an avatar menu with profile and sign out actions only', () => {
    const fixture = TestBed.createComponent(PlayerShellComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.host-account-menu-toggle');
    const header = compiled.querySelector<HTMLElement>('header');

    expect(header?.classList).toContain('z-50');
    expect(menuToggle?.querySelector('.pokertrack-profile-avatar')?.textContent?.trim()).toBe('JP');
    expect(menuToggle?.getAttribute('aria-expanded')).toBe('false');

    menuToggle?.click();
    fixture.detectChanges();

    const menu = compiled.querySelector<HTMLElement>('.host-account-menu');
    expect(menu).not.toBeNull();
    expect(menu?.querySelector<HTMLAnchorElement>('a[href="/player/profile"]')).not.toBeNull();
    expect(menu?.querySelector<HTMLButtonElement>('.host-account-signout')).not.toBeNull();
    expect(menu?.querySelectorAll('[role="menuitem"]')).toHaveSize(2);
    expect(menu?.textContent).not.toContain('Members');
  });

  it('provides the chat back control inside the top navigation', () => {
    const fixture = TestBed.createComponent(PlayerShellComponent);
    fixture.detectChanges();
    const navigation = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.host-shell-nav'
    );
    const backLink = navigation?.querySelector<HTMLAnchorElement>('.chat-shell-back');

    expect(backLink).not.toBeNull();
    expect(backLink?.getAttribute('href')).toBe('/player/dashboard?tab=overview');
    expect(backLink?.getAttribute('aria-label')).toBe('Back to Home');
  });

  it('routes the top back control to History from a player session detail', () => {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/player/sessions/session-a');
    const fixture = TestBed.createComponent(PlayerShellComponent);
    fixture.detectChanges();
    const backLink = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.chat-shell-back'
    );

    expect(backLink?.getAttribute('href')).toBe('/player/dashboard?tab=history');
    expect(backLink?.getAttribute('aria-label')).toBe('Back');
    expect(backLink?.classList).toContain('player-session-back');
  });

  it('owns the persistent player bottom navigation', () => {
    const fixture = TestBed.createComponent(PlayerShellComponent);
    fixture.detectChanges();
    const navigation = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'nav[aria-label="Player dashboard"]'
    );
    const destinations = Array.from(
      navigation?.querySelectorAll<HTMLAnchorElement>('a') ?? []
    ).map((link) => link.getAttribute('href'));

    expect(navigation?.classList).toContain('player-shell-tabs');
    expect(destinations).toEqual([
      '/player/dashboard?tab=calculator',
      '/player/dashboard?tab=overview',
      '/player/dashboard?tab=chat',
      '/player/dashboard?tab=history'
    ]);
  });

  it('navigates to profile and signs out after confirmation', async () => {
    const fixture = TestBed.createComponent(PlayerShellComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const menuToggle = compiled.querySelector<HTMLButtonElement>('.host-account-menu-toggle')!;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);

    menuToggle.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLAnchorElement>('a[href="/player/profile"]')!.click();
    expect(navigationTarget(router, navigateSpy.calls.mostRecent().args[0])).toBe('/player/profile');

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
