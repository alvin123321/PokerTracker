import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: {
            profile: signal({ displayName: 'Jamie Player', role: 'PLAYER' }),
            loading: signal(false),
            updateDisplayName: jasmine.createSpy('updateDisplayName').and.resolveTo(),
            updatePassword: jasmine.createSpy('updatePassword').and.resolveTo()
          }
        }
      ]
    }).compileComponents();
  });

  it('keeps account editing controls without a duplicate sign out section', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.profile-panel')).toHaveSize(2);
    expect(compiled.querySelector('.profile-signout-panel')).toBeNull();
    expect(compiled.querySelector('.profile-signout-button')).toBeNull();
  });
});
