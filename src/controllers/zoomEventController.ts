import axios from 'axios';
import logger from '../config/logger';
import { downloadFile, convertToMp3, cleanupFiles } from '../services/audioService';
import { extractInformationWithLemur, extractInformationWithZoom } from '../services/extractionService';
import { updateClickUpTask } from '../services/clickupService';
import { ApiError, ExtractedInfo, ZoomMeeting, ZoomRecordingFile } from '../types';
import { getAccessToken } from '../services/zoomAuthService';
import { enableZoomTranscription } from '../services/zoomTranscriptionService';

/**
 * Process Zoom events received via WebSocket
 * @param event - The event data from Zoom WebSocket
 */
export const processZoomEvent = async (event: any): Promise<void> => {
  try {
    // Log the event type
    const eventType = event.event_type || event.event;
    logger.info(`Processing Zoom event: ${eventType}`, { 
      eventId: event.payload?.object?.id || 'unknown'
    });
    
    // Handle different event types
    switch (eventType) {
      case 'recording.completed':
        await handleRecordingCompleted(event);
        break;
      
      case 'endpoint.url_validation':
        // This should not happen via WebSocket but included for completeness
        logger.info('Received endpoint validation via WebSocket - this is unexpected');
        break;
      
      default:
        logger.info(`Unhandled event type: ${eventType}`);
        break;
    }
  } catch (err) {
    const error = err as ApiError;
    logger.error('Error processing Zoom event', { 
      message: error.message, 
      stack: error.stack 
    });
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

/**
 * Handle recording.completed events
 * @param event - The recording completed event
 */
const handleRecordingCompleted = async (event: any): Promise<void> => {
  const filesToCleanup: string[] = [];
  
  try {
    // Extract recording information
    const eventPayload = event.payload || {};
    const meeting = eventPayload.object as ZoomMeeting;
    
    if (!meeting) {
      throw new Error('No meeting data in event payload');
    }
    
    const recordings = meeting.recording_files || [];
    
    logger.info(`Processing recording for meeting: ${meeting.topic}`);
    
    // Find audio recording
    const audioRecording = recordings.find((file: ZoomRecordingFile) => 
      file.file_type === 'M4A' || 
      file.file_type === 'MP4' || 
      file.recording_type === 'audio_only'
    );
    
    if (!audioRecording) {
      throw new Error('No audio recording found');
    }
    
    // Get Zoom access token for API calls
    const accessToken = await getAccessToken();
    
    // Request transcription from Zoom (may take time to process)
    try {
      await enableZoomTranscription(meeting.id, audioRecording.id, accessToken);
      logger.info('Requested Zoom transcription for the recording');
    } catch (transcriptionErr) {
      logger.warn('Failed to request Zoom transcription, will use local processing', {
        error: (transcriptionErr as Error).message
      });
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
    
    // Extract information using Zoom transcription if possible, or our own otherwise
    logger.info(`Extracting information from recording`);
    let extractedInfos: ExtractedInfo[] = [];
    
    try {
      // Try to use Zoom's transcription first
      extractedInfos = await extractInformationWithZoom(
        mp3FilePath,
        audioRecording.id,
        accessToken
      );
    } catch (error) {
      // If that fails, use our own transcription and extraction
      logger.warn('Zoom transcription extraction failed, using local extraction', {
        error: (error as Error).message
      });
      extractedInfos = await extractInformationWithLemur(mp3FilePath);
    }
    
    // If no information was extracted, log a warning and exit
    if (extractedInfos.length === 0) {
      logger.warn(`No character/task combinations found in recording from meeting: ${meeting.topic}`);
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