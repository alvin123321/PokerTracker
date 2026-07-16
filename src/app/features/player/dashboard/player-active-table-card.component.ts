import { Component, input } from '@angular/core';

import type { PlayerActiveTable } from '../../host/data/poker-store.service';

@Component({
  selector: 'app-player-active-table-card',
  template: `
    <article class="player-active-table-card">
      <div class="player-active-table-status">
        <span class="status-live-dot" aria-hidden="true"></span>
        <span>Active table</span>
      </div>
      <div class="player-active-table-identity">
        <h2 class="player-active-table-name">{{ table().tableName }}</h2>
        <p>{{ table().sessionName }} &middot; Table {{ table().tableNumber }}</p>
      </div>
      <span class="player-active-table-waiting">Waiting to be seated</span>
    </article>
  `,
  styles: [
    `
      .player-active-table-card {
        display: grid;
        gap: 0.65rem;
        min-width: 0;
        border: 1px solid rgb(34 197 94 / 0.34);
        border-radius: 8px;
        background: rgb(20 83 45 / 0.18);
        color: rgb(220 252 231);
        padding: 0.9rem;
      }

      .player-active-table-status {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: rgb(134 239 172);
        font-size: 0.78rem;
        font-weight: 760;
      }

      .status-live-dot {
        width: 0.5rem;
        height: 0.5rem;
        flex: 0 0 0.5rem;
        border-radius: 999px;
        background: rgb(74 222 128);
        box-shadow: 0 0 0.5rem rgb(74 222 128 / 0.72);
      }

      .player-active-table-identity {
        display: grid;
        gap: 0.2rem;
        min-width: 0;
      }

      .player-active-table-name,
      .player-active-table-identity p {
        margin: 0;
        overflow-wrap: anywhere;
      }

      .player-active-table-name {
        color: white;
        font-size: 1rem;
        font-weight: 760;
      }

      .player-active-table-identity p {
        color: rgb(187 247 208);
        font-size: 0.84rem;
        line-height: 1.35;
      }

      .player-active-table-waiting {
        color: rgb(134 239 172);
        font-size: 0.82rem;
        font-weight: 700;
      }
    `
  ]
})
export class PlayerActiveTableCardComponent {
  readonly table = input.required<PlayerActiveTable>();
}
