import { Request, Response } from 'express';
import logger from '../config/logger';
import { downloadFile, convertToMp3, cleanupFiles } from '../services/audioService';
import { extractInformationWithLemur } from '../services/extractionService';
import { updateClickUpTask } from '../services/clickupService';
import { ZoomWebhookEvent, ApiError, ExtractedInfo } from '../types';

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

/**
 * Process extracted info with rate limiting to avoid API throttling
 * @param extractedInfos - Array of extracted information
 */
const processExtractedInfoWithRateLimit = async (extractedInfos: ExtractedInfo[]): Promise<void> => {
  logger.info(`Processing ${extractedInfos.length} extracted character/task combinations with rate limiting`);
  
  // Group infos by character to reduce duplicative API calls
  const characterGroups = new Map<string, ExtractedInfo[]>();
  
  for (const info of extractedInfos) {
    if (!characterGroups.has(info.character)) {
      characterGroups.set(info.character, []);
    }
    characterGroups.get(info.character)!.push(info);
  }
  
  // Process each character group
  for (const [character, infos] of characterGroups.entries()) {
    try {
      logger.info(`Updating ClickUp for character: ${character} with ${infos.length} tasks`);
      
      // Process first task
      await updateClickUpTask(infos[0]);
      logger.info(`Successfully updated primary task for character ${character}`);
      
      // Add delay to avoid rate limiting
      if (infos.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Process any additional tasks
        for (let i = 1; i < infos.length; i++) {
          try {
            await updateClickUpTask(infos[i]);
            logger.info(`Successfully updated additional task ${i} for character ${character}`);
            
            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (taskErr: unknown) {
            const taskError = taskErr as ApiError;
            logger.error(`Failed to update additional task ${i} for ${character}`, { 
              message: taskError.message 
            });
          }
        }
      }
      
      // Add delay between characters
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (updateErr: unknown) {
      const updateError = updateErr as ApiError;
      logger.error(`Failed to update ClickUp for character ${character}`, { 
        message: updateError.message,
        stack: updateError.stack 
      });
    }
  }
  
  logger.info('Completed processing all character/task combinations');
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
    const audioRecording = recordings.find((file: any) => 
      file.file_type === 'M4A' || 
      file.file_type === 'MP4' || 
      file.recording_type === 'audio_only'
    );
    
    if (!audioRecording) {
      throw new Error('No audio recording found');
    }
    
    // Download file
    const downloadToken = meeting.download_token;
    logger.info(`Downloading recording from URL: ${audioRecording.download_url}`);
    const downloadedFilePath = await downloadFile(audioRecording.download_url, downloadToken);
    filesToCleanup.push(downloadedFilePath);
    
    // Convert to MP3
    logger.info(`Converting downloaded file to MP3: ${downloadedFilePath}`);
    const mp3FilePath = await convertToMp3(downloadedFilePath);
    filesToCleanup.push(mp3FilePath);
    
    // Extract information using LLM
    logger.info(`Extracting information from MP3 file: ${mp3FilePath}`);
    const extractedInfos = await extractInformationWithLemur(mp3FilePath);
    
    // Handle empty results gracefully
    if (extractedInfos.length === 0) {
      logger.info(`No character/task combinations found in recording from meeting: ${meeting.topic}`);
      return;
    }
    
    logger.info(`Successfully extracted ${extractedInfos.length} character/task combinations`);
    
    // Update ClickUp with rate limiting
    await processExtractedInfoWithRateLimit(extractedInfos);
    
    logger.info(`Successfully processed all ${extractedInfos.length} characters from meeting ${meeting.topic}`);
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error processing recording', { message: error.message, stack: error.stack });
    throw error;
  } finally {
    // Clean up temporary files
    if (filesToCleanup.length > 0) {
      logger.info(`Cleaning up ${filesToCleanup.length} temporary files`);
      await cleanupFiles(filesToCleanup);
    }
  }
};