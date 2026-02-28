import { apiClient } from './client';
import type { UserProfile } from './types';

export function fetchUserProfile(): Promise<UserProfile> {
  return apiClient<UserProfile>('/users/me');
}
