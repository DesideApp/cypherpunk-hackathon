// Hook para obtener preview de links desde el backend
// Maneja el estado de carga y errores

import { useState, useEffect } from 'react';
import { apiRequest } from '@shared/services/apiService.js';

/**
 * Hook para obtener preview de un link
 * @param {string} url - URL del link a previsualizar
 * @returns {Object} - Estado del preview
 */
export function useLinkPreview(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      return;
    }

    let abort = false;
    setLoading(true);
    setError(null);

    const fetchPreview = async () => {
      try {
        const response = await apiRequest(`/api/v1/link-preview?url=${encodeURIComponent(url)}`, {
          method: 'GET'
        });

        if (!abort) {
          if (response.success) {
            setData(response.data);
            setError(null);
          } else {
            setError(response.error || 'Failed to get preview');
            setData(null);
          }
        }
      } catch (err) {
        if (!abort) {
          setError(err.message || 'Failed to get preview');
          setData(null);
        }
      } finally {
        if (!abort) {
          setLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      abort = true;
    };
  }, [url]);

  return { data, loading, error };
}

/**
 * Hook para obtener preview de múltiples links
 * @param {Array} urls - Array de URLs a previsualizar
 * @returns {Object} - Estado de los previews
 */
export function useMultipleLinkPreviews(urls) {
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!urls || urls.length === 0) {
      setPreviews({});
      setError(null);
      return;
    }

    let abort = false;
    setLoading(true);
    setError(null);

    const fetchAllPreviews = async () => {
      try {
        const promises = urls.map(async (url) => {
          try {
            const response = await apiRequest(`/api/v1/link-preview?url=${encodeURIComponent(url)}`, {
              method: 'GET'
            });
            return { url, data: response.success ? response.data : null, error: response.error };
          } catch (err) {
            return { url, data: null, error: err.message };
          }
        });

        const results = await Promise.all(promises);
        
        if (!abort) {
          const previewsMap = {};
          results.forEach(result => {
            previewsMap[result.url] = result.data;
          });
          setPreviews(previewsMap);
          setError(null);
        }
      } catch (err) {
        if (!abort) {
          setError(err.message || 'Failed to get previews');
        }
      } finally {
        if (!abort) {
          setLoading(false);
        }
      }
    };

    fetchAllPreviews();

    return () => {
      abort = true;
    };
  }, [urls]);

  return { previews, loading, error };
}

