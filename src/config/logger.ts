import winston from 'winston';
import config from './env';

// Declare type for global logger
declare global {
  var appLogger: winston.Logger | undefined;
}

// Create logger only if it doesn't exist to prevent duplication
let logger: winston.Logger;

if (!global.appLogger) {
  logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta) : ''
        }`;
      })
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    ]
  });
  
  // Save to global to avoid multiple instances
  global.appLogger = logger;
} else {
  logger = global.appLogger;
}

export default logger;