/**
 * Query cache with checksum-based invalidation
 *
 * Caches query results and validates them against a database checksum.
 * This dramatically speeds up repeated identical queries (common in AI conversations).
 *
 * Cache invalidation strategy:
 * 1. Checksum mismatch - database changed
 * 2. Max age exceeded - prevents stale data even if checksum unchanged
 * 3. Write operation - all write tools call invalidateOnWrite()
 */

import { executeOmniFocusScript } from './scriptExecution.js';
import { logger } from './logger.js';

const log = logger.child('cache');

interface CacheEntry<T> {
  checksum: string;
  timestamp: number;
  data: T;
}

interface CacheConfig {
  maxAge: number;      // Max age in ms (even if checksum matches)
  maxEntries: number;  // Max cache entries (FIFO eviction)
  checksumTTL: number; // How long to cache the checksum itself
}

const DEFAULT_CONFIG: CacheConfig = {
  maxAge: 60000,       // 1 minute max (even with valid checksum)
  maxEntries: 100,     // Max 100 cached queries
  checksumTTL: 5000    // Fetch checksum at most every 5 seconds
};

interface ChecksumResult {
  checksum: string;
  taskCount: number;
  projectCount: number;
  tagCount: number;
  latestModification: string;
  error?: string;
}

class QueryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private lastChecksum: string | null = null;
  private checksumFetchTime: number = 0;
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a cache key from operation name and parameters
   */
  private generateKey(operation: string, params: unknown): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  /**
   * Get the current database checksum
   * Cached for checksumTTL to avoid excessive OmniFocus calls
   */
  async getChecksum(): Promise<string> {
    const now = Date.now();

    // Return cached checksum if still fresh
    if (this.lastChecksum && now - this.checksumFetchTime < this.config.checksumTTL) {
      return this.lastChecksum;
    }

    try {
      // Fetch fresh checksum from OmniFocus
      const result = await executeOmniFocusScript('@getChecksum.js') as ChecksumResult;

      if (result.error) {
        log.warn('Failed to get checksum', { error: result.error });
        // On error, invalidate cache to be safe
        this.lastChecksum = null;
        return '';
      }

      this.lastChecksum = result.checksum;
      this.checksumFetchTime = now;

      log.debug('Checksum updated', {
        checksum: result.checksum,
        taskCount: result.taskCount,
        projectCount: result.projectCount
      });

      return this.lastChecksum;
    } catch (error) {
      log.warn('Error fetching checksum', { error: (error as Error).message });
      this.lastChecksum = null;
      return '';
    }
  }

  /**
   * Get a cached result if valid, along with the current checksum
   * Returns { data, checksum } where data is null if not cached or invalid
   * The checksum is returned so callers can pass it to set() to avoid race conditions
   */
  async getWithChecksum<T>(operation: string, params: unknown): Promise<{ data: T | null; checksum: string }> {
    const key = this.generateKey(operation, params);
    const entry = this.cache.get(key);

    // Always fetch current checksum first
    const currentChecksum = await this.getChecksum();

    if (!entry) {
      this.stats.misses++;
      return { data: null, checksum: currentChecksum };
    }

    // Check max age
    const age = Date.now() - entry.timestamp;
    if (age > this.config.maxAge) {
      log.debug('Cache entry expired', { operation, age });
      this.cache.delete(key);
      this.stats.misses++;
      return { data: null, checksum: currentChecksum };
    }

    // Verify checksum
    if (!currentChecksum || entry.checksum !== currentChecksum) {
      log.debug('Cache checksum mismatch', {
        operation,
        cached: entry.checksum,
        current: currentChecksum
      });
      this.cache.delete(key);
      this.stats.misses++;
      return { data: null, checksum: currentChecksum };
    }

    this.stats.hits++;
    log.debug('Cache hit', { operation, age });
    return { data: entry.data as T, checksum: currentChecksum };
  }

  /**
   * Get a cached result if valid
   * Returns null if not cached or invalid
   * @deprecated Use getWithChecksum() to avoid race conditions
   */
  async get<T>(operation: string, params: unknown): Promise<T | null> {
    const { data } = await this.getWithChecksum<T>(operation, params);
    return data;
  }

  /**
   * Store a result in the cache
   * @param checksum - Optional checksum from getWithChecksum() to avoid race conditions.
   *                   If not provided, fetches a fresh checksum (which may differ if writes occurred).
   */
  async set<T>(operation: string, params: unknown, data: T, checksum?: string): Promise<void> {
    const key = this.generateKey(operation, params);

    // Use provided checksum or fetch fresh
    const finalChecksum = checksum || await this.getChecksum();

    // Don't cache if we couldn't get a checksum
    if (!finalChecksum) {
      log.debug('Skipping cache set - no checksum available');
      return;
    }

    // Enforce max entries (FIFO-style: delete oldest by insertion order)
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        log.debug('Evicted oldest cache entry', { key: oldestKey });
      }
    }

    this.cache.set(key, {
      checksum: finalChecksum,
      timestamp: Date.now(),
      data
    });

    log.debug('Cached result', { operation, checksum: finalChecksum });
  }

  /**
   * Invalidate the entire cache
   * Called by write operations to ensure consistency
   */
  invalidate(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.lastChecksum = null;
    this.stats.invalidations++;

    if (size > 0) {
      log.debug('Cache invalidated', { entriesCleared: size });
    }
  }

  /**
   * Alias for invalidate() - called after write operations
   */
  invalidateOnWrite(): void {
    this.invalidate();
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): { hits: number; misses: number; invalidations: number; size: number; hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) + '%' : 'N/A';
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate
    };
  }

  /**
   * Clear statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }
}

// Export singleton for use across the application
export const queryCache = new QueryCache();

// Export class for testing with custom config
export { QueryCache, CacheConfig };
