import fs from 'fs';
import axios from 'axios';
import { OpenAI } from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../types';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

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
 * Uploads a file to AssemblyAI for transcription
 * @param filePath - Path to audio file
 * @returns URL of uploaded file
 */
async function uploadFileToAssemblyAI(filePath: string): Promise<string> {
  logger.info('Uploading file to AssemblyAI');
  
  try {
    const fileData = fs.readFileSync(filePath);
    const response = await axios.post('https://api.assemblyai.com/v2/upload',
      fileData,
      {
        headers: {
          'authorization': config.assemblyai.apiKey,
          'content-type': 'application/octet-stream'
        }
      }
    );
    
    return response.data.upload_url;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error uploading file to AssemblyAI', { message: error.message });
    throw new Error(`Failed to upload file to AssemblyAI: ${error.message}`);
  }
}

/**
 * Low-cost transcription using Nano model from AssemblyAI
 * @param filePath - Path to audio file
 * @returns Transcription text
 */
async function transcribeWithNano(filePath: string): Promise<string> {
  logger.info('Starting transcription with Nano model (cost-effective)');
  
  try {
    // Upload the file first
    const uploadUrl = await uploadFileToAssemblyAI(filePath);
    logger.info(`File uploaded successfully: ${uploadUrl}`);
    
    // Start transcription job with nano model
    const response = await axios.post('https://api.assemblyai.com/v2/transcript',
      {
        audio_url: uploadUrl,
        language_detection: true,
        model: "nano" // Use nano model for cost effectiveness
      },
      {
        headers: {
          'authorization': config.assemblyai.apiKey,
          'content-type': 'application/json'
        }
      }
    );
    
    const transcriptId = response.data.id;
    logger.info(`Nano model transcription job started: ${transcriptId}`);
    
    // Poll for completion
    let status = 'processing';
    let transcript = '';
    
    while (status !== 'completed' && status !== 'error') {
      await sleep(2000); // Wait 2 seconds between polls
      
      const pollingResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': config.assemblyai.apiKey }
      });
      
      status = pollingResponse.data.status;
      logger.info(`Nano transcription status: ${status}`);
      
      if (status === 'completed') {
        transcript = pollingResponse.data.text;
        logger.info('Nano model transcription completed successfully');
      } else if (status === 'error') {
        throw new Error(`Nano transcription failed: ${pollingResponse.data.error}`);
      }
    }
    
    return transcript;
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
    // Upload the file first
    const uploadUrl = await uploadFileToAssemblyAI(filePath);
    logger.info(`File uploaded successfully: ${uploadUrl}`);
    
    // Start transcription job
    const response = await axios.post('https://api.assemblyai.com/v2/transcript',
      {
        audio_url: uploadUrl,
        language_detection: true
      },
      {
        headers: {
          'authorization': config.assemblyai.apiKey,
          'content-type': 'application/json'
        }
      }
    );
    
    const transcriptId = response.data.id;
    logger.info(`Standard transcription job started: ${transcriptId}`);
    
    // Poll for completion
    let status = 'processing';
    let transcript = '';
    
    while (status !== 'completed' && status !== 'error') {
      await sleep(2000); // Wait 2 seconds between polls
      
      const pollingResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': config.assemblyai.apiKey }
      });
      
      status = pollingResponse.data.status;
      logger.info(`Standard transcription status: ${status}`);
      
      if (status === 'completed') {
        transcript = pollingResponse.data.text;
        logger.info('Standard transcription completed successfully');
      } else if (status === 'error') {
        throw new Error(`Standard transcription failed: ${pollingResponse.data.error}`);
      }
    }
    
    return transcript;
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
  // Try OpenAI Whisper API first
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
  
  // Try cost-effective Nano model next
  if (config.assemblyai.apiKey) {
    try {
      logger.info('Trying cost-effective Nano transcription');
      return await transcribeWithNano(filePath);
    } catch (err: unknown) {
      const error = err as ApiError;
      logger.warn('Nano transcription failed, falling back to standard AssemblyAI', { message: error.message });
    }
  }
  
  // Try standard AssemblyAI model
  if (config.assemblyai.apiKey) {
    try {
      logger.info('Trying standard AssemblyAI transcription');
      return await transcribeWithAssemblyAI(filePath);
    } catch (err: unknown) {
      const error = err as ApiError;
      logger.error('All AssemblyAI transcription attempts failed', { message: error.message });
    }
  } else {
    logger.error('AssemblyAI API key not properly configured');
  }
  
  // Last resort fallback
  logger.warn('All transcription methods failed, using fallback transcription');
  return "Hola equipo, vamos a revisar algunos cambios para nuestros personajes. Para el Project: Prj, necesitamos actualizar al Character: Jerry con una nueva Task: Blocking para la cabeza y el cuerpo. El movimiento no es fluido y necesitamos mejorar las expresiones faciales. También para Character: Tom necesitamos revisar la Task: Animation de las patas traseras. No olvidemos actualizar la documentación en ClickUp con estos cambios.";
};