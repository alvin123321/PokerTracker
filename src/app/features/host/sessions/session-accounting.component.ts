import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import {
  LucideChevronDown,
  LucideEllipsis,
  LucidePencil,
  LucidePlus,
  LucideTrash2
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import {
  PokerSession,
  PokerStoreService,
  RegisteredPlayerOption,
  SessionFinancialEntry
} from '../data/poker-store.service';
import {
  managerTipTotals,
  sessionAccountingTotals,
  visibleSessionFinancialEntries
} from '../data/session-accounting.logic';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData
} from '../shared/confirmation-dialog.component';
import {
  SessionFinancialEntryDialogComponent,
  SessionFinancialEntryDialogData,
  SessionFinancialEntryDialogResult
} from './session-financial-entry-dialog.component';

@Component({
  selector: 'app-session-accounting',
  imports: [
    CurrencyPipe,
    DatePipe,
    LucideChevronDown,
    LucideEllipsis,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    MatDialogModule,
    MatMenuModule
  ],
  template: `
    @if (busy()) {
      <div
        class="pokertrack-sync-overlay fixed inset-0 z-50 grid place-items-center bg-neutral-950/55 px-6 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div
          class="rounded-xl border border-emerald-300/20 bg-neutral-950/95 px-6 py-5 text-center shadow-2xl shadow-black/50"
        >
          <div class="deck-shuffle mx-auto mb-4" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p class="text-base font-semibold text-white">{{ loadingMessage() }}</p>
          <p class="mt-1 text-sm text-neutral-400">Updating session accounting.</p>
        </div>
      </div>
    }

    <section class="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
      <div class="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        @if (isHostAdmin()) {
          <button
            type="button"
            class="accounting-toggle flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
            [attr.aria-expanded]="detailsVisible()"
            (click)="toggleDetails()"
          >
            <span class="block text-base font-semibold text-white">Tips & rake</span>
            <svg
              lucideChevronDown
              [strokeWidth]="2.2"
              class="h-5 w-5 shrink-0 text-neutral-400 transition-transform duration-300"
              [class.rotate-180]="detailsVisible()"
              aria-hidden="true"
            ></svg>
          </button>
        } @else {
          <div class="min-w-0 flex-1">
            <span class="block text-base font-semibold text-white">Tips & rake</span>
            <span class="mt-0.5 block text-xs text-neutral-500">Your session accounting</span>
          </div>
        }
        @if (canManage()) {
          <button
            type="button"
            [disabled]="busy()"
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/30 text-emerald-200 transition hover:bg-emerald-400/10 disabled:opacity-50"
            aria-label="Add tips or rake"
            title="Add tips or rake"
            (click)="openAddDialog()"
          >
            <svg lucidePlus [strokeWidth]="2.4" aria-hidden="true"></svg>
          </button>
        }
      </div>

      <div
        class="accounting-details grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
        [attr.aria-hidden]="!detailsVisible()"
        [style.grid-template-rows]="detailsVisible() ? '1fr' : '0fr'"
        [style.pointer-events]="detailsVisible() ? 'auto' : 'none'"
      >
        <div class="min-h-0">
          <div
            class="transition-opacity duration-300"
            [class.opacity-0]="!detailsVisible()"
            [class.opacity-100]="detailsVisible()"
          >
            <div class="grid grid-cols-2 border-b border-white/10">
              <div class="border-r border-white/10 px-4 py-3">
                <p class="text-xs font-semibold uppercase text-emerald-300">
                  {{ isHostAdmin() ? 'Total tips' : 'My tips' }}
                </p>
                <p class="mt-1 text-xl font-semibold text-white">
                  {{ totals().tipTotal | currency: 'USD' : 'symbol' : '1.0-2' }}
                </p>
              </div>
              <div class="px-4 py-3">
                <p class="text-xs font-semibold uppercase text-sky-300">
                  {{ isHostAdmin() ? 'Total rake' : 'Rake' }}
                </p>
                <p class="mt-1 text-xl font-semibold text-white">
                  {{ totals().rakeTotal | currency: 'USD' : 'symbol' : '1.0-2' }}
                </p>
              </div>
            </div>

            @if (isHostAdmin() && managerTotals().length > 0) {
              <div class="grid gap-px border-b border-white/10 bg-white/10 sm:grid-cols-2">
                @for (managerTotal of managerTotals(); track managerTotal.managerUserId) {
                  <div
                    class="flex items-center justify-between gap-3 bg-neutral-950/90 px-4 py-2.5"
                  >
                    <span class="min-w-0 truncate text-sm text-neutral-300">
                      {{ managerTotal.managerName }} tips
                    </span>
                    <strong class="shrink-0 text-sm text-emerald-200">
                      {{ managerTotal.amount | currency: 'USD' : 'symbol' : '1.0-2' }}
                    </strong>
                  </div>
                }
              </div>
            }

            @if (errorMessage()) {
              <p class="border-b border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {{ errorMessage() }}
              </p>
            }

            <div class="divide-y divide-white/10">
        @for (entry of entries(); track entry.id) {
          <article
            class="px-4 py-3"
            [class.bg-neutral-950/40]="entry.deletedAt"
            [class.opacity-60]="entry.deletedAt"
          >
            <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class="text-xs font-semibold uppercase"
                    [class.text-emerald-300]="entry.entryType === 'TIP'"
                    [class.text-sky-300]="entry.entryType === 'RAKE'"
                    [class.line-through]="entry.deletedAt"
                  >
                    {{ entry.entryType }}
                  </span>
                  @if (entry.entryType === 'TIP' && entry.managerName) {
                    <span class="truncate text-sm text-neutral-300">{{ entry.managerName }}</span>
                  }
                </div>
                <p
                  class="mt-1 text-xs text-neutral-500"
                  [class.line-through]="entry.deletedAt"
                >
                  Added by {{ entry.createdByName }} · {{ entry.createdAt | date: 'short' }}
                </p>
                @if (entry.deletedAt && entry.revisions.length === 0) {
                  <p class="mt-1 text-xs text-neutral-500">
                    Deleted by {{ entry.deletedByName }} · {{ entry.deletedAt | date: 'short' }}
                  </p>
                } @else if (entry.revisions.length > 0) {
                  <button
                    type="button"
                    class="accounting-revision-trigger mt-1 block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[9px] transition hover:text-white"
                    style="font-size: 9px"
                    [class.text-neutral-500]="entry.deletedAt"
                    [class.text-amber-200/80]="!entry.deletedAt"
                    [attr.aria-expanded]="revisionsExpanded(entry.id)"
                    (click)="toggleRevisions(entry.id)"
                  >
                    @if (entry.deletedAt) {
                      Deleted by {{ entry.deletedByName }} ·
                      {{ entry.deletedAt | date: 'short' }}
                    } @else {
                      Last edited by {{ entry.updatedByName }} ·
                      {{ entry.updatedAt | date: 'short' }}
                    }
                  </button>
                }
              </div>
              <strong
                class="text-lg text-white"
                [class.line-through]="entry.deletedAt"
                [class.text-neutral-500]="entry.deletedAt"
              >
                {{ entry.amount | currency: 'USD' : 'symbol' : '1.0-2' }}
              </strong>
              @if (canManage() && !entry.deletedAt) {
                <button
                  type="button"
                  [disabled]="busy()"
                  [matMenuTriggerFor]="entryMenu"
                  class="grid h-9 w-9 place-items-center rounded-md text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Open actions for {{ entry.entryType.toLowerCase() }} entry"
                  title="Entry actions"
                >
                  <svg lucideEllipsis [strokeWidth]="2.2" aria-hidden="true"></svg>
                </button>
                <mat-menu #entryMenu="matMenu" class="mini-game-menu" xPosition="before">
                  <button type="button" mat-menu-item (click)="openEditDialog(entry)">
                    <svg lucidePencil [strokeWidth]="2" aria-hidden="true"></svg>
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    mat-menu-item
                    class="mini-menu-danger"
                    (click)="confirmDelete(entry)"
                  >
                    <svg lucideTrash2 [strokeWidth]="2" aria-hidden="true"></svg>
                    <span>Delete</span>
                  </button>
                </mat-menu>
              } @else {
                <span></span>
              }
            </div>

            @if (entry.revisions.length > 0) {
              <div
                class="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
                [style.grid-template-rows]="revisionsExpanded(entry.id) ? '1fr' : '0fr'"
              >
                <div class="min-h-0">
                  <div
                    class="mt-2 space-y-1 border-l border-white/10 pl-3 transition-opacity duration-300"
                    [class.opacity-0]="!revisionsExpanded(entry.id)"
                    [class.opacity-100]="revisionsExpanded(entry.id)"
                  >
                    @for (revision of entry.revisions; track revision.id) {
                      <p class="text-xs text-neutral-500">
                        <span class="line-through">
                          {{ revision.amount | currency: 'USD' : 'symbol' : '1.0-2' }}
                        </span>
                        · Edited by {{ revision.actionByName }} ·
                        {{ revision.actionAt | date: 'short' }}
                      </p>
                    }
                  </div>
                </div>
              </div>
            }
          </article>
        } @empty {
          <p class="px-4 py-6 text-center text-sm text-neutral-500">
            No tips or rake recorded.
          </p>
        }
          </div>
        </div>
      </div>
      </div>
    </section>
  `
})
export class SessionAccountingComponent implements OnInit {
  readonly session = input.required<PokerSession>();

  private readonly store = inject(PokerStoreService);
  private readonly authState = inject(AuthStateService);
  private readonly dialog = inject(MatDialog);
  protected readonly busy = signal(false);
  protected readonly loadingMessage = signal('Updating...');
  protected readonly errorMessage = signal<string | null>(null);
  private readonly detailsExpanded = signal(false);
  private readonly expandedRevisionEntryIds = signal<string[]>([]);
  private readonly managerOptions: RegisteredPlayerOption[] = [];
  private managerOptionsLoaded = false;
  private managerOptionsPromise: Promise<RegisteredPlayerOption[]> | null = null;
  protected readonly isHostAdmin = this.authState.isHostAdmin;
  protected readonly entries = computed(() =>
    visibleSessionFinancialEntries(
      this.session().financialEntries ?? [],
      this.authState.role(),
      this.authState.user()?.id ?? null
    )
  );
  protected readonly totals = computed(() => sessionAccountingTotals(this.entries()));
  protected readonly managerTotals = computed(() => managerTipTotals(this.entries()));
  protected readonly detailsVisible = computed(
    () => !this.isHostAdmin() || this.detailsExpanded()
  );
  protected readonly canManage = computed(
    () => this.isHostAdmin() || this.session().status === 'ACTIVE'
  );

  ngOnInit(): void {
    if (this.isHostAdmin()) {
      void this.loadManagerOptions().catch(() => undefined);
    }
  }

  protected toggleDetails(): void {
    if (this.isHostAdmin()) {
      this.detailsExpanded.update((expanded) => !expanded);
    }
  }

  protected revisionsExpanded(entryId: string): boolean {
    return this.expandedRevisionEntryIds().includes(entryId);
  }

  protected toggleRevisions(entryId: string): void {
    this.expandedRevisionEntryIds.update((entryIds) =>
      entryIds.includes(entryId)
        ? entryIds.filter((currentEntryId) => currentEntryId !== entryId)
        : [...entryIds, entryId]
    );
  }

  protected async openAddDialog(): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.errorMessage.set(null);

    try {
      const managers = this.isHostAdmin() ? this.managerOptions : [];
      if (this.isHostAdmin()) {
        void this.loadManagerOptions().catch((error) => {
          this.errorMessage.set(this.messageFrom(error));
          this.detailsExpanded.set(true);
        });
      }

      const result = await this.openDialog({
        mode: 'add',
        isHostAdmin: this.isHostAdmin(),
        currentUserId: this.authState.user()?.id ?? '',
        managers
      });

      if (!result) {
        return;
      }

      await this.runAction(
        result.entryType === 'TIP' ? 'Recording tips...' : 'Recording rake...',
        () =>
          this.store.recordSessionFinancialEntry(
            this.session().id,
            result.entryType,
            result.amount,
            result.managerUserId
          )
      );
    } catch (error) {
      this.busy.set(false);
      this.errorMessage.set(this.messageFrom(error));
      this.detailsExpanded.set(true);
    }
  }

  protected async openEditDialog(entry: SessionFinancialEntry): Promise<void> {
    const result = await this.openDialog({
      mode: 'edit',
      entry,
      isHostAdmin: this.isHostAdmin(),
      currentUserId: this.authState.user()?.id ?? '',
      managers: []
    });

    if (!result) {
      return;
    }

    await this.runAction(
      `Updating ${entry.entryType.toLowerCase()}...`,
      () => this.store.updateSessionFinancialEntry(this.session().id, entry.id, result.amount)
    );
  }

  protected async confirmDelete(entry: SessionFinancialEntry): Promise<void> {
    const data: ConfirmationDialogData = {
      title: `Delete ${entry.entryType.toLowerCase()} entry?`,
      message: 'The amount will be removed from totals and retained in the accounting history.',
      confirmLabel: 'Delete entry',
      tone: 'danger',
      details: [entry.managerName ?? entry.entryType]
    };
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
          ConfirmationDialogComponent,
          { data, panelClass: 'pokertrack-dialog-panel' }
        )
        .afterClosed()
    );

    if (confirmed) {
      await this.runAction(
        `Deleting ${entry.entryType.toLowerCase()}...`,
        () => this.store.deleteSessionFinancialEntry(this.session().id, entry.id)
      );
    }
  }

  private openDialog(
    data: SessionFinancialEntryDialogData
  ): Promise<SessionFinancialEntryDialogResult | undefined> {
    return firstValueFrom(
      this.dialog
        .open<
          SessionFinancialEntryDialogComponent,
          SessionFinancialEntryDialogData,
          SessionFinancialEntryDialogResult
        >(SessionFinancialEntryDialogComponent, {
          data,
          autoFocus: 'first-tabbable',
          panelClass: 'pokertrack-dialog-panel'
        })
        .afterClosed()
    );
  }

  private async runAction(message: string, task: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }

    this.loadingMessage.set(message);
    this.busy.set(true);
    this.errorMessage.set(null);
    const startedAt = Date.now();

    try {
      await task();
    } catch (error) {
      this.errorMessage.set(this.messageFrom(error));
      this.detailsExpanded.set(true);
    } finally {
      await this.waitForMinimumActionDelay(startedAt);
      this.busy.set(false);
    }
  }

  private loadManagerOptions(): Promise<RegisteredPlayerOption[]> {
    if (this.managerOptionsLoaded) {
      return Promise.resolve(this.managerOptions);
    }

    if (this.managerOptionsPromise) {
      return this.managerOptionsPromise;
    }

    this.managerOptionsPromise = this.store
      .listRegisteredPlayers()
      .then((players) => {
        this.managerOptions.splice(
          0,
          this.managerOptions.length,
          ...players.filter((player) => player.role === 'MANAGER')
        );
        this.managerOptionsLoaded = true;
        return this.managerOptions;
      })
      .catch((error) => {
        this.managerOptionsPromise = null;
        throw error;
      });

    return this.managerOptionsPromise;
  }

  private waitForMinimumActionDelay(startedAt: number): Promise<void> {
    const remainingMs = Math.max(0, 750 - (Date.now() - startedAt));

    return remainingMs > 0
      ? new Promise((resolve) => window.setTimeout(resolve, remainingMs))
      : Promise.resolve();
  }

  private messageFrom(error: unknown): string {
    return error instanceof Error ? error.message : 'Unable to update session accounting.';
  }
}
