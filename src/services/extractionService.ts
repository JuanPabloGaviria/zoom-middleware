import logger from '../config/logger';
import { ExtractedInfo, ApiError } from '../types';
import { extractInformationWithGemini } from './geminiService';
import { transcribeAudio } from './transcriptionService';

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
    
    // Then extract information using Gemini instead of Lemur
    const results = await extractInformationWithGemini(transcriptionText);
    
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information from audio', { message: error.message });
    throw error;
  }
};

/**
 * Extracts character, project and task information from transcribed text
 * @param text - The transcribed text to analyze
 * @returns Array of extracted information
 */
export const extractInformation = async (text: string): Promise<ExtractedInfo[]> => {
  return extractInformationWithGemini(text);
};

/**
 * Find a sentence containing a specific character mention
 * @param text - Full text to search
 * @param character - Character name to find
 * @returns The sentence containing the character, or null if not found
 */
function findSentence(text: string, character: string): string | null {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(character.toLowerCase())) {
      return sentence;
    }
  }
  
  return null;
}