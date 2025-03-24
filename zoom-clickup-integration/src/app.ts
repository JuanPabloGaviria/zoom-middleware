import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import config from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import webhookRoutes from './routes/webhookRoutes';
import testRoutes from './routes/testRoutes';

// Create Express application
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api', testRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Zoom-ClickUp Integration API',
    status: 'Running'
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;