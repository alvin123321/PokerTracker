import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import {
  SessionFinancialEntryDialogComponent,
  SessionFinancialEntryDialogData
} from './session-financial-entry-dialog.component';

describe('SessionFinancialEntryDialogComponent', () => {
  let fixture: ComponentFixture<SessionFinancialEntryDialogComponent>;

  beforeEach(async () => {
    const data: SessionFinancialEntryDialogData = {
      mode: 'add',
      isHostAdmin: true,
      currentUserId: 'host-1',
      managers: [
        {
          id: 'manager-1',
          username: 'manager-one',
          displayName: 'Manager One',
          role: 'MANAGER'
        }
      ]
    };

    await TestBed.configureTestingModule({
      imports: [SessionFinancialEntryDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionFinancialEntryDialogComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((element) => element.remove());
    fixture.destroy();
  });

  it('uses an in-app manager menu instead of a native mobile select', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('select')).toBeNull();
    expect(compiled.querySelector('button[aria-label="Choose manager"]')).not.toBeNull();
  });

  it('keeps the dialog open while choosing a manager from the menu', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector<HTMLButtonElement>(
      'button[aria-label="Choose manager"]'
    );

    trigger?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const managerOption = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')
    ).find((button) => button.textContent?.includes('Manager One'));
    managerOption?.click();
    fixture.detectChanges();

    expect(managerOption).toBeDefined();
    expect(trigger?.textContent).toContain('Manager One');
    expect(TestBed.inject(MatDialogRef).close).not.toHaveBeenCalled();
  });
});
