// Type definitions for 'ws' module
// This is a custom declaration file to augment the ws module

declare module 'ws' {
    export class WebSocket {
      static readonly CONNECTING: number;
      static readonly OPEN: number;
      static readonly CLOSING: number;
      static readonly CLOSED: number;
      
      readyState: number;
      
      constructor(address: string, options?: { headers?: Record<string, string> });
      
      addEventListener(event: 'open', listener: () => void): void;
      addEventListener(event: 'message', listener: (data: any) => void): void;
      addEventListener(event: 'error', listener: (error: any) => void): void;
      addEventListener(event: 'close', listener: (event: { code: number, reason: string }) => void): void;
      
      on(event: 'pong', listener: () => void): this;
      on(event: string, listener: (...args: any[]) => void): this;
      
      ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
      close(code?: number, reason?: string): void;
    }
  }