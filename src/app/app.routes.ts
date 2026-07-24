import { Routes } from '@angular/router';

import { loginGuard } from './core/auth/auth.guard';
import { hostAdminGuard, hostGuard, playerGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    canMatch: [loginGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'host',
    canMatch: [hostGuard],
    loadComponent: () =>
      import('./core/layout/host-shell.component').then((m) => m.HostShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/host/dashboard/host-dashboard.page').then((m) => m.HostDashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/global-chat.page').then((m) => m.GlobalChatPage),
      },
      {
        path: 'session-overview',
        loadComponent: () =>
          import('./features/host/overview/session-overview.page').then(
            (m) => m.SessionOverviewPage,
          ),
      },
      {
        path: 'pot-calculator',
        loadComponent: () =>
          import('./features/host/tools/pot-calculator.page').then((m) => m.PotCalculatorPage),
      },
      {
        path: 'sessions/new',
        canMatch: [hostAdminGuard],
        loadComponent: () =>
          import('./features/host/sessions/new-session.page').then((m) => m.NewSessionPage),
      },
      {
        path: 'players',
        canMatch: [hostAdminGuard],
        loadComponent: () =>
          import('./features/host/players/players-admin.page').then((m) => m.PlayersAdminPage),
      },
      {
        path: 'sessions/history',
        canMatch: [hostAdminGuard],
        loadComponent: () =>
          import('./features/host/sessions/session-history.page').then((m) => m.SessionHistoryPage),
      },
      {
        path: 'mini-games/:id',
        loadComponent: () =>
          import('./features/mini-game/mini-game-detail.page').then((m) => m.MiniGameDetailPage),
      },
      {
        path: 'sessions/:sessionId/summary',
        canMatch: [hostAdminGuard],
        loadComponent: () =>
          import('./features/host/sessions/session-summary.page').then((m) => m.SessionSummaryPage),
      },
      {
        path: 'sessions/:sessionId',
        loadComponent: () =>
          import('./features/host/sessions/active-session.page').then((m) => m.ActiveSessionPage),
      },
    ],
  },
  {
    path: 'player',
    canMatch: [playerGuard],
    loadComponent: () =>
      import('./core/layout/player-shell.component').then((m) => m.PlayerShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/player/dashboard/player-dashboard.page').then(
            (m) => m.PlayerDashboardPage,
          ),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'mini-games/:id',
        loadComponent: () =>
          import('./features/mini-game/mini-game-detail.page').then((m) => m.MiniGameDetailPage),
      },
      {
        path: 'sessions/:sessionId',
        loadComponent: () =>
          import('./features/player/sessions/player-session-detail.page').then(
            (m) => m.PlayerSessionDetailPage,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
