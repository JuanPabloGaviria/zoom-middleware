import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  zoom: {
    // Webhook related tokens (legacy)
    verificationToken: process.env.ZOOM_VERIFICATION_TOKEN || '',
    secretToken: process.env.ZOOM_SECRET_TOKEN || '',
    
    // WebSocket connection details
    accountId: process.env.ZOOM_ACCOUNT_ID || '',
    clientId: process.env.ZOOM_CLIENT_ID || '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
    subscriptionId: process.env.ZOOM_SUBSCRIPTION_ID || '',
    wsUrl: process.env.ZOOM_WS_URL || 'wss://ws.zoom.us/ws',
    
    // OAuth endpoints
    oauth: {
      tokenUrl: 'https://zoom.us/oauth/token'
    }
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },
  
  assemblyai: {
    apiKey: process.env.ASSEMBLY_AI_API_KEY || ''
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || ''
  },
  
  clickup: {
    apiKey: process.env.CLICKUP_API_KEY || '',
    clientId: process.env.CLICKUP_CLIENT_ID || '',
    clientSecret: process.env.CLICKUP_CLIENT_SECRET || ''
  }
};