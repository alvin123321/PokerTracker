import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStateService } from '../../core/auth/auth-state.service';
import {
  PlayerPublicTableRosterEntry,
  PokerSession,
  PokerStoreService
} from '../host/data/poker-store.service';
import { GlobalChatMessage } from './global-chat.logic';
import { GlobalChatPage } from './global-chat.page';
import { GlobalChatService } from './global-chat.service';

function findStyleRule(selector: string): CSSStyleRule | undefined {
  const visit = (rules: CSSRuleList): CSSStyleRule | undefined => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && rule.selectorText === selector) {
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

describe('GlobalChatPage', () => {
  let messages: ReturnType<typeof signal<GlobalChatMessage[]>>;
  let activeSessions: ReturnType<typeof signal<PokerSession[]>>;
  let publicTableRoster: ReturnType<typeof signal<PlayerPublicTableRosterEntry[]>>;

  beforeEach(async () => {
    messages = signal<GlobalChatMessage[]>([
      {
        id: 'host-message',
        senderUserId: 'host-user',
        senderDisplayName: 'Alvin Host',
        senderRole: 'HOST',
        message: 'Table is ready.',
        createdAt: '2026-07-14T05:00:00'
      },
      {
        id: 'host-follow-up',
        senderUserId: 'host-user',
        senderDisplayName: 'Alvin Host',
        senderRole: 'HOST',
        message: 'Cards are in the air.',
        createdAt: '2026-07-14T05:00:30'
      },
      {
        id: 'player-message',
        senderUserId: 'player-user',
        senderDisplayName: 'Jamie Player',
        senderRole: 'PLAYER',
        message: 'Joining now.',
        createdAt: '2026-07-14T05:01:00'
      }
    ]);
    activeSessions = signal<PokerSession[]>([
      {
        id: 'friday-session',
        name: 'Friday Night Poker',
        sessionDate: '2026-07-14',
        status: 'ACTIVE',
        createdAt: '2026-07-14T04:30:00.000Z',
        closedAt: null,
        tables: [],
        transactions: [],
        timeCalls: [],
        players: [
          {
            id: 'player-1',
            tableId: null,
            name: 'Alvin Host',
            status: 'ACTIVE',
            totalBuyIn: 100,
            cashOut: 0,
            net: -100,
            joinedAt: '2026-07-14T04:31:00.000Z',
            completedAt: null
          },
          {
            id: 'player-2',
            tableId: null,
            name: 'Jamie Player',
            status: 'ACTIVE',
            totalBuyIn: 100,
            cashOut: 0,
            net: -100,
            joinedAt: '2026-07-14T04:32:00.000Z',
            completedAt: null
          },
          {
            id: 'player-3',
            tableId: null,
            name: 'Cashed Player',
            status: 'COMPLETED',
            totalBuyIn: 100,
            cashOut: 125,
            net: 25,
            joinedAt: '2026-07-14T04:33:00.000Z',
            completedAt: '2026-07-14T05:30:00.000Z'
          }
        ]
      }
    ]);
    publicTableRoster = signal<PlayerPublicTableRosterEntry[]>([]);

    await TestBed.configureTestingModule({
      imports: [GlobalChatPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthStateService,
          useValue: {
            profile: signal({ displayName: 'Alvin Host', role: 'HOST' }),
            user: signal({ id: 'host-user' })
          }
        },
        {
          provide: GlobalChatService,
          useValue: {
            messages,
            loading: signal(false),
            sending: signal(false),
            error: signal<string | null>(null),
            sendMessage: jasmine.createSpy('sendMessage').and.resolveTo(true)
          }
        },
        {
          provide: PokerStoreService,
          useValue: {
            activeSessions,
            playerPublicTableRoster: publicTableRoster
          }
        }
      ]
    }).compileComponents();
  });

  it('shows the selected live-game banner with active and total players', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const banner = compiled.querySelector<HTMLElement>('.chat-game-banner');
    const count = compiled.querySelector<HTMLElement>('.chat-active-count strong');

    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Friday Night Poker');
    expect(count?.textContent?.trim()).toBe('2/3');
    expect(compiled.querySelector('.chat-active-count-label')?.textContent?.trim()).toBe('Active');
    expect(compiled.textContent).not.toContain('Table Talk');
  });

  it('keeps navigation controls outside the game banner and chat content', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.chat-home-link')).toBeNull();
    expect(compiled.querySelector('.chat-mobile-navigation')).toBeNull();
  });

  it('positions the shell back control at the left of the top navigation', () => {
    const backLinkRule = findStyleRuleContaining(
      ':is(app-host-shell, app-player-shell)',
      ':has(app-global-chat-page.global-chat-route)',
      '.chat-shell-back'
    );

    expect(backLinkRule).toBeDefined();
    expect(backLinkRule?.style.position).toBe('absolute');
    expect(backLinkRule?.style.top).toBe('50%');
    expect(backLinkRule?.style.left).toBe('0.75rem');
    expect(backLinkRule?.style.display).toBe('inline-grid');
    expect(backLinkRule?.style.transform).toBe('translateY(-50%)');
  });

  it('moves the live pulse across the banner and raises the game copy', () => {
    const pulseRule = findStyleRule('app-global-chat-page .chat-live-pulse');
    const gameCopyRule = findStyleRule('app-global-chat-page .chat-game-copy');

    expect(pulseRule).toBeDefined();
    expect(pulseRule?.style.animationName).toBe('chat-live-pulse-travel');
    expect(gameCopyRule).toBeDefined();
    expect(gameCopyRule?.style.transform).toBe('translateY(-0.14rem)');
  });

  it('uses the public table roster for the player-visible active and total count', () => {
    publicTableRoster.set([
      {
        sessionPlayerId: 'public-1',
        sessionId: 'friday-session',
        tableId: null,
        name: 'One',
        status: 'ACTIVE'
      },
      {
        sessionPlayerId: 'public-2',
        sessionId: 'friday-session',
        tableId: null,
        name: 'Two',
        status: 'COMPLETED'
      },
      {
        sessionPlayerId: 'public-3',
        sessionId: 'friday-session',
        tableId: null,
        name: 'Three',
        status: 'ACTIVE'
      },
      {
        sessionPlayerId: 'public-4',
        sessionId: 'friday-session',
        tableId: null,
        name: 'Four',
        status: 'COMPLETED'
      }
    ]);
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('.chat-active-count strong')
        ?.textContent?.trim()
    ).toBe('2/4');
  });

  it('does not render a game banner when there is no active game', () => {
    activeSessions.set([]);
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.chat-game-banner')
    ).toBeNull();
  });

  it('puts names and clock timestamps inside bubbles while grouping consecutive senders', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const bubbles = Array.from(compiled.querySelectorAll<HTMLElement>('.chat-bubble'));
    const senderNames = Array.from(compiled.querySelectorAll<HTMLElement>('.chat-sender-name'));
    const timestamps = Array.from(compiled.querySelectorAll<HTMLElement>('.chat-message-time'));

    expect(bubbles).toHaveSize(3);
    expect(senderNames.map((name) => name.textContent?.trim())).toEqual([
      'Alvin Host',
      'Jamie Player'
    ]);
    expect(timestamps).toHaveSize(3);
    expect(timestamps.map((time) => time.textContent?.trim())).toEqual(['05:00', '05:00', '05:01']);
    expect(timestamps.every((time) => time.closest('.chat-bubble') !== null)).toBeTrue();
    expect(compiled.querySelector('.chat-message-meta')).toBeNull();
    expect(compiled.textContent).not.toContain('HOST');
    expect(compiled.textContent).not.toContain('PLAYER');
  });

  it('renders centered date separators in the message stream', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const dateSeparators = Array.from(
      compiled.querySelectorAll<HTMLElement>('.chat-date-separator')
    );

    expect(dateSeparators).toHaveSize(1);
    expect(dateSeparators[0].querySelector('time')).not.toBeNull();

    const separatorStyle = getComputedStyle(dateSeparators[0]);
    expect(separatorStyle.position).toBe('sticky');
    expect(separatorStyle.alignSelf).toBe('center');
  });

  it('keeps each sticky date separator inside its own day group', () => {
    messages.set([
      {
        id: 'yesterday-message',
        senderUserId: 'host-user',
        senderDisplayName: 'Alvin Host',
        senderRole: 'HOST',
        message: 'Last message yesterday.',
        createdAt: '2026-07-13T23:58:00'
      },
      {
        id: 'today-message',
        senderUserId: 'player-user',
        senderDisplayName: 'Jamie Player',
        senderRole: 'PLAYER',
        message: 'First message today.',
        createdAt: '2026-07-14T00:02:00'
      }
    ]);
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const dayGroups = Array.from(compiled.querySelectorAll<HTMLElement>('.chat-day-group'));

    expect(dayGroups).toHaveSize(2);
    expect(
      dayGroups.every((group) => group.querySelectorAll(':scope > .chat-date-separator').length === 1)
    ).toBeTrue();
    expect(dayGroups.map((group) => group.querySelectorAll(':scope > .chat-message').length)).toEqual([
      1,
      1
    ]);
  });

  it('uses Saira throughout the chat and in typed composer text', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const chat = compiled.querySelector<HTMLElement>('.global-chat');
    const textarea = compiled.querySelector<HTMLTextAreaElement>('.chat-composer textarea');

    expect(getComputedStyle(chat!).fontFamily).toContain('Saira');
    expect(getComputedStyle(textarea!).fontFamily).toContain('Saira');
  });

  it('keeps chat bubbles compact with consistent space between messages', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const bubble = compiled.querySelector<HTMLElement>('.chat-bubble');
    const bubbleStyle = getComputedStyle(bubble!);

    expect(bubbleStyle.paddingTop).toBe('5.12px');
    expect(bubbleStyle.paddingRight).toBe('10.88px');
    expect(bubbleStyle.paddingBottom).toBe('5.12px');
    expect(bubbleStyle.paddingLeft).toBe('10.88px');
    expect(bubbleStyle.marginBottom).toBe('8px');
  });

  it('scrolls to the newest message after loaded messages render', async () => {
    messages.set([]);
    const fixture = TestBed.createComponent(GlobalChatPage);
    const scrollToSpy = spyOn(HTMLElement.prototype, 'scrollTo');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrollToSpy).not.toHaveBeenCalled();

    messages.set([
      {
        id: 'loaded-message',
        senderUserId: 'player-user',
        senderDisplayName: 'Jamie Player',
        senderRole: 'PLAYER',
        message: 'Latest table update.',
        createdAt: '2026-07-14T05:02:00.000Z'
      }
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const scrollOptions = scrollToSpy.calls.mostRecent()?.args[0] as ScrollToOptions | undefined;
    expect(scrollOptions).toEqual(
      jasmine.objectContaining({ behavior: 'auto' })
    );
  });

  it('keeps the mobile chat composer row sized to its content', () => {
    const rule = findStyleRule(
      ':is(app-host-shell, app-player-shell) app-global-chat-page.global-chat-route .chat-panel'
    );

    expect(rule).toBeDefined();
    expect(rule?.style.gridTemplateRows).toBe('auto minmax(0px, 1fr) max-content');
  });

  it('shares the same mobile chat panel and composer layout across host and player shells', () => {
    const panelRule = findStyleRule(
      ':is(app-host-shell, app-player-shell) app-global-chat-page.global-chat-route .chat-panel'
    );
    const composerRule = findStyleRule(
      ':is(app-host-shell, app-player-shell) app-global-chat-page.global-chat-route .chat-composer'
    );

    expect(panelRule?.style.gridTemplateRows).toBe('auto minmax(0px, 1fr) max-content');
    expect(composerRule?.style.position).toBe('relative');
    expect(composerRule?.style.bottom).toBe('auto');
  });

  it('keeps mobile shell padding off the full-screen chat route', () => {
    const outerShellRule = findStyleRule('app-host-shell > main');
    const chatShellRule = findStyleRule(
      'app-host-shell > main:has(app-global-chat-page.global-chat-route)'
    );

    expect(findStyleRule('app-host-shell main')).toBeUndefined();
    expect(outerShellRule).toBeDefined();
    expect(chatShellRule?.style.paddingBottom).toBe('0px');
  });

  it('renders non-interactive poker table decoration behind the full chat', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const decoration = compiled.querySelector<HTMLElement>('.chat-table-decor');

    expect(decoration).not.toBeNull();
    if (!decoration) {
      return;
    }

    expect(decoration.getAttribute('aria-hidden')).toBe('true');
    expect(decoration.querySelectorAll('.chat-table-suit')).toHaveSize(4);
    expect(decoration.querySelectorAll('.chat-table-chip')).toHaveSize(2);
    expect(
      Array.from(decoration.querySelectorAll<HTMLElement>('.chat-table-chip')).every(
        (chip) => chip.textContent?.trim() === ''
      )
    ).toBeTrue();
  });

  it('keeps the mobile chat route in document flow while filling the available height', () => {
    const routeRule = findStyleRule(
      ':is(app-host-shell, app-player-shell) app-global-chat-page.global-chat-route'
    );
    const composerRule = findStyleRule(
      ':is(app-host-shell, app-player-shell) app-global-chat-page.global-chat-route .chat-composer'
    );
    const routeContentRule = findStyleRule(
      'app-host-shell .pokertrack-route-content:has(> app-global-chat-page.global-chat-route)'
    );

    expect(routeRule?.style.position).toBe('relative');
    expect(routeRule?.style.height).toBe('calc(-1px - 4.25rem + 100dvh)');
    expect(routeRule?.style.top).toBe('');
    expect(routeRule?.style.bottom).toBe('');
    expect(routeContentRule?.style.padding).toBe('0px');
    expect(composerRule?.style.paddingBottom).toBe('0px');
  });

  it('hides the host mobile navigation while full-screen chat is open', () => {
    const hiddenTabsRule = findStyleRuleContaining(
      'app-host-shell > main:has(app-global-chat-page.global-chat-route)',
      '.host-mobile-tabs'
    );

    expect(hiddenTabsRule).toBeDefined();
    expect(hiddenTabsRule?.style.display).toBe('none');
  });

  it('uses an icon-only send action inside the bottom message field', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const composer = compiled.querySelector<HTMLElement>('.chat-composer');
    const field = composer?.querySelector<HTMLElement>('.chat-composer-field');
    const sendButton = field?.querySelector<HTMLButtonElement>('button[type="submit"]');

    expect(field).not.toBeNull();
    expect(sendButton?.getAttribute('aria-label')).toBe('Send message');
    expect(sendButton?.textContent?.trim()).toBe('');
    expect(composer?.querySelector('.composer-footer')).toBeNull();
    expect(composer?.textContent).not.toContain('0/500');
  });

  it('vertically centers the send action inside the message field', () => {
    const fixture = TestBed.createComponent(GlobalChatPage);
    fixture.detectChanges();
    const sendButtonRule = findStyleRuleContaining('.chat-composer-field', 'button');

    expect(sendButtonRule?.style.top).toBe('50%');
    expect(sendButtonRule?.style.bottom).toBe('');
    expect(sendButtonRule?.style.transform).toBe('translateY(-50%)');
  });
});
