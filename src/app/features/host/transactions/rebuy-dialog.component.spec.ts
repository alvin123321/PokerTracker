import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { RebuyDialogComponent, RebuyDialogData } from './rebuy-dialog.component';

describe('RebuyDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RebuyDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            player: {
              id: 'session-player-1',
              tableId: 'table-1',
              name: 'Alvin',
              status: 'ACTIVE',
              totalBuyIn: 300,
              cashOut: 0,
              net: -300,
              joinedAt: '2026-07-13T20:00:00.000Z',
              completedAt: null
            }
          } satisfies RebuyDialogData
        },
        {
          provide: MatDialogRef,
          useValue: { close: jasmine.createSpy('close') }
        }
      ]
    }).compileComponents();
  });

  it('places the optional comment after the custom amount', () => {
    const fixture = TestBed.createComponent(RebuyDialogComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('label'))
      .map((label) => label.getAttribute('for'));

    expect(labels).toEqual(['customRebuy', 'rebuyComment']);
  });
});
