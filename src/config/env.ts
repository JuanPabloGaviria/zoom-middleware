import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  zoom: {
    verificationToken: process.env.ZOOM_VERIFICATION_TOKEN || '',
    secretToken: process.env.ZOOM_SECRET_TOKEN || ''
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },
  
  clickup: {
    apiKey: process.env.CLICKUP_API_KEY || '',
    clientId: process.env.CLICKUP_CLIENT_ID || '',
    clientSecret: process.env.CLICKUP_CLIENT_SECRET || ''
  }
};