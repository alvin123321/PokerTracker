export type UserRole = 'HOST' | 'MANAGER' | 'PLAYER';

export interface UserProfile {
  id: string;
  displayName: string | null;
  role: UserRole;
  managerHostId?: string | null;
  createdAt: string;
  updatedAt: string;
}
