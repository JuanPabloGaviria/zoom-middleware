// Extend the WebSocket interface
declare module 'ws' {
    interface WebSocket {
      on(event: 'pong', listener: () => void): this;
      ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    }
  }
  
  // Define browser-like types for WebSocket events
  interface MessageEvent {
    data: any;
    type: string;
    target: WebSocket;
  }
  
  interface ErrorEvent {
    error: any;
    message: string;
    type: string;
    target: WebSocket;
  }
  
  interface CloseEvent {
    code: number;
    reason: string;
    wasClean: boolean;
    type: string;
    target: WebSocket;
  }