import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Church, City, County, Priest } from './types';

/** Hämtar data från en URL och ger tillbaka data, fel och en reload-funktion. */
export function useData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.get<T>(url));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export const useCounties = () => useData<County[]>('/api/counties');
export const useCities = () => useData<City[]>('/api/cities');
export const useChurches = () => useData<Church[]>('/api/churches');
export const usePriests = () => useData<Priest[]>('/api/priests');
