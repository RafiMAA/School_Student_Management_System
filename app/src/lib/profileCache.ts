export interface ProfileData {
  full_name?: string;
  email?: string;
  contact?: string;
  address?: string;
  assigned_class?: string | null;
}

interface CachedProfile {
  userId: string;
  profile: ProfileData;
  cachedAt: number;
}

const PROFILE_CACHE_PREFIX = 'ahadiya-profile-v1:';

export function readCachedProfile(userId?: string): ProfileData | undefined {
  if (!userId) return undefined;
  try {
    const value = JSON.parse(localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`) || 'null') as CachedProfile | null;
    return value?.userId === userId && value.profile && typeof value.profile === 'object'
      ? value.profile
      : undefined;
  } catch {
    return undefined;
  }
}

export function cacheProfile(userId: string | undefined, profile: ProfileData) {
  if (!userId) return;
  try {
    const value: CachedProfile = { userId, profile, cachedAt: Date.now() };
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify(value));
  } catch {
    // The in-memory query cache still provides fast repeat navigation.
  }
}

export function profileForm(profile: ProfileData | undefined, fallbackEmail = '') {
  return {
    full_name: profile?.full_name || '',
    email: profile?.email || fallbackEmail,
    contact: profile?.contact || '',
    address: profile?.address || '',
  };
}
