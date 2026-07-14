import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { GlobalChatPage } from '../../chat/global-chat.page';
import { PokerStoreService } from '../../host/data/poker-store.service';
import { PlayerDashboardPage } from './player-dashboard.page';

@Component({
  selector: 'app-global-chat-page',
  template: ''
})
class GlobalChatPageStub {
  readonly compact = input(false);
}

function findStyleRuleContaining(...selectorFragments: string[]): CSSStyleRule | undefined {
  const visit = (rules: CSSRuleList): CSSStyleRule | undefined => {
    for (const rule of Array.from(rules)) {
      if (
        rule instanceof CSSStyleRule &&
        selectorFragments.every((fragment) => rule.selectorText.includes(fragment))
      ) {
        return rule;
      }

      if ('cssRules' in rule) {
        const nestedRule = visit((rule as CSSGroupingRule).cssRules);
        if (nestedRule) {
          return nestedRule;
        }
      }
    }

    return undefined;
  };

  for (const stylesheet of Array.from(document.styleSheets)) {
    const rule = visit(stylesheet.cssRules);
    if (rule) {
      return rule;
    }
  }

  return undefined;
}

describe('PlayerDashboardPage', () => {
  let fixture: ComponentFixture<PlayerDashboardPage>;
  let queryParamMap: BehaviorSubject<ParamMap>;

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject(convertToParamMap({ tab: 'chat' }));
    const authState = {
      profile: signal({ displayName: 'Player' }),
      user: signal({ id: 'player-1' })
    };
    const store = {
      sessions: signal([]),
      error: signal<string | null>(null),
      refreshSessions: jasmine.createSpy('refreshSessions').and.resolveTo()
    };

    await TestBed.configureTestingModule({
      imports: [PlayerDashboardPage],
      providers: [
        { provide: AuthStateService, useValue: authState },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap,
            snapshot: {
              queryParamMap: queryParamMap.value
            }
          }
        },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: PokerStoreService, useValue: store }
      ]
    })
      .overrideComponent(PlayerDashboardPage, {
        remove: { imports: [GlobalChatPage] },
        add: { imports: [GlobalChatPageStub] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(PlayerDashboardPage);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('uses the full chat layout in the player chat tab', () => {
    const chat = fixture.debugElement.query(By.directive(GlobalChatPageStub));

    expect(chat).not.toBeNull();
    expect(chat.componentInstance.compact()).toBeFalse();
  });

  it('returns from chat to Home when the shell updates the route and restores the player tabs', () => {
    queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.player-dashboard-chat-active')).toBeNull();
    expect(compiled.querySelector('.player-tabs')).not.toBeNull();
  });

  it('hides the player bottom tabs while mobile chat is active', () => {
    const hiddenTabsRule = findStyleRuleContaining(
      '.player-dashboard-chat-active',
      '.player-tabs'
    );

    expect(hiddenTabsRule).toBeDefined();
    expect(hiddenTabsRule?.style.display).toBe('none');
  });

  it('uses a light digital font for the game players and game timeline headings', () => {
    const headingRule = findStyleRuleContaining('feature-detail-heading', 'span', ':first-child');

    expect(headingRule).toBeDefined();
    expect(headingRule?.style.fontFamily).toContain('Share Tech Mono');
    expect(headingRule?.style.fontWeight).toBe('400');
  });
});
