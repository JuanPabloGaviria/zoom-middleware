import fs from 'fs';
import { OpenAI } from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../types';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export const transcribeAudio = async (filePath: string): Promise<string> => {
  try {
    logger.info(`Transcribing audio file: ${filePath}`);
    
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    
    logger.info(`File size: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 25) {
      throw new Error('File size exceeds OpenAI limit of 25MB');
    }
    
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "es",
      response_format: "text"
    });
    
    logger.info('Transcription completed successfully');
    return transcription;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error transcribing audio', { message: error.message });
    throw new Error(`Transcription failed: ${error.message}`);
  }
};