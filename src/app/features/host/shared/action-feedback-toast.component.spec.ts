import { TestBed } from '@angular/core/testing';

import { ActionFeedbackToastComponent } from './action-feedback-toast.component';

describe('ActionFeedbackToastComponent', () => {
  it('uses the shell offset while remaining fixed outside document flow', () => {
    const fixture = TestBed.createComponent(ActionFeedbackToastComponent);
    fixture.componentRef.setInput('message', 'Rebuy successful.');
    fixture.nativeElement.style.setProperty('--pokertrack-action-feedback-top', '80px');
    fixture.detectChanges();
    const toast = fixture.nativeElement.querySelector('.action-feedback-toast');
    expect(getComputedStyle(fixture.nativeElement).position).toBe('fixed');
    expect(Number.parseFloat(getComputedStyle(toast).top)).toBeGreaterThan(80);
  });
});
