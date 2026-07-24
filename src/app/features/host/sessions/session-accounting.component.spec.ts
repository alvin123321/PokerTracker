import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  PokerSession,
  PokerStoreService,
  RegisteredPlayerOption,
  SessionFinancialEntry
} from '../data/poker-store.service';
import { SessionAccountingComponent } from './session-accounting.component';
import { SessionFinancialEntryDialogData } from './session-financial-entry-dialog.component';

describe('SessionAccountingComponent', () => {
  let fixture: ComponentFixture<SessionAccountingComponent>;
  let isHostAdmin: WritableSignal<boolean>;
  let role: WritableSignal<string>;
  let listRegisteredPlayers: jasmine.Spy;
  let openDialog: jasmine.Spy;

  beforeEach(async () => {
    isHostAdmin = signal(true);
    role = signal('HOST');
    openDialog = jasmine
      .createSpy('open')
      .and.returnValue({ afterClosed: () => of(undefined) });
    listRegisteredPlayers = jasmine
      .createSpy('listRegisteredPlayers')
      .and.resolveTo([
        {
          id: 'manager-1',
          username: 'manager-one',
          displayName: 'Manager One',
          role: 'MANAGER'
        }
      ]);

    await TestBed.configureTestingModule({
      imports: [SessionAccountingComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: AuthStateService,
          useValue: {
            isHostAdmin,
            role,
            user: signal({ id: 'host-1' })
          }
        },
        {
          provide: PokerStoreService,
          useValue: {
            listRegisteredPlayers,
            recordSessionFinancialEntry: jasmine
              .createSpy('recordSessionFinancialEntry')
              .and.resolveTo()
          }
        },
        { provide: MatDialog, useValue: { open: openDialog } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionAccountingComponent);
    fixture.componentRef.setInput('session', makeSession());
  });

  afterEach(() => fixture.destroy());

  it('preloads managers without showing the action loading overlay', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(listRegisteredPlayers).toHaveBeenCalledTimes(1);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.pokertrack-sync-overlay')
    ).toBeNull();
  });

  it('opens the add dialog before manager preloading finishes', async () => {
    const managerOptions = deferred<RegisteredPlayerOption[]>();
    listRegisteredPlayers.and.returnValue(managerOptions.promise);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      openAddDialog(): Promise<void>;
      openDialog(data: SessionFinancialEntryDialogData): Promise<unknown>;
    };
    const openEntryDialog = spyOn(component, 'openDialog').and.resolveTo(undefined);
    const dialogResult = component.openAddDialog();
    await Promise.resolve();

    expect(openEntryDialog).toHaveBeenCalledTimes(1);
    const dialogData = openEntryDialog.calls.mostRecent().args[0];
    expect(dialogData.managers).toEqual([]);

    managerOptions.resolve([
      {
        id: 'manager-1',
        username: 'manager-one',
        displayName: 'Manager One',
        role: 'MANAGER'
      }
    ]);
    await fixture.whenStable();
    await dialogResult;

    expect(dialogData.managers.map((manager) => manager.id)).toEqual(['manager-1']);
  });

  it('keeps active admin accounting collapsed until the header is expanded', () => {
    fixture.componentRef.setInput('session', makeSession('ACTIVE'));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const detailsToggle = compiled.querySelector<HTMLButtonElement>(
      '.accounting-toggle'
    );
    const details = compiled.querySelector<HTMLElement>('.accounting-details');

    expect(detailsToggle).not.toBeNull();
    expect(detailsToggle?.disabled).toBeFalse();
    expect(detailsToggle?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Tips & rake');
    expect(details?.getAttribute('aria-hidden')).toBe('true');
    expect(details?.textContent).toContain('Total tips');
    expect(details?.textContent).toContain('Total rake');

    detailsToggle?.click();
    fixture.detectChanges();

    expect(detailsToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(details?.getAttribute('aria-hidden')).toBe('false');
  });

  it('keeps manager accounting expanded', () => {
    isHostAdmin.set(false);
    role.set('MANAGER');
    fixture.componentRef.setInput('session', makeSession('ACTIVE'));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const details = compiled.querySelector<HTMLElement>('.accounting-details');

    expect(compiled.querySelector('.accounting-toggle')).toBeNull();
    expect(compiled.textContent).toContain('Your session accounting');
    expect(details?.getAttribute('aria-hidden')).toBe('false');
  });

  it('expands prior values from the last-edited line without a count or arrow control', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const detailsToggle = compiled.querySelector<HTMLButtonElement>(
      '.accounting-toggle'
    );

    detailsToggle?.click();
    fixture.detectChanges();

    const revisionTrigger = compiled.querySelector<HTMLButtonElement>(
      '.accounting-revision-trigger'
    );

    expect(revisionTrigger).not.toBeNull();
    expect(revisionTrigger?.textContent).toContain('Last edited by Manager One');
    expect(revisionTrigger?.textContent).not.toContain('previous');
    expect(revisionTrigger?.querySelector('svg')).toBeNull();
    expect(revisionTrigger?.classList).toContain('whitespace-nowrap');
    expect(revisionTrigger?.classList).toContain('text-[9px]');
    expect(revisionTrigger?.style.fontSize).toBe('9px');
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function makeSession(status: PokerSession['status'] = 'COMPLETED'): PokerSession {
  return {
    id: 'session-1',
    name: 'Completed Game',
    sessionDate: '2026-07-23',
    status,
    createdAt: '2026-07-23T01:00:00.000Z',
    closedAt: '2026-07-23T03:00:00.000Z',
    tables: [],
    players: [],
    transactions: [],
    financialEntries: [makeEntry()],
    timeCalls: []
  };
}

function makeEntry(): SessionFinancialEntry {
  return {
    id: 'entry-1',
    sessionId: 'session-1',
    entryType: 'TIP',
    amount: 500,
    managerUserId: 'manager-1',
    managerName: 'Manager One',
    createdAt: '2026-07-23T02:00:00.000Z',
    createdBy: 'host-1',
    createdByName: 'Admin',
    updatedAt: '2026-07-23T02:30:00.000Z',
    updatedBy: 'manager-1',
    updatedByName: 'Manager One',
    revisions: [
      {
        id: 'revision-1',
        entryId: 'entry-1',
        amount: 450,
        originalCreatedAt: '2026-07-23T02:00:00.000Z',
        actionAt: '2026-07-23T02:30:00.000Z',
        actionBy: 'manager-1',
        actionByName: 'Manager One'
      }
    ]
  };
}
