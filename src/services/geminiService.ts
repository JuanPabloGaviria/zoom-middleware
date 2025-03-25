import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/env';
import logger from '../config/logger';
import { ExtractedInfo, ApiError } from '../types';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Extract character, project and task information from transcribed text using Gemini
 * @param text - The transcribed text to analyze
 * @returns Array of extracted information
 */
export const extractInformationWithGemini = async (text: string): Promise<ExtractedInfo[]> => {
  try {
    logger.info('Extracting information using Google Gemini');
    logger.info(`Text to analyze: ${text.substring(0, 200)}...`);
    
    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Create prompt for Gemini
    const prompt = `
      Please analyze this conversation about animated characters and their tasks. The conversation may be in Spanish, but I need your responses in English.
      
      Identify the following:
      1. Animation character names (e.g., Tom, Jerry, Mickey, Donald, etc.)
      2. Tasks that need to be performed on these characters (e.g., Blocking, Animation, Rigging, Modeling, etc.)
      3. The project name if mentioned (default to "Prj" if not specified)
      
      Important instructions:
      - Do NOT include the speakers/participants of this conversation as characters.
      - Focus ONLY on animated characters being discussed.
      - Translate any Spanish task names to their English equivalents (e.g., "Animación" → "Animation", "Bloqueo" → "Blocking").
      - Standard animation tasks include: Blocking, Animation, Rigging, Modeling, Texturing, Lighting, Rendering.
      - If you're uncertain about a task name, keep it in its original form.
      - Provide context for each character-task pair.
      
      Return the information in this exact JSON format:
      {
        "characters": [
          {
            "name": "CharacterName",
            "tasks": ["Task1", "Task2"],
            "context": "Brief description of what needs to be done"
          }
        ],
        "project": "ProjectName"
      }
      
      Here is the conversation to analyze:
      ${text}
    `;
    
    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    logger.info('Gemini analysis completed');
    logger.info(`Raw Gemini response: ${responseText}`);
    
    // Extract JSON from the response
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                   responseText.match(/```\n([\s\S]*?)\n```/) || 
                   responseText.match(/{[\s\S]*}/);
    
    let parsedData;
    
    if (jsonMatch) {
      try {
        parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (e) {
        logger.error('Failed to parse matched JSON', { match: jsonMatch[0] });
        throw new Error('Invalid JSON format in Gemini response');
      }
    } else {
      try {
        // Try to parse the entire response as JSON
        parsedData = JSON.parse(responseText);
      } catch (e) {
        logger.error('Failed to parse Gemini response as JSON', { response: responseText });
        throw new Error('Failed to get valid JSON from Gemini response');
      }
    }
    
    logger.info(`Parsed Gemini data: ${JSON.stringify(parsedData)}`);
    
    if (!parsedData.characters || parsedData.characters.length === 0) {
      logger.error('No characters found in Gemini response');
      throw new Error('No characters found in Gemini analysis');
    }
    
    // Map the response to our ExtractedInfo format
    const results: ExtractedInfo[] = [];
    const project = parsedData.project || 'Prj';
    
    for (const character of parsedData.characters) {
      if (!character.tasks || character.tasks.length === 0) {
        logger.warn(`No tasks found for character ${character.name}`);
        continue;
      }
      
      for (const task of character.tasks) {
        results.push({
          project: project,
          character: character.name,
          task: task,
          context: character.context || `${task} for character ${character.name}`,
          confidence: 0.95
        });
      }
    }
    
    // Log findings
    const characterNames = parsedData.characters.map((c: any) => c.name).join(', ');
    const taskNames = parsedData.characters
      .flatMap((c: any) => c.tasks || [])
      .join(', ');
    
    logger.info(`Found project: ${project}`);
    logger.info(`Found characters: ${characterNames}`);
    logger.info(`Found tasks: ${taskNames}`);
    logger.info(`Extracted ${results.length} character/task combinations`);
    
    if (results.length === 0) {
      throw new Error('No character/task combinations extracted');
    }
    
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information with Gemini', { message: error.message });
    throw error;
  }
};