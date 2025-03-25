import logger from '../config/logger';

interface RateLimitOptions {
  maxRequests: number;
  timeWindowMs: number;
  retryDelayMs: number;
  maxRetries: number;
}

class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestTimestamps: number[] = [];
  private options: RateLimitOptions;

  constructor(options: Partial<RateLimitOptions> = {}) {
    this.options = {
      maxRequests: 5,         // Max requests in time window
      timeWindowMs: 2000,     // Time window in milliseconds (2 seconds)
      retryDelayMs: 500,      // Delay between retries
      maxRetries: 3,          // Maximum retry attempts
      ...options
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    // Remove timestamps that are outside the time window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.options.timeWindowMs
    );
    return this.requestTimestamps.length < this.options.maxRequests;
  }

  private async waitForAvailableSlot(): Promise<void> {
    while (!this.canMakeRequest()) {
      await this.sleep(100); // Check every 100ms
    }
    this.requestTimestamps.push(Date.now());
  }

  async execute<T>(fn: () => Promise<T>, context: string = 'API call'): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add the task to the queue
      this.queue.push(async () => {
        let retries = 0;
        
        while (retries <= this.options.maxRetries) {
          try {
            await this.waitForAvailableSlot();
            const result = await fn();
            return resolve(result);
          } catch (error: any) {
            if (error.response?.status === 429 && retries < this.options.maxRetries) {
              retries++;
              logger.warn(`Rate limit hit for ${context}. Retrying (${retries}/${this.options.maxRetries}) in ${this.options.retryDelayMs}ms`);
              await this.sleep(this.options.retryDelayMs * retries); // Exponential backoff
            } else {
              return reject(error);
            }
          }
        }
      });
      
      // Process the queue if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (task) {
          await task();
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

// Create a singleton instance
export const clickUpRateLimiter = new RateLimiter({
  maxRequests: 3,       // More conservative rate limiting
  timeWindowMs: 1000,   // 3 requests per second
  retryDelayMs: 1000,   // Start with 1 second delay
  maxRetries: 5         // More retries
});

export default clickUpRateLimiter;