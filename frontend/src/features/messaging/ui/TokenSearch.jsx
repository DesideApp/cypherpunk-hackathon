// frontend/src/features/messaging/ui/TokenSearch.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '@shared/services/apiService.js';
import './TokenSearch.css';

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

  // Búsqueda en tiempo real
  useEffect(() => {
    if (search.length >= 1) {
      setIsSearching(true);
      searchTokens(search);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, [search]);

  const searchTokens = async (query) => {
    try {
      // Buscar en tokens disponibles primero
      const availableMatches = availableTokens.filter(token => 
        token.code.toLowerCase().includes(query.toLowerCase()) ||
        token.label.toLowerCase().includes(query.toLowerCase())
      );

      if (availableMatches.length > 0) {
        // Si encuentra en disponibles, mostrarlos
        setResults(availableMatches.map(token => ({
          ...token,
          found: true,
          isNew: false,
        })));
      } else {
        // Si no encuentra en disponibles, buscar en Jupiter
        try {
          const response = await apiRequest('/api/v1/tokens/search', {
            method: 'POST',
            body: JSON.stringify({ code: query.toUpperCase() }),
          });

          if (response.success && response.found) {
            if (response.multiple) {
              // Múltiples tokens encontrados
              setResults(response.tokens.map(token => ({
                ...token,
                found: false, // No están en nuestra lista
                isNew: true,
                isMultiple: true,
              })));
            } else {
              // Token único encontrado en Jupiter
              setResults([{
                ...response.token,
                found: false, // No está en nuestra lista
                isNew: true,
              }]);
            }
          } else {
            // Token no encontrado en Jupiter
            setResults([{
              code: query.toUpperCase(),
              label: `"${query.toUpperCase()}" no encontrado`,
              found: false,
              isNew: true,
              notFound: true,
              searchQuery: query.toUpperCase(),
            }]);
          }
        } catch (searchError) {
          // Error buscando en Jupiter, mostrar como no encontrado
          setResults([{
            code: query.toUpperCase(),
            label: `"${query.toUpperCase()}" no encontrado`,
            found: false,
            isNew: true,
            notFound: true,
            searchQuery: query.toUpperCase(),
          }]);
        }
      }
    } catch (error) {
      console.error('Error searching tokens:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToken = async (token) => {
    setIsAdding(true);
    try {
      // Si el token tiene mint, usarlo directamente
      if (token.mint) {
        const response = await apiRequest('/api/v1/tokens/add', {
          method: 'POST',
          body: JSON.stringify({ 
            mint: token.mint,
            code: token.code,
          }),
        });

        if (response.success) {
          // Token añadido exitosamente
          onTokenAdd?.(response.token);
          setSearch(''); // Limpiar búsqueda
          setResults([]);
          // Mostrar éxito
          alert(`✅ Token ${token.code} added successfully`);
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
        <input
          type="text"
          className="token-search__input"
          placeholder="🔍 Buscar token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isAdding}
        />
        {isSearching && (
          <div className="token-search__spinner">
            <div className="spinner"></div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="token-search__results">
          {results.map((token, index) => (
            <div
              key={`${token.code}-${index}`}
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
                  <div className="token-search__result-code">{token.code}</div>
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
                      {token.price && ` • $${token.price.toFixed(4)}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
