// Detector de blinks de dial.to que consume el endpoint backend de previews
import { apiRequest } from '@shared/services/apiService.js';

const DIAL_TO_PATTERN = /https?:\/\/[^\s]*dial\.to\/[^\s]*/gi;
const METADATA_CACHE_TTL = 2 * 60 * 1000; // 2 minutos
const metadataCache = new Map();

export function isDialToUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('dial.to');
  } catch {
    return false;
  }
}

export function extractDialToUrls(text) {
  if (!text || typeof text !== 'string') return [];

  const matches = text.match(DIAL_TO_PATTERN) || [];
  const validUrls = matches.filter(isDialToUrl);
  return [...new Set(validUrls)];
}

function readFromCache(url) {
  const entry = metadataCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > METADATA_CACHE_TTL) {
    metadataCache.delete(url);
    return null;
  }
  return entry.data;
}

function writeToCache(url, data) {
  metadataCache.set(url, { data, timestamp: Date.now() });
}

async function fetchMetadata(actualUrl) {
  const cached = readFromCache(actualUrl);
  if (cached) return cached;

  const response = await apiRequest(`/api/v1/link-preview?url=${encodeURIComponent(actualUrl)}`, {
    method: 'GET',
  });

  if (response?.success && response.data) {
    writeToCache(actualUrl, response.data);
    return response.data;
  }

  const errorMessage = response?.error || response?.message || 'Failed to fetch link preview';
  throw new Error(errorMessage);
}

const dimensionCache = new Map();

function readDimensions(url) {
  const entry = dimensionCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > METADATA_CACHE_TTL) {
    dimensionCache.delete(url);
    return null;
  }
  return entry;
}

function storeDimensions(url, width, height) {
  dimensionCache.set(url, { width, height, timestamp: Date.now() });
}

function resolveImageVariant(metadata, imageUrl) {
  let width = Number(metadata?.raw?.imageWidth || metadata?.raw?.width);
  let height = Number(metadata?.raw?.imageHeight || metadata?.raw?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    const cachedDims = readDimensions(imageUrl);
    if (cachedDims) {
      ({ width, height } = cachedDims);
    }
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'landscape';
  }

  const ratio = width / height;

  if (ratio >= 0.8 && ratio <= 1.2) {
    return 'square';
  }
  if (ratio < 0.8) {
    return 'portrait';
  }

  return 'landscape';
}

function measureImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('No image URL provided'));

    const cached = readDimensions(url);
    if (cached) {
      resolve(cached);
      return;
    }

    const img = new Image();
    const timeout = setTimeout(() => {
      img.src = '';
      reject(new Error('Image load timeout'));
    }, 4000);

    img.onload = () => {
      clearTimeout(timeout);
      storeDimensions(url, img.naturalWidth, img.naturalHeight);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };

    img.src = url;
  });
}

export async function extractDialBlinkInfo(url) {
  try {
    const urlObj = new URL(url);
    const actionParam = urlObj.searchParams.get('action');

    if (!actionParam) {
      throw new Error('No se encontró parámetro action');
    }

    const solanaActionUrl = decodeURIComponent(actionParam);
    const actualUrl = solanaActionUrl.replace('solana-action:', '');
    const actualUrlObj = new URL(actualUrl);
    const pathname = actualUrlObj.pathname.toLowerCase();

    let metadata = null;
    try {
      metadata = await fetchMetadata(actualUrl);
    } catch (err) {
      console.warn('[dialBlinkDetector] Metadata fetch failed:', err.message);
    }

    let type = 'action';
    if (pathname.includes('swap')) type = 'swap';
    else if (pathname.includes('transfer')) type = 'transfer';
    else if (pathname.includes('stake')) type = 'stake';
    else if (pathname.includes('nft')) type = 'nft';

    const title = metadata?.title || 'Blink Action';
    const description = metadata?.description || 'Acción de Solana';
    const image = metadata?.image || metadata?.favicon || null;
    const siteName = metadata?.siteName || actualUrlObj.hostname;
    const mediaType = metadata?.type || type;

    let imageVariant = 'landscape';
    let measuredDimensions = null;

    if (image) {
      try {
        measuredDimensions = await measureImage(image);
      } catch (err) {
        measuredDimensions = null;
      }
    }

    if (measuredDimensions) {
      imageVariant = resolveImageVariant(
        {
          ...metadata,
          raw: {
            ...(metadata?.raw || {}),
            imageWidth: measuredDimensions.width,
            imageHeight: measuredDimensions.height,
          },
        },
        image
      );
    } else {
      imageVariant = resolveImageVariant(metadata, image);
    }
    const favicon = metadata?.favicon || null;

    return {
      url: actualUrl,
      originalUrl: url,
      title,
      description,
      type,
      mediaType,
      image,
      domain: actualUrlObj.hostname,
      siteName,
      metadata,
      favicon,
      imageVariant,
    };
  } catch (error) {
    throw new Error(`Error procesando URL: ${error.message}`);
  }
}

export async function detectDialBlinks(text) {
  if (!text || typeof text !== 'string') return [];

  const urls = extractDialToUrls(text);
  if (urls.length === 0) return [];

  const results = await Promise.allSettled(
    urls.map(async (blinkUrl) => {
      const info = await extractDialBlinkInfo(blinkUrl);
      return {
        url: info.originalUrl,
        info,
      };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const fallbackUrl = urls[index];
    console.warn('Error procesando blink URL:', fallbackUrl, result.reason);

    return {
      url: fallbackUrl,
      info: {
        url: fallbackUrl,
        originalUrl: fallbackUrl,
        title: 'Blink Action',
        description: 'Acción de Solana',
        type: 'unknown',
        mediaType: 'unknown',
        image: null,
        domain: 'dial.to',
        siteName: 'dial.to',
        favicon: null,
        imageVariant: 'landscape',
      },
    };
  });
}
