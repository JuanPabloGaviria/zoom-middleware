import { Request, Response } from 'express';
import logger from '../config/logger';
import { downloadFile, convertToMp3, cleanupFiles } from '../services/audioService';
import { transcribeAudio } from '../services/transcriptionService';
import { extractInformation } from '../services/extractionService';
import { updateClickUpTask } from '../services/clickupService';
import { ZoomWebhookEvent, ApiError } from '../types';

export const handleZoomWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const eventData = req.body as ZoomWebhookEvent;
    const event = eventData.event;
    logger.info(`Processing Zoom webhook: ${event}`);
    
    // Handle different events
    if (event === 'recording.completed') {
      // For recording.completed events, process asynchronously
      res.status(200).json({ status: 'Processing recording' });
      
      // Process in background
      processRecording(eventData).catch(err => {
        const error = err as ApiError;
        logger.error('Background processing failed', { message: error.message });
      });
    } else {
      // For other events, just acknowledge
      res.status(200).json({ status: 'Event received', event });
    }
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error in webhook handler', { message: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const processRecording = async (webhookData: ZoomWebhookEvent): Promise<void> => {
  const filesToCleanup: string[] = [];
  
  try {
    // Extract recording information
    const meeting = webhookData.payload.object;
    if (!meeting) {
      throw new Error('No meeting data in webhook payload');
    }
    
    const recordings = meeting.recording_files || [];
    
    logger.info(`Processing recording for meeting: ${meeting.topic}`);
    
    // Find audio recording
    const audioRecording = recordings.find((file) => 
      file.file_type === 'M4A' || 
      file.file_type === 'MP4' || 
      file.recording_type === 'audio_only'
    );
    
    if (!audioRecording) {
      throw new Error('No audio recording found');
    }
    
    // Download file
    const downloadToken = meeting.download_token;
    const downloadedFilePath = await downloadFile(audioRecording.download_url, downloadToken);
    filesToCleanup.push(downloadedFilePath);
    
    // Convert to MP3
    const mp3FilePath = await convertToMp3(downloadedFilePath);
    filesToCleanup.push(mp3FilePath);
    
    // Transcribe audio
    const transcription = await transcribeAudio(mp3FilePath);
    
    // Extract information
    const extractedInfos = extractInformation(transcription);
    
    if (extractedInfos.length === 0) {
      logger.warn('No character/task information extracted from transcription');
      return;
    }
    
    // Update ClickUp for each extracted info
    for (const info of extractedInfos) {
      await updateClickUpTask(info);
    }
    
    logger.info(`Successfully processed ${extractedInfos.length} characters from meeting ${meeting.topic}`);
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error processing recording', { message: error.message });
  } finally {
    // Clean up temporary files
    await cleanupFiles(filesToCleanup);
  }
};