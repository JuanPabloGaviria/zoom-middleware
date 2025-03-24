// Core application types
export interface AppConfig {
    port: number | string;
    nodeEnv: string;
    zoom: ZoomConfig;
    openai: OpenAIConfig;
    clickup: ClickUpConfig;
  }
  
  export interface ZoomConfig {
    verificationToken: string;
    secretToken: string;
  }
  
  export interface OpenAIConfig {
    apiKey: string;
  }
  
  export interface ClickUpConfig {
    apiKey: string;
    clientId: string;
    clientSecret: string;
  }
  
  // Zoom related types
  export interface ZoomWebhookEvent {
    event: string;
    event_ts: number;
    payload: {
      object?: ZoomMeeting;
      plainToken?: string;
      [key: string]: any;
    };
  }
  
  export interface ZoomMeeting {
    id: string;
    topic: string;
    host_email?: string;
    recording_files?: ZoomRecordingFile[];
    download_token?: string;
    [key: string]: any;
  }
  
  export interface ZoomRecordingFile {
    id: string;
    file_type: string;
    recording_type?: string;
    download_url: string;
    [key: string]: any;
  }
  
  // Audio processing types
  export interface AudioProcessingResult {
    originalPath: string;
    processedPath: string;
    fileSize: number;
    duration?: number;
  }
  
  // Transcription types
  export interface TranscriptionResult {
    text: string;
    wordCount: number;
    processingTime: number;
  }
  
  // Information extraction types
  export interface ExtractedInfo {
    project: string;
    character: string;
    task: string;
    context?: string;
    confidence?: number;
  }
  
  // ClickUp related types
  export interface ClickUpTeam {
    id: string;
    name: string;
  }
  
  export interface ClickUpSpace {
    id: string;
    name: string;
  }
  
  export interface ClickUpList {
    id: string;
    name: string;
  }
  
  export interface ClickUpTask {
    id: string;
    name: string;
    status: {
      status: string;
    };
    custom_fields?: ClickUpCustomField[];
    [key: string]: any;
  }
  
  export interface ClickUpCustomField {
    id: string;
    name: string;
    value: any;
    [key: string]: any;
  }
  
  export interface ChecklistItem {
    name: string;
    resolved: boolean;
  }
  
  export interface Checklist {
    name: string;
    items: ChecklistItem[];
  }
  
  export interface ApiResponse<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
    error?: string;
  }