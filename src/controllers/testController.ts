import { Request, Response } from 'express';
import logger from '../config/logger';
import { downloadFile, convertToMp3, cleanupFiles } from '../services/audioService';
import { extractInformationWithLemur } from '../services/extractionService';
import { updateClickUpTask } from '../services/clickupService';
import { ApiError } from '../types';

export const testGoogleDriveAudio = async (req: Request, res: Response): Promise<void> => {
  const filesToCleanup: string[] = [];
  
  try {
    logger.info('Testing with Google Drive audio file');
    
    // Google Drive file URL
    const driveUrl = 'https://drive.google.com/uc?export=download&id=1pIX9suPfg4L8_iOP7nmlRyWp_UIaU21t';
    
    // Download file
    logger.info(`Downloading file from ${driveUrl}`);
    const downloadedFilePath = await downloadFile(driveUrl);
    filesToCleanup.push(downloadedFilePath);
    
    // Convert to MP3
    logger.info(`Converting file to MP3: ${downloadedFilePath}`);
    const mp3FilePath = await convertToMp3(downloadedFilePath);
    filesToCleanup.push(mp3FilePath);
    
    // Extract information using LLM
    logger.info(`Extracting information from MP3: ${mp3FilePath}`);
    const extractedInfos = await extractInformationWithLemur(mp3FilePath);
    
    // Handle empty results gracefully
    if (extractedInfos.length === 0) {
      logger.info('No character/task combinations found in audio file');
      
      // Return success response with empty results
      res.status(200).json({
        status: 'success',
        message: 'Processing completed. No animation characters detected in audio.',
        results: {
          extractedInfo: [],
          clickUpUpdates: []
        }
      });
      return;
    }
    
    logger.info(`Successfully extracted ${extractedInfos.length} character/task combinations`);
    
    // Update ClickUp for each extracted info
    const updateResults = [];
    for (const info of extractedInfos) {
      try {
        logger.info(`Updating ClickUp for character: ${info.character}, task: ${info.task}`);
        await updateClickUpTask(info);
        updateResults.push({
          character: info.character,
          task: info.task,
          status: 'success'
        });
        logger.info(`Successfully updated ClickUp for character ${info.character}`);
      } catch (updateErr: unknown) {
        const updateError = updateErr as ApiError;
        logger.error(`Failed to update ClickUp for character ${info.character}`, { 
          message: updateError.message,
          stack: updateError.stack 
        });
        updateResults.push({
          character: info.character,
          task: info.task,
          status: 'error',
          error: updateError.message
        });
      }
    }
    
    // Return results
    res.status(200).json({
      status: 'success',
      results: {
        extractedInfo: extractedInfos,
        clickUpUpdates: updateResults
      }
    });
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Test failed', { 
      message: error.message,
      stack: error.stack 
    });
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  } finally {
    // Clean up temporary files
    if (filesToCleanup.length > 0) {
      logger.info(`Cleaning up ${filesToCleanup.length} temporary files`);
      await cleanupFiles(filesToCleanup);
    }
  }
};