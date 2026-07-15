import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { of } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { PokerSession, PokerStoreService } from '../data/poker-store.service';
import { ConfirmationDialogComponent } from '../shared/confirmation-dialog.component';
import { SessionSummaryPage } from './session-summary.page';

describe('SessionSummaryPage', () => {
  let authState: { isHostAdmin: jasmine.Spy<() => boolean> };
  let router: Router;
  let sessionState: WritableSignal<PokerSession | undefined>;
  let store: {
    deleteSession: jasmine.Spy;
    error: ReturnType<typeof signal<string | null>>;
    getSession: jasmine.Spy;
    playersForTable: jasmine.Spy;
    totalsFor: jasmine.Spy;
  };

  beforeEach(async () => {
    authState = {
      isHostAdmin: jasmine.createSpy('isHostAdmin').and.returnValue(true),
    };
    sessionState = signal<PokerSession | undefined>(undefined);
    store = {
      deleteSession: jasmine.createSpy('deleteSession').and.resolveTo(),
      error: signal<string | null>(null),
      getSession: jasmine.createSpy('getSession').and.callFake(() => sessionState()),
      playersForTable: jasmine.createSpy('playersForTable').and.callFake(
        (session: PokerSession | undefined, tableId: string | null) =>
          session?.players.filter((player) => player.tableId === tableId) ?? [],
      ),
      totalsFor: jasmine.createSpy('totalsFor').and.callFake(totalsFor),
    };

    await TestBed.configureTestingModule({
      imports: [SessionSummaryPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ sessionId: 'session-complete' }),
            },
          },
        },
        { provide: AuthStateService, useValue: authState },
        { provide: PokerStoreService, useValue: store },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('shows deletion only for a completed session viewed by the host admin', () => {
    const fixture = renderSummary(completedSession(), true);
    expect(fixture.nativeElement.querySelector('.session-summary-menu-trigger')).not.toBeNull();

    authState.isHostAdmin.and.returnValue(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-summary-menu-trigger')).toBeNull();

    const activeFixture = renderSummary(activeSession(), true);
    expect(activeFixture.nativeElement.querySelector('.session-summary-menu-trigger')).toBeNull();
  });

  it('uses a Material menu with a mobile-safe trigger and one-row destructive action', async () => {
    const fixture = renderSummary(completedSession(), true);
    const triggerDebug = fixture.debugElement.query(By.directive(MatMenuTrigger));
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.session-summary-menu-trigger'
    );

    expect(triggerDebug).not.toBeNull();
    expect(trigger?.closest('.session-summary-title-row')).not.toBeNull();
    expect(trigger?.classList.contains('ml-auto')).toBeTrue();
    expect(trigger!.getBoundingClientRect().width).toBeCloseTo(44, 0);
    expect(trigger!.getBoundingClientRect().height).toBeCloseTo(44, 0);

    if (!triggerDebug) {
      return;
    }

    triggerDebug.injector.get(MatMenuTrigger).openMenu();
    fixture.detectChanges();
    await fixture.whenStable();

    const deleteButton = document.querySelector<HTMLButtonElement>(
      '.session-summary-delete-action'
    );
    const menuText = deleteButton?.querySelector<HTMLElement>('.mat-mdc-menu-item-text');

    expect(deleteButton).not.toBeNull();
    expect(deleteButton?.querySelector('svg')).not.toBeNull();
    expect(deleteButton?.querySelector('span')?.textContent).toContain('Delete session');
    expect(menuText ? getComputedStyle(menuText).display : null).toBe('flex');
    expect(getComputedStyle(deleteButton!).color).toBe('rgb(252, 165, 165)');
  });

  it('keeps the session when No is selected', async () => {
    const fixture = renderSummary(completedSession(), true);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.returnValue(dialogResult(false));
    await clickDeleteMenu(fixture);
    await settleAsyncWork();

    expect(store.deleteSession).not.toHaveBeenCalled();
  });

  it('deletes the completed session and returns to history after Yes is selected', async () => {
    const fixture = renderSummary(completedSession(), true);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.returnValue(dialogResult(true));
    await clickDeleteMenu(fixture);
    await settleAsyncWork();

    expect(dialog.open).toHaveBeenCalledWith(ConfirmationDialogComponent, {
      autoFocus: false,
      data: {
        title: 'Delete completed session?',
        message:
          'This permanently deletes this session and all game records. Registered members remain available.',
        cancelLabel: 'No, keep session',
        confirmLabel: 'Yes, delete',
        tone: 'danger',
        details: ['Tuesday Cash Game', '1 players', '$100 total buy-in'],
      },
      panelClass: 'pokertrack-dialog-panel',
    });
    expect(store.deleteSession).toHaveBeenCalledOnceWith('session-complete');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/host/sessions/history', {
      replaceUrl: true,
    });
  });

  it('shows the parsed deletion error and keeps the summary open when deletion fails', async () => {
    store.deleteSession.and.rejectWith(new Error('The completed session could not be deleted.'));
    const fixture = renderSummary(completedSession(), true);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.returnValue(dialogResult(true));
    await clickDeleteMenu(fixture);
    await settleAsyncWork();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('The completed session could not be deleted.');
    expect(compiled.querySelector<HTMLButtonElement>('.session-summary-menu-trigger')?.disabled).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows feedback after deletion when navigation resolves false', async () => {
    store.deleteSession.and.callFake(async () => sessionState.set(undefined));
    (router.navigateByUrl as jasmine.Spy).and.resolveTo(false);
    const fixture = renderSummary(completedSession(), true);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.returnValue(dialogResult(true));

    await clickDeleteMenu(fixture);
    await settleAsyncWork();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Session deleted, but History could not be opened.'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Summary not found');
  });

  it('shows feedback after deletion when navigation rejects', async () => {
    store.deleteSession.and.callFake(async () => sessionState.set(undefined));
    (router.navigateByUrl as jasmine.Spy).and.rejectWith(new Error('Navigation rejected'));
    const fixture = renderSummary(completedSession(), true);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.returnValue(dialogResult(true));

    await clickDeleteMenu(fixture);
    await settleAsyncWork();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Session deleted, but History could not be opened.'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Summary not found');
  });

  function renderSummary(session: PokerSession, isHostAdmin: boolean) {
    authState.isHostAdmin.and.returnValue(isHostAdmin);
    sessionState.set(session);

    const fixture = TestBed.createComponent(SessionSummaryPage);
    fixture.detectChanges();
    return fixture;
  }

  async function clickDeleteMenu(
    fixture: ReturnType<typeof TestBed.createComponent<SessionSummaryPage>>
  ): Promise<void> {
    const triggerDebug = fixture.debugElement.query(By.directive(MatMenuTrigger));

    if (!triggerDebug) {
      fail('Expected the completed-session action menu trigger to be rendered.');
      return;
    }

    triggerDebug.injector.get(MatMenuTrigger).openMenu();
    fixture.detectChanges();
    await fixture.whenStable();

    const deleteButton = document.querySelector<HTMLButtonElement>(
      '.session-summary-delete-action'
    );

    if (!deleteButton) {
      fail('Expected the completed-session deletion action to be rendered.');
      return;
    }

    deleteButton.click();
    fixture.detectChanges();
  }
});

async function settleAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function dialogResult(confirmed: boolean): MatDialogRef<unknown, boolean> {
  return {
    afterClosed: () => of(confirmed),
  } as MatDialogRef<unknown, boolean>;
}

function completedSession(): PokerSession {
  return sessionFixture('COMPLETED');
}

function activeSession(): PokerSession {
  return sessionFixture('ACTIVE');
}

function sessionFixture(status: PokerSession['status']): PokerSession {
  const completed = status === 'COMPLETED';

  return {
    id: 'session-complete',
    name: 'Tuesday Cash Game',
    sessionDate: '2026-07-14T00:00:00.000Z',
    status,
    createdAt: '2026-07-14T18:00:00.000Z',
    closedAt: completed ? '2026-07-14T22:00:00.000Z' : null,
    tables: [],
    players: [
      {
        id: 'player-1',
        tableId: null,
        name: 'Alex',
        status: completed ? 'COMPLETED' : 'ACTIVE',
        totalBuyIn: 100,
        cashOut: completed ? 150 : 0,
        net: completed ? 50 : -100,
        joinedAt: '2026-07-14T18:00:00.000Z',
        completedAt: completed ? '2026-07-14T22:00:00.000Z' : null,
      },
    ],
    transactions: [],
    timeCalls: [],
  };
}

function totalsFor(session: PokerSession | undefined) {
  const players = session?.players ?? [];

  return {
    totalPlayers: players.length,
    activePlayers: players.filter((player) => player.status === 'ACTIVE').length,
    cashedOutPlayers: players.filter((player) => player.status === 'COMPLETED').length,
    totalBuyIn: players.reduce((total, player) => total + player.totalBuyIn, 0),
    totalCashOut: players.reduce((total, player) => total + player.cashOut, 0),
    totalNet: players.reduce((total, player) => total + player.net, 0),
  };
}
