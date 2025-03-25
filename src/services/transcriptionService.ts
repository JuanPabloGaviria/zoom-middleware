import fs from 'fs';
import { AssemblyAI } from 'assemblyai';
import { OpenAI } from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../types';

// Initialize API clients
const openai = new OpenAI({ apiKey: config.openai.apiKey });
const assemblyai = new AssemblyAI({ 
  apiKey: config.assemblyai.apiKey || ''
});

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 75; // ms

/**
 * Sleep utility function
 * @param ms - Milliseconds to sleep
 */
export const sleep = async (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Transcribe audio using AssemblyAI's standard model with language detection
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithStandardDetection(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI standard model using language detection');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      language_detection: true,
      speaker_labels: true, // Enable speaker diarization
      punctuate: true,      // Ensure proper punctuation
      format_text: true     // Format the text for readability
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Standard transcription with language detection failed: ${transcript.error}`);
    }
    
    logger.info('Standard transcription with language detection completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from standard transcription');
    }
    
    logger.info(`Transcription length: ${transcript.text.length} characters`);
    logger.info(`First 100 chars of transcription: ${transcript.text.substring(0, 100)}...`);
    logger.info(`Detected language: ${transcript.language_code || 'not specified'}, confidence: ${transcript.language_confidence || 'not specified'}`);
    
    return transcript.text;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with standard transcription using language detection', { message: error.message });
    throw error;
  }
}

/**
 * Transcribe audio using AssemblyAI's standard model with explicit Spanish setting
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithStandardSpanish(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI standard model with explicit Spanish setting');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      language_code: 'es',
      speaker_labels: true, // Enable speaker diarization
      punctuate: true,      // Ensure proper punctuation
      format_text: true     // Format the text for readability
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Standard transcription with Spanish setting failed: ${transcript.error}`);
    }
    
    logger.info('Standard transcription with Spanish setting completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from standard transcription');
    }
    
    logger.info(`Transcription length: ${transcript.text.length} characters`);
    logger.info(`First 100 chars of transcription: ${transcript.text.substring(0, 100)}...`);
    
    return transcript.text;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with standard transcription using Spanish setting', { message: error.message });
    throw error;
  }
}

/**
 * Multi-service transcription with fallbacks
 * @param filePath - Path to the audio file
 * @returns Transcription text
 */
export const transcribeAudio = async (filePath: string): Promise<string> => {
  // Try OpenAI Whisper API first if key is available
  if (config.openai.apiKey) {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        logger.info(`Transcribing audio with OpenAI: ${filePath} (Attempt ${retries + 1}/${MAX_RETRIES})`);
        
        const fileStats = fs.statSync(filePath);
        const fileSizeMB = fileStats.size / (1024 * 1024);
        
        logger.info(`File size: ${fileSizeMB.toFixed(2)} MB`);
        
        if (fileSizeMB > 25) {
          logger.warn('File size exceeds OpenAI limit of 25MB, skipping OpenAI');
          break;
        }
        
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: "whisper-1",
          language: "es", // Explicitly set Spanish
          response_format: "text"
        });
        
        logger.info('OpenAI transcription completed successfully');
        return transcription;
      } catch (err: unknown) {
        const error = err as ApiError;
        retries++;
        
        if (retries >= MAX_RETRIES) {
          logger.warn(`OpenAI transcription failed after ${MAX_RETRIES} attempts`, { message: error.message });
          break;
        }
        
        logger.warn(`OpenAI transcription attempt ${retries} failed, retrying in ${RETRY_DELAY}ms`, { message: error.message });
        await sleep(RETRY_DELAY);
      }
    }
  } else {
    logger.warn('OpenAI API key not configured, skipping OpenAI transcription');
  }
  
  // Check if AssemblyAI API key is available
  if (!config.assemblyai.apiKey) {
    logger.error('AssemblyAI API key not configured, transcription cannot proceed');
    throw new Error('AssemblyAI API key is required for transcription');
  }
  
  // Strategy 1: Try with language detection first (Standard model)
  try {
    logger.info('Trying transcription with standard model and language detection');
    const standardDetectionTranscription = await transcribeWithStandardDetection(filePath);
    logger.info('Successfully transcribed with standard model and language detection');
    return standardDetectionTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.warn('Standard transcription with language detection failed, trying explicit Spanish', { message: error.message });
  }
  
  // Strategy 2: Try forcing Spanish with Standard model
  try {
    logger.info('Trying transcription with standard model and explicit Spanish setting');
    const standardSpanishTranscription = await transcribeWithStandardSpanish(filePath);
    logger.info('Successfully transcribed with standard model and Spanish setting');
    return standardSpanishTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('All AssemblyAI transcription attempts failed', { message: error.message });
    throw new Error('All transcription methods failed');
  }
}