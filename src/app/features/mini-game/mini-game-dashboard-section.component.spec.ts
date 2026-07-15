import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { MiniGameDashboardSectionComponent } from './mini-game-dashboard-section.component';
import { MiniGameService } from './mini-game.service';

describe('MiniGameDashboardSectionComponent', () => {
  it('shows the host empty state when creation is available', async () => {
    const fixture = await render('HOST');
    fixture.componentRef.setInput('showCreate', true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.mini-game-empty-heading')?.textContent).toContain('Mini game');
    expect(compiled.querySelector('.mini-game-empty-heading svg')).not.toBeNull();
    expect(compiled.querySelector('.mini-game-empty-action button')?.textContent).toContain(
      'Create mini game',
    );
    expect(compiled.textContent).not.toContain('No game running');
  });

  it('does not show the empty state to players', async () => {
    const fixture = await render('PLAYER');
    fixture.componentRef.setInput('showCreate', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.mini-game-empty-section')).toBeNull();
  });

  async function render(role: 'HOST' | 'PLAYER') {
    const miniGame = {
      action: signal(null).asReadonly(),
      canManage: signal(false).asReadonly(),
      current: signal(null).asReadonly(),
      loading: signal(false).asReadonly(),
    };
    const authState = {
      profile: signal({
        id: 'user-a',
        displayName: 'Ada',
        role,
        createdAt: '2026-07-15T00:00:00.000Z',
        updatedAt: '2026-07-15T00:00:00.000Z',
      }).asReadonly(),
    };

    await TestBed.configureTestingModule({
      imports: [MiniGameDashboardSectionComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: MiniGameService, useValue: miniGame },
      ],
    }).compileComponents();

    return TestBed.createComponent(MiniGameDashboardSectionComponent);
  }
});
