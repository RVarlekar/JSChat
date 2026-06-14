import { getStoreSettings, updateStoreSettings, type StoreSettings } from '../db/queries';
import { getCache, setCache, invalidateCache } from './cache.service';

const SETTINGS_CACHE_KEY = 'config:settings';
const CACHE_TTL = 3600; // 1 hour TTL

export async function getStoreSettingsCached(): Promise<StoreSettings> {
  const cached = await getCache(SETTINGS_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as StoreSettings;
    } catch (err) {
      console.warn(`[Redis] Failed to parse cached store settings: ${err}`);
    }
  }

  const settings = await getStoreSettings();
  await setCache(SETTINGS_CACHE_KEY, JSON.stringify(settings), CACHE_TTL);
  return settings;
}

export async function updateStoreSettingsCached(
  settings: Partial<StoreSettings>
): Promise<StoreSettings> {
  const updated = await updateStoreSettings(settings);
  await invalidateCache(SETTINGS_CACHE_KEY);
  return updated;
}
