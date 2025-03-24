import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { spawn } from 'child_process';
import axios, { AxiosRequestConfig } from 'axios';
import logger from '../config/logger';
import { AudioProcessingResult, ApiError } from '../types';

const exec = promisify(require('child_process').exec);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../../tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Downloads a file from a given URL
 * @param url - The URL to download from
 * @param downloadToken - Optional OAuth token for authenticated downloads
 * @returns Path to the downloaded file
 */
export const downloadFile = async (url: string, downloadToken?: string): Promise<string> => {
  try {
    logger.info(`Downloading file from ${url}`);
    
    const headers: Record<string, string> = {};
    if (downloadToken) {
      headers['Authorization'] = `Bearer ${downloadToken}`;
    }
    
    const config: AxiosRequestConfig = {
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      headers
    };
    
    const response = await axios(config);
    
    if (!response.data) {
      throw new Error('No data received from download URL');
    }
    
    const filePath = path.join(tempDir, `download_${Date.now()}.mp4`);
    await writeFile(filePath, response.data);
    
    // Verify the file was created
    if (!fs.existsSync(filePath)) {
      throw new Error('Failed to write downloaded file to disk');
    }
    
    const stats = fs.statSync(filePath);
    logger.info(`File downloaded to ${filePath} (${Math.round(stats.size / 1024)} KB)`);
    
    return filePath;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error downloading file', { 
      message: error.message, 
      stack: error.stack 
    });
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Converts a video/audio file to MP3 format
 * @param inputPath - Path to the input file
 * @returns Path to the converted MP3 file
 */
export const convertToMp3 = async (inputPath: string): Promise<string> => {
  try {
    logger.info(`Converting file to MP3: ${inputPath}`);
    
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    
    const outputPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    
    return new Promise<string>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vn',                 // No video
        '-ar', '16000',        // Audio sample rate
        '-ac', '1',            // Mono channel
        '-b:a', '32k',         // Bitrate
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            logger.info(`File converted successfully to ${outputPath} (${Math.round(stats.size / 1024)} KB)`);
            resolve(outputPath);
          } else {
            reject(new Error(`FFmpeg process completed but output file not found: ${outputPath}`));
          }
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });
      
      ffmpeg.stderr.on('data', (data) => {
        logger.debug(`FFmpeg: ${data.toString()}`);
      });
      
      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      });
    });
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error converting file', { 
      message: error.message, 
      stack: error.stack 
    });
    throw new Error(`Failed to convert file: ${error.message}`);
  }
};

/**
 * Cleans up temporary files
 * @param files - Array of file paths to delete
 */
export const cleanupFiles = async (files: string[]): Promise<void> => {
  try {
    for (const file of files) {
      if (fs.existsSync(file)) {
        await unlink(file);
        logger.info(`Cleaned up file: ${file}`);
      } else {
        logger.warn(`File not found for cleanup: ${file}`);
      }
    }
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error cleaning up files', { 
      message: error.message, 
      stack: error.stack 
    });
    // We don't throw here, just log the error as cleanup is a best-effort operation
  }
};

/**
 * Process an audio file (download and convert if needed)
 * @param sourceUrl - URL of the audio file
 * @param downloadToken - Optional download token
 * @returns Processing result with file paths
 */
export const processAudioFile = async (sourceUrl: string, downloadToken?: string): Promise<AudioProcessingResult> => {
  let originalPath: string | null = null;
  
  try {
    // Download the file
    originalPath = await downloadFile(sourceUrl, downloadToken);
    
    // Convert to MP3
    const processedPath = await convertToMp3(originalPath);
    
    // Get file size
    const stats = fs.statSync(processedPath);
    
    return {
      originalPath,
      processedPath,
      fileSize: stats.size
    };
  } catch (error) {
    // Clean up the original file if it exists and an error occurred
    if (originalPath && fs.existsSync(originalPath)) {
      try {
        await unlink(originalPath);
      } catch (cleanupErr: unknown) {
        const cleanupError = cleanupErr as Error;
        logger.error('Error cleaning up after processing failure', { message: cleanupError.message });
      }
    }
    
    throw error;
  }
};