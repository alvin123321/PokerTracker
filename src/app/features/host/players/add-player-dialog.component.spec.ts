import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AddPlayerDialogComponent, AddPlayerDialogData } from './add-player-dialog.component';

describe('AddPlayerDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPlayerDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            registeredPlayers: [],
            sessionMemberUserIds: [],
            sessionMemberNames: []
          } satisfies AddPlayerDialogData
        },
        {
          provide: MatDialogRef,
          useValue: { close: jasmine.createSpy('close') }
        }
      ]
    }).compileComponents();
  });

  it('presents the buy-in amount as a prominent centered value', () => {
    const fixture = TestBed.createComponent(AddPlayerDialogComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const label = element.querySelector<HTMLLabelElement>('label[for="buyIn"]');
    const input = element.querySelector<HTMLInputElement>('#buyIn');

    expect(label?.textContent?.trim()).toBe('Buy-in Amount');
    expect(input?.classList).toContain('text-center');
    expect(input?.classList).toContain('text-2xl');
    expect(input?.classList).toContain('font-semibold');
  });
});
