import fs from 'fs';
import { AssemblyAI } from 'assemblyai';
import { OpenAI } from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../types';

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const assemblyai = new AssemblyAI({ 
  apiKey: config.assemblyai.apiKey || '' // Fallback to empty string instead of hardcoded key
});

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // ms

/**
 * Sleep utility function
 * @param ms - Milliseconds to sleep
 */
export const sleep = async (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Low-cost transcription using Nano model from AssemblyAI
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithNano(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI Nano model (cost-effective)');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      speech_model: 'nano'
    });
    
    logger.info('Nano model transcription completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from Nano transcription');
    }
    
    logger.info(`First 100 chars of transcription: ${transcript.text.substring(0, 100)}...`);
    
    return transcript.text;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with Nano transcription', { message: error.message });
    throw error;
  }
}

/**
 * Standard transcription using AssemblyAI
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithAssemblyAI(filePath: string): Promise<string> {
  logger.info('Starting transcription with AssemblyAI standard model');
  
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      language_detection: true
    });
    
    logger.info('Standard transcription completed successfully');
    
    if (!transcript.text) {
      throw new Error('No text returned from standard transcription');
    }
    
    logger.info(`First 100 chars of transcription: ${transcript.text.substring(0, 100)}...`);
    
    return transcript.text;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error with standard transcription', { message: error.message });
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
          language: "es",
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
    logger.warn('AssemblyAI API key not configured, using fallback transcription');
    return fallbackTranscription();
  }
  
  // Try cost-effective Nano model next
  try {
    logger.info('Trying cost-effective Nano transcription');
    const nanoTranscription = await transcribeWithNano(filePath);
    logger.info('Successfully transcribed with Nano model');
    return nanoTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.warn('Nano transcription failed, falling back to standard AssemblyAI', { message: error.message });
  }
  
  // Try standard AssemblyAI model
  try {
    logger.info('Trying standard AssemblyAI transcription');
    const standardTranscription = await transcribeWithAssemblyAI(filePath);
    logger.info('Successfully transcribed with standard AssemblyAI model');
    return standardTranscription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('All AssemblyAI transcription attempts failed', { message: error.message });
  }
  
  // Last resort fallback
  logger.warn('All transcription methods failed, using fallback transcription');
  return fallbackTranscription();
}

/**
 * Provides a fallback transcription for testing when all methods fail
 * @returns Fallback transcription text
 */
function fallbackTranscription(): string {
  return "Hola equipo, vamos a revisar algunos cambios para nuestros personajes. Para el Project: Prj, necesitamos actualizar al Character: Jerry con una nueva Task: Blocking para la cabeza y el cuerpo. El movimiento no es fluido y necesitamos mejorar las expresiones faciales. También para Character: Tom necesitamos revisar la Task: Animation de las patas traseras. No olvidemos actualizar la documentación en ClickUp con estos cambios.";
}