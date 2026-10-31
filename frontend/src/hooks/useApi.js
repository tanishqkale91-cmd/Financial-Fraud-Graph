import { useState, useEffect, useCallback } from 'react';
import { client } from '../api/client';

export function useApi(apiFn, initialParams = null, autoFetch = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (params = initialParams) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(params);
        setData(result);
        return result;
      } catch (err) {
        setError(err.message || 'API request failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFn, initialParams]
  );

  useEffect(() => {
    if (autoFetch) {
      execute();
    }
  }, [autoFetch, execute]);

  return { data, loading, error, refetch: execute };
}

export { client };
