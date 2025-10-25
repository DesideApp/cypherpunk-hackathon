// frontend/src/features/messaging/ui/TokenSearch.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@shared/services/apiService.js';
import { formatSmartPrice } from '@shared/utils/priceFormatter.js';
import { UiSearchInput } from '@shared/ui/UiSearchInput.jsx';
import './TokenSearch.css';

const REMOTE_RESULTS_LIMIT = 5;

const resolveTokenCode = (token = {}) =>
  token?.code || token?.symbol || token?.label || token?.mint || token?.searchQuery || '';

const getTokenKey = (token = {}) => {
  const source =
    token?.mint ||
    resolveTokenCode(token) ||
    token?.label ||
    '';
  return source ? String(source).toLowerCase() : '';
};

const mergeMatches = (localMatches = [], remoteMatches = [], remoteLimit = REMOTE_RESULTS_LIMIT) => {
  const seen = new Set();
  const combined = [];

  const appendIfNew = (token, isRemote = false, remoteCounter = { count: 0 }) => {
    if (isRemote && remoteCounter.count >= remoteLimit) {
      return;
    }

    const key = getTokenKey(token);
    if (key && seen.has(key)) {
      return;
    }

    if (key) {
      seen.add(key);
    }

    combined.push(token);
    if (isRemote) {
      remoteCounter.count += 1;
    }
  };

  const remoteCounter = { count: 0 };
  localMatches.forEach((token) => appendIfNew(token));
  remoteMatches.forEach((token) => appendIfNew(token, true, remoteCounter));

  return combined;
};

const createNotFoundResult = (query = '') => ({
  code: query,
  label: `"${query}" no encontrado`,
  found: false,
  isNew: true,
  notFound: true,
  searchQuery: query,
});

export default function TokenSearch({ 
  onTokenSelect, 
  onTokenAdd, 
  availableTokens = [],
  className = '' 
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const activeRequestIdRef = useRef(0);

  const getLocalMatches = useCallback((query = '') => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return availableTokens
      .filter((token) => {
        const code = token.code?.toLowerCase() || '';
        const label = token.label?.toLowerCase() || '';
        return code.includes(normalizedQuery) || label.includes(normalizedQuery);
      })
      .map((token) => ({
        ...token,
        found: true,
        isNew: false,
      }));
  }, [availableTokens]);

  // Función de búsqueda (definida ANTES del useEffect que la usa)
  const searchTokens = useCallback(async (query) => {
    const normalizedQuery = query.trim();
    const currentRequestId = ++activeRequestIdRef.current;

    if (!normalizedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const localMatches = getLocalMatches(normalizedQuery);
    setResults(localMatches);

    const upperQuery = normalizedQuery.toUpperCase();
    let remoteMatches = [];
    let fallbackResult = null;

    try {
      const response = await apiRequest('/api/v1/tokens/search', {
        method: 'POST',
        body: JSON.stringify({ code: upperQuery }),
      });

      if (response?.success && response?.found) {
        if (response.multiple) {
          remoteMatches = (response.tokens || []).map((token) => {
            const tokenCode = resolveTokenCode(token);
            return {
              ...token,
              code: tokenCode,
              label: token.label || token.name || tokenCode,
              found: false,
              isNew: true,
              isMultiple: true,
            };
          });
        } else if (response.token) {
          remoteMatches = [{
            ...response.token,
            code: resolveTokenCode(response.token),
            label: response.token.label || response.token.name || resolveTokenCode(response.token),
            found: false,
            isNew: true,
          }];
        }
      } else if (localMatches.length === 0) {
        fallbackResult = createNotFoundResult(upperQuery);
      }
    } catch (error) {
      console.error('Error searching tokens:', error);
      if (localMatches.length === 0) {
        fallbackResult = createNotFoundResult(upperQuery);
      }
    }

    if (remoteMatches.length === 0 && localMatches.length === 0 && !fallbackResult) {
      fallbackResult = createNotFoundResult(upperQuery);
    }

    if (activeRequestIdRef.current !== currentRequestId) {
      return;
    }

    const mergedResults = mergeMatches(localMatches, remoteMatches);
    if (mergedResults.length > 0) {
      setResults(mergedResults);
    } else if (fallbackResult) {
      setResults([fallbackResult]);
    } else {
      setResults([]);
    }

    setIsSearching(false);
  }, [getLocalMatches]);

  // Búsqueda en tiempo real (useEffect DESPUÉS de searchTokens)
  useEffect(() => {
    const trimmedSearch = search.trim();

    if (trimmedSearch.length >= 1) {
      setIsSearching(true);
      searchTokens(trimmedSearch);
    } else {
      activeRequestIdRef.current += 1;
      setResults((prev) => (prev.length ? [] : prev));
      setIsSearching(false);
    }
  }, [search, searchTokens]);

  const handleAddToken = async (token) => {
    setIsAdding(true);
    try {
      // Si el token tiene mint, usarlo directamente
      const tokenCode = resolveTokenCode(token);

      if (token.mint) {
        const response = await apiRequest('/api/v1/tokens/add', {
          method: 'POST',
          body: JSON.stringify({ 
            mint: token.mint,
            code: tokenCode,
          }),
        });

        if (response.success) {
          // Token añadido exitosamente
          onTokenAdd?.(response.token);
          setSearch(''); // Limpiar búsqueda
          setResults([]);
          // Mostrar éxito
          alert(`✅ Token ${tokenCode} added successfully`);
        } else {
          throw new Error(response.message || 'Failed to add token');
        }
      } else if (token.notFound) {
        // Token no encontrado - pedir CA manualmente con mejor UX
        const ca = prompt(
          `🔍 Token "${token.searchQuery}" not found in Jupiter.\n\n` +
          `To add this token, we need its Contract Address (CA).\n\n` +
          `Example: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263\n\n` +
          `Enter the token's CA:`
        );
        
        if (ca && ca.trim()) {
          // Validar formato básico del CA
          const caTrimmed = ca.trim();
          if (caTrimmed.length < 32 || caTrimmed.length > 44) {
            throw new Error('Invalid Contract Address. Must be between 32 and 44 characters.');
          }
          
          const response = await apiRequest('/api/v1/tokens/add', {
            method: 'POST',
            body: JSON.stringify({ 
              mint: caTrimmed,
              code: token.searchQuery,
            }),
          });

          if (response.success) {
            onTokenAdd?.(response.token);
            setSearch('');
            setResults([]);
            alert(`✅ Token ${token.searchQuery} added successfully\n\n` +
                  `📊 ${response.token.label}\n` +
                  `💰 Max: ${response.token.maxAmount.toLocaleString()}\n` +
                  `🔗 CA: ${response.token.mint.slice(0, 8)}...${response.token.mint.slice(-8)}`);
          } else {
            throw new Error(response.message || 'Failed to add token');
          }
        }
      } else {
        throw new Error('Token mint not available');
      }
    } catch (error) {
      console.error('Error adding token:', error);
      // Mostrar error al usuario
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleTokenSelect = (token) => {
    if (token.found) {
      onTokenSelect?.(token);
      setSearch(''); // Limpiar búsqueda
      setResults([]);
    }
  };

  return (
    <div className={`token-search ${className}`}>
      <div className="token-search__input-container">
        <UiSearchInput
          placeholder="Buscar token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isAdding}
          icon={null}
          className="token-search__input-wrapper"
        />
        {isSearching && (
          <div className="token-search__spinner">
            <div className="spinner"></div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="token-search__results">
          {results.map((token, index) => {
            const displayCode = resolveTokenCode(token);
            const key = `${displayCode || token.mint || 'token'}-${index}`;
            return (
              <div
                key={key}
                className={`token-search__result ${
                  token.found ? 'token-search__result--found' : 'token-search__result--not-found'
                }`}
                onClick={() => handleTokenSelect(token)}
              >
                <div className="token-search__result-content">
                  <div className="token-search__result-icon">
                    {token.found ? '✅' : '❌'}
                  </div>
                  <div className="token-search__result-info">
                    <div className="token-search__result-code">{displayCode}</div>
                    <div className="token-search__result-label">
                      {token.found ? token.label : 
                       token.isMultiple ? `${token.name || token.label} (Jupiter)` :
                       token.notFound ? `"${token.searchQuery}" not found` :
                       'Token not found'}
                    </div>
                    {token.isNew && !token.notFound && (
                      <div className="token-search__result-meta">
                        {token.verified ? '✅ Verified' : '⚠️ Unverified'} • 
                        {token.matchType && (
                          <span className={`match-type match-type--${token.matchType}`}>
                            {token.matchType === 'exact_symbol' ? '🎯 Exact Symbol' :
                             token.matchType === 'exact_name' ? '🎯 Exact Name' :
                             token.matchType === 'prefix_symbol' ? '📍 Symbol Start' :
                             token.matchType === 'prefix_name' ? '📍 Name Start' :
                             token.matchType === 'partial_symbol' ? '🔍 Symbol Contains' :
                             token.matchType === 'partial_name' ? '🔍 Name Contains' : ''}
                          </span>
                        )}
                        {token.mint ? ` • CA: ${token.mint.slice(0, 8)}...${token.mint.slice(-4)}` : ''}
                        {token.price && ` • $${formatSmartPrice(token.price)}`}
                      </div>
                    )}
                  </div>
                </div>
                
                {!token.found && (
                  <button
                    className="token-search__add-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToken(token);
                    }}
                    disabled={isAdding}
                    title={token.notFound ? "Add with Contract Address" : "Add token"}
                  >
                    {isAdding ? '⏳' : '➕'} {token.notFound ? 'Add' : 'Add'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
