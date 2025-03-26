import axios from 'axios';
import logger from '../config/logger';
import { ApiError } from '../types';

/**
 * Interface for Zoom transcription response
 */
interface ZoomTranscription {
  recording_id: string;
  recording_start: string;
  recording_end: string;
  status: string;
  transcript_parts: TranscriptPart[];
}

/**
 * Interface for individual transcript segments
 */
interface TranscriptPart {
  start_time: number;
  end_time: number;
  text: string;
  speaker?: string;
  id?: string;
  confidence?: number;
}

/**
 * Retrieves transcription for a Zoom recording
 * @param recordingId - The Zoom recording ID
 * @param accessToken - OAuth access token for Zoom API
 * @returns Transcription text with optional speaker identification
 */
export const getZoomTranscription = async (recordingId: string, accessToken: string): Promise<string> => {
  try {
    logger.info(`Retrieving transcription for Zoom recording: ${recordingId}`);
    
    // Check if recording has transcription available
    const transcriptionStatusResponse = await axios.get(
      `https://api.zoom.us/v2/meetings/recordings/${recordingId}/transcript`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Check if transcription is available and complete
    if (transcriptionStatusResponse.data.status !== 'completed') {
      logger.warn(`Transcription not available or not completed for recording: ${recordingId}`);
      throw new Error(`Transcription not available for recording ID: ${recordingId}`);
    }
    
    // Retrieve the transcription data
    const transcriptionResponse = await axios.get(
      `https://api.zoom.us/v2/meetings/recordings/${recordingId}/transcript`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const transcription = transcriptionResponse.data as ZoomTranscription;
    
    // Process transcription parts into a coherent text
    let fullTranscript = '';
    let currentSpeaker = '';
    
    for (const part of transcription.transcript_parts) {
      // Format with speaker identification when available
      if (part.speaker && part.speaker !== currentSpeaker) {
        currentSpeaker = part.speaker;
        fullTranscript += `\n${currentSpeaker}: ${part.text}\n`;
      } else {
        fullTranscript += ` ${part.text}`;
      }
    }
    
    logger.info(`Successfully retrieved transcription for recording ${recordingId}`);
    logger.debug(`Transcription length: ${fullTranscript.length} characters`);
    
    return fullTranscript.trim();
  } catch (err) {
    const error = err as ApiError;
    logger.error('Error retrieving Zoom transcription', { 
      recordingId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    
    // Throw a more specific error
    throw new Error(`Failed to retrieve Zoom transcription: ${error.message}`);
  }
};

/**
 * Enables transcription for a Zoom meeting recording
 * @param meetingId - The Zoom meeting ID
 * @param recordingId - The Zoom recording ID
 * @param accessToken - OAuth access token for Zoom API
 * @returns Success message
 */
export const enableZoomTranscription = async (meetingId: string, recordingId: string, accessToken: string): Promise<string> => {
  try {
    logger.info(`Enabling transcription for meeting: ${meetingId}, recording: ${recordingId}`);
    
    // Request cloud recording transcription
    await axios.put(
      `https://api.zoom.us/v2/meetings/${meetingId}/recordings/${recordingId}/status`,
      {
        action: 'transcript'
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Successfully requested transcription for recording ${recordingId}`);
    return 'Transcription requested successfully';
  } catch (err) {
    const error = err as ApiError;
    logger.error('Error enabling Zoom transcription', { 
      meetingId,
      recordingId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    
    // Throw a more specific error
    throw new Error(`Failed to enable Zoom transcription: ${error.message}`);
  }
};