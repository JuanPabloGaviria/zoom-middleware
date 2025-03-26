// Type definitions for 'ws' WebSocket
declare module 'ws' {
    // Define Data type for message events
    namespace WebSocket {
      type Data = string | Buffer | ArrayBuffer | Buffer[];
    }
  
    class WebSocket {
      static readonly CONNECTING: number;
      static readonly OPEN: number;
      static readonly CLOSING: number;
      static readonly CLOSED: number;
      
      readyState: number;
      
      constructor(address: string, options?: any);
      
      on(event: 'open', cb: () => void): this;
      on(event: 'message', cb: (data: WebSocket.Data) => void): this;
      on(event: 'error', cb: (error: Error) => void): this;
      on(event: 'close', cb: (code: number, reason: string) => void): this;
      on(event: 'pong', cb: () => void): this;
      on(event: string, cb: (...args: any[]) => void): this;
      
      send(data: any, cb?: (err?: Error) => void): void;
      ping(data?: any, mask?: boolean, cb?: (err?: Error) => void): void;
      close(code?: number, reason?: string): void;
      
      addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    }
    
    export = WebSocket;
  }