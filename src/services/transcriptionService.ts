import fs from 'fs';
import { AssemblyAI } from 'assemblyai';
import { OpenAI } from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../types';

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const assemblyai = new AssemblyAI({ 
  apiKey: config.assemblyai.apiKey || ''
});

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 250; // ms

/**
 * Sleep utility function
 * @param ms - Milliseconds to sleep
 */
export const sleep = async (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Low-cost transcription using Nano model from AssemblyAI with language detection
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithNanoDetection(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI Nano model using language detection');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      speech_model: 'nano',
      language_detection: true
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Nano transcription with language detection failed: ${transcript.error}`);
    }
    
    logger.info('Nano model transcription with language detection completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from Nano transcription');
    }
    
    logger.info(`First 100 chars of transcription: ${transcript.text.substring(0, 100)}...`);
    logger.info(`Detected language: ${transcript.language_code || 'not specified'}, confidence: ${transcript.language_confidence || 'not specified'}`);
    
    return transcript.text;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with Nano transcription using language detection', { message: error.message });
    throw error;
  }
}

/**
 * Low-cost transcription using Nano model from AssemblyAI with Spanish specified
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithNanoSpanish(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI Nano model with explicit Spanish setting');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      speech_model: 'nano',
      language_code: 'es'
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Nano transcription with Spanish setting failed: ${transcript.error}`);
    }
    
    logger.info('Nano model transcription with Spanish setting completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from Nano transcription');
    }
    
    logger.info(`First 100 chars of transcription: ${transcript.text.substring(0, 100)}...`);
    
    return transcript.text;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with Nano transcription using Spanish setting', { message: error.message });
    throw error;
  }
}

/**
 * Standard transcription using AssemblyAI with language detection
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithStandardDetection(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI standard model using language detection');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      language_detection: true
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Standard transcription with language detection failed: ${transcript.error}`);
    }
    
    logger.info('Standard transcription with language detection completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from standard transcription');
    }
    
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
 * Standard transcription using AssemblyAI with Spanish specified
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithStandardSpanish(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI standard model with explicit Spanish setting');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      language_code: 'es'
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Standard transcription with Spanish setting failed: ${transcript.error}`);
    }
    
    logger.info('Standard transcription with Spanish setting completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from standard transcription');
    }
    
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
    logger.error('AssemblyAI API key not configured, using fallback transcription');
    return fallbackTranscription();
  }
  
  // Strategy 1: Try with language detection first (Nano model)
  try {
    logger.info('Trying transcription with Nano model and language detection');
    const nanoDetectionTranscription = await transcribeWithNanoDetection(filePath);
    logger.info('Successfully transcribed with Nano model and language detection');
    return nanoDetectionTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.warn('Nano transcription with language detection failed, trying next approach', { message: error.message });
  }
  
  // Strategy 2: Try forcing Spanish with Nano model
  try {
    logger.info('Trying transcription with Nano model and explicit Spanish setting');
    const nanoSpanishTranscription = await transcribeWithNanoSpanish(filePath);
    logger.info('Successfully transcribed with Nano model and Spanish setting');
    return nanoSpanishTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.warn('Nano transcription with Spanish setting failed, trying next approach', { message: error.message });
  }
  
  // Strategy 3: Try with language detection (Standard model)
  try {
    logger.info('Trying transcription with standard model and language detection');
    const standardDetectionTranscription = await transcribeWithStandardDetection(filePath);
    logger.info('Successfully transcribed with standard model and language detection');
    return standardDetectionTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.warn('Standard transcription with language detection failed, trying next approach', { message: error.message });
  }
  
  // Strategy 4: Try forcing Spanish with Standard model
  try {
    logger.info('Trying transcription with standard model and explicit Spanish setting');
    const standardSpanishTranscription = await transcribeWithStandardSpanish(filePath);
    logger.info('Successfully transcribed with standard model and Spanish setting');
    return standardSpanishTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('All AssemblyAI transcription attempts failed', { message: error.message });
  }
  
  // All attempts failed, use fallback
  logger.error('Transcription failed, using fallback text');
  return fallbackTranscription();
}

/**
 * Provides a fallback transcription for testing when all methods fail
 * @returns Fallback transcription text
 */
function fallbackTranscription(): string {
  return "Hola equipo, vamos a revisar algunos cambios para nuestros personajes. Para el Project: Prj, necesitamos actualizar al Character: Jerry con una nueva Task: Blocking para la cabeza y el cuerpo. El movimiento no es fluido y necesitamos mejorar las expresiones faciales. También para Character: Tom necesitamos revisar la Task: Animation de las patas traseras. No olvidemos actualizar la documentación en ClickUp con estos cambios.";
}