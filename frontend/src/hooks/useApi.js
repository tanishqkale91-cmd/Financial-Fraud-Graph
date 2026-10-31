import { useState, useEffect, useCallback, useRef } from 'react';
import { client } from '../api/client';

export function useApi(apiFn, initialParams = null, autoFetch = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const paramsRef = useRef(initialParams);

  // Keep paramsRef up to date with deep comparison via JSON serialization
  const paramsKey = JSON.stringify(initialParams);
  useEffect(() => {
    paramsRef.current = initialParams;
  }, [paramsKey]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (overrideParams) => {
      const activeParams = overrideParams !== undefined ? overrideParams : paramsRef.current;
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await apiFn(activeParams);
        if (isMountedRef.current) {
          setData(result);
        }
        return result;
      } catch (err) {
        const errMsg = err?.response?.data?.detail || err?.message || 'API request failed';
        if (isMountedRef.current) {
          setError(errMsg);
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [apiFn]
  );

  useEffect(() => {
    if (autoFetch) {
      execute().catch(() => {
        // Error is already captured in state; prevent unhandled rejection in console
      });
    }
  }, [autoFetch, execute, paramsKey]);

  const clearError = useCallback(() => setError(null), []);

  return {
    data,
    loading,
    error,
    setData,
    clearError,
    refetch: execute,
  };
}

export { client };
