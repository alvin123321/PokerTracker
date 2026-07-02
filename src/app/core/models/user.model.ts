export type UserRole = 'HOST' | 'PLAYER';

export interface UserProfile {
  id: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}
