import { URL } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import NodeCache from 'node-cache';
import * as cheerio from 'cheerio';
import logger from '#config/logger.js';

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_SECONDS = Number(process.env.LINK_PREVIEW_CACHE_TTL ?? 300);
const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: Math.max(CACHE_TTL_SECONDS / 2, 30) });

const PRIVATE_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost', '.home'];

function isPrivateHostname(hostname) {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  ) {
    return true;
  }

  return PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isPrivateIPv4(ip) {
  if (!net.isIPv4(ip)) return false;
  const octets = ip.split('.').map(Number);
  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  return false;
}

function isPrivateIPv6(ip) {
  if (!net.isIPv6(ip)) return false;
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('fec0')
  );
}

function isPrivateAddress(addr) {
  return isPrivateIPv4(addr) || isPrivateIPv6(addr);
}

async function resolvePublicAddresses(urlObj) {
  if (isPrivateHostname(urlObj.hostname)) {
    throw new Error('Private hostname not allowed');
  }

  const resolved = await dns.lookup(urlObj.hostname, { all: true });
  if (!resolved?.length) {
    throw new Error('Host has no DNS records');
  }

  const publicAddresses = resolved.filter((entry) => !isPrivateAddress(entry.address));

  if (!publicAddresses.length) {
    throw new Error('Host resolves only to private addresses');
  }

  return publicAddresses.map((entry) => entry.address);
}

function finalizeUrl(urlOrPath, baseUrl) {
  if (!urlOrPath) return null;
  try {
    return new URL(urlOrPath, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractFromJson(json, baseUrl) {
  if (!json || typeof json !== 'object') return null;
  const title = json.title || json.name || '';
  const description = json.description || json.summary || '';
  const image = finalizeUrl(json.image || json.icon || json.logo, baseUrl);
  const favicon = finalizeUrl(json.icon || json.favicon || null, baseUrl);
  const siteName = json.site || json.siteName || json.application || new URL(baseUrl).hostname;
  const type = json.type || json.category || null;

  return {
    title,
    description,
    image,
    siteName,
    favicon,
    type,
    raw: json,
  };
}

function extractFromHtml(html, baseUrl) {
  if (!html) return null;
  const $ = cheerio.load(html);

  const og = (prop) => $(`meta[property="og:${prop}"]`).attr('content');
  const twitter = (name) => $(`meta[name="twitter:${name}"]`).attr('content');
  const meta = (name) => $(`meta[name="${name}"]`).attr('content');

  const title = og('title') || twitter('title') || $('title').first().text()?.trim();
  const description = og('description') || twitter('description') || meta('description');
  const image = finalizeUrl(og('image') || twitter('image') || $('meta[itemprop="image"]').attr('content'), baseUrl);
  const siteName = og('site_name') || twitter('site') || $('meta[itemprop="name"]').attr('content');
  const favicon = finalizeUrl($('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href'), baseUrl);
  const type = og('type') || null;

  return {
    title: title || '',
    description: description || '',
    image,
    siteName: siteName || new URL(baseUrl).hostname,
    favicon,
    type,
    raw: null,
  };
}

async function performFetch(urlObj) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(urlObj.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DesidePreview/1.1)',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1',
      },
      signal: controller.signal,
    });

    const elapsed = Math.round(performance.now() - started);
    logger.debug(`[link-preview] Fetched ${urlObj.hostname} in ${elapsed}ms (status ${response.status})`);

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getLinkPreviewData(rawUrl) {
  if (!rawUrl) {
    throw new Error('Missing url parameter');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  const cacheKey = parsedUrl.toString();
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  await resolvePublicAddresses(parsedUrl);

  const response = await performFetch(parsedUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const baseUrl = parsedUrl.toString();

  let metadata = null;

  try {
    if (contentType.includes('application/json')) {
      const json = await response.json();
      metadata = extractFromJson(json, baseUrl);
    } else if (contentType.includes('text/html')) {
      const html = await response.text();
      metadata = extractFromHtml(html, baseUrl);
    } else {
      metadata = {
        title: parsedUrl.hostname,
        description: '',
        image: null,
        siteName: parsedUrl.hostname,
        favicon: null,
        type: null,
        raw: null,
      };
    }
  } catch (error) {
    logger.warn(`[link-preview] Failed to parse ${baseUrl}: ${error.message}`);
    metadata = {
      title: parsedUrl.hostname,
      description: '',
      image: null,
      siteName: parsedUrl.hostname,
      favicon: null,
      type: null,
      raw: null,
    };
  }

  const result = {
    url: baseUrl,
    title: metadata?.title || parsedUrl.hostname,
    description: metadata?.description || '',
    image: metadata?.image || null,
    siteName: metadata?.siteName || parsedUrl.hostname,
    favicon: metadata?.favicon || null,
    type: metadata?.type || null,
    raw: metadata?.raw || null,
    contentType,
  };

  cache.set(cacheKey, result);
  return result;
}

export function getLinkPreviewCache() {
  return cache;
}
