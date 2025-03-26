import logger from '../config/logger';
import { ExtractedInfo, ApiError } from '../types';
import { extractInformationWithGemini } from './geminiService';
import { transcribeAudio } from './transcriptionService';
import { getZoomTranscription } from './zoomTranscriptionService';

/**
 * Extracts character, project and task information from audio file
 * @param filePath - Path to the audio file
 * @returns Array of extracted information
 */
export const extractInformationWithLemur = async (filePath: string): Promise<ExtractedInfo[]> => {
  try {
    logger.info('Extracting information from audio file');
    
    // First transcribe the audio using our existing transcription service
    const transcriptionText = await transcribeAudio(filePath);
    logger.info(`Audio transcribed, length: ${transcriptionText.length} characters`);
    
    // Then extract information using Gemini with the full text
    const results = await extractInformationWithGemini(transcriptionText);
    
    // Return whatever Gemini found (could be empty array)
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information from audio', { message: error.message });
    throw error;
  }
};

/**
 * Extracts information using Zoom transcription if available
 * @param filePath - Path to the audio file 
 * @param zoomRecordingId - Zoom recording ID
 * @param accessToken - Zoom access token
 * @returns Array of extracted information
 */
export const extractInformationWithZoom = async (
  filePath: string,
  zoomRecordingId: string,
  accessToken: string
): Promise<ExtractedInfo[]> => {
  try {
    logger.info(`Attempting to use Zoom transcription for recording ${zoomRecordingId}`);
    
    // Try to get transcription from Zoom API
    const transcriptionText = await getZoomTranscription(zoomRecordingId, accessToken);
    logger.info('Successfully retrieved Zoom transcription');
    
    // Use Gemini to extract information from the Zoom transcription
    return await extractInformationWithGemini(transcriptionText);
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with Zoom transcription extraction', { message: error.message });
    
    // If Zoom transcription fails, fall back to our own transcription
    logger.info('Falling back to standard transcription');
    return await extractInformationWithLemur(filePath);
  }
};