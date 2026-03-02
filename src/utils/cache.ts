import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'nutriu_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (ajusta según necesites)

export const cacheSet = async (key: string, value: any) => {
  try {
    const data = {
      value,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Error guardando caché:', e);
  }
};

export const cacheGet = async (key: string) => {
  try {
    const json = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!json) return null;

    const data = JSON.parse(json);
    const age = Date.now() - data.timestamp;

    if (age > CACHE_TTL) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return data.value;
  } catch (e) {
    console.warn('Error leyendo caché:', e);
    return null;
  }
};

export const cacheRemove = async (key: string) => {
  await AsyncStorage.removeItem(CACHE_PREFIX + key);
};

export const cacheClearAll = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
  await AsyncStorage.multiRemove(cacheKeys);
};