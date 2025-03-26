import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import config from '../config/env';
import logger from '../config/logger';
import { ExtractedInfo, ApiError } from '../types';
import fs from 'fs';
import path from 'path';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Clean and fix JSON string to make it parseable
 * @param str - Potentially malformed JSON string
 * @returns Cleaned JSON string
 */
function cleanJsonString(str: string): string {
  // Remove markdown code blocks
  let cleaned = str.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Find the first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // Fix common JSON errors
  cleaned = cleaned
    .replace(/,\s*}/g, '}')              // Remove trailing commas in objects
    .replace(/,\s*\]/g, ']')             // Remove trailing commas in arrays
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":')  // Ensure property names are quoted
    .replace(/:\s*'/g, ': "')            // Replace single quotes with double quotes for values
    .replace(/'\s*,/g, '",')             // Replace single quotes with double quotes for values
    .replace(/'\s*}/g, '"}')             // Replace single quotes with double quotes for values
    .replace(/'\s*]/g, '"]')             // Replace single quotes with double quotes for values
    .replace(/\\'/g, "'")                // Fix escaped single quotes
    .replace(/\\"/g, '"')                // Fix escaped double quotes
    .replace(/\\/g, '\\\\')              // Escape backslashes
    .replace(/\n/g, '')                  // Remove newlines
    .replace(/\r/g, '')                  // Remove carriage returns
    .replace(/\t/g, '')                  // Remove tabs
    .replace(/\s+/g, ' ')                // Normalize whitespace
    .trim();

  // Try to fix unquoted property values
  cleaned = cleaned.replace(/"([\w]+)":\s*([\w]+)/g, '"$1": "$2"');
  
  return cleaned;
}

/**
 * Extract character, project and task information from transcribed text using Gemini
 * @param text - The transcribed text to analyze
 * @returns Array of extracted information
 */
export const extractInformationWithGemini = async (text: string): Promise<ExtractedInfo[]> => {
  try {
    logger.info('Extracting information using Google Gemini 2.0 Pro Experimental');
    logger.info(`Text to analyze (first 200 chars): ${text.substring(0, 200)}...`);
    
    // For debugging: Write full transcript to file
    try {
      const debugDir = path.join(__dirname, '../../debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, `transcript_${Date.now()}.txt`), text);
    } catch (err) {
      logger.warn('Could not write debug transcript file', { error: (err as Error).message });
    }
    
    // Initialize the model with the correct name
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-pro-exp-02-05",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        }
      ]
    });
    
    // Optimized prompt focused on JSON formatting and specific to the task
    const prompt = `
    Analyze this transcription of a conversation about animated characters.

    You must identify three elements:
    1. Project name (default to "Prj" if not mentioned)
    2. Character names (e.g., Tom, Jerry, Mickey) - only animated characters, not real people
    3. Tasks associated with each character (e.g., Blocking, Animation, Rigging)
    
    YOUR RESPONSE MUST BE VALID JSON in this format:
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
    
    If you find no characters, return: {"characters": [], "project": "Prj"}
    
    Return only the JSON with no additional text or explanations.

    TRANSCRIPTION:
    ${text}
    `;
    
    // Generate content with low temperature for precise extraction
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
      }
    });
    
    const response = await result.response;
    const responseText = response.text();
    
    logger.info('Gemini analysis completed');
    
    // Save raw response for debugging
    try {
      const debugDir = path.join(__dirname, '../../debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(debugDir, `gemini_response_${Date.now()}.txt`), responseText);
    } catch (err) {
      logger.warn('Could not write debug Gemini response file', { error: (err as Error).message });
    }
    
    // Parse the JSON response
    let parsedData: any;
    
    try {
      // First attempt: Direct JSON parsing
      parsedData = JSON.parse(responseText.trim());
      logger.info('Successfully parsed JSON directly');
    } catch (e) {
      logger.warn('Direct JSON parsing failed, trying to extract JSON from response');
      
      // Second attempt: Extract JSON object using regex
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/{[\s\S]*"characters"[\s\S]*}/);
      
      if (jsonMatch) {
        try {
          const jsonText = jsonMatch[1] || jsonMatch[0];
          parsedData = JSON.parse(jsonText.trim());
          logger.info('Successfully parsed extracted JSON');
        } catch (e2) {
          logger.error('Failed to parse extracted JSON, trying cleanup');
          
          // Third attempt: Clean and fix JSON
          const cleanedJson = cleanJsonString(jsonMatch[1] || jsonMatch[0]);
          
          try {
            parsedData = JSON.parse(cleanedJson);
            logger.info('Successfully parsed cleaned JSON');
          } catch (e3) {
            logger.error('All JSON parsing attempts failed');
            throw new Error('Unable to extract valid JSON from Gemini response after multiple attempts');
          }
        }
      } else {
        logger.error('No JSON structure found in response');
        throw new Error('No JSON structure found in Gemini response');
      }
    }
    
    // Validate and normalize the structure
    if (!parsedData.characters) {
      parsedData.characters = [];
    }
    
    if (!parsedData.project) {
      parsedData.project = "Prj";
    }
    
    // Post-process to validate characters are actually in the transcript
    const validatedCharacters: any[] = [];
    for (const character of parsedData.characters) {
      if (text.toLowerCase().includes(character.name.toLowerCase())) {
        validatedCharacters.push(character);
      } else {
        logger.warn(`Removed character "${character.name}" as it was not found in the transcript`);
      }
    }
    parsedData.characters = validatedCharacters;
    
    logger.info(`Parsed Gemini data: ${JSON.stringify(parsedData)}`);
    
    // Map the response to our ExtractedInfo format
    const results: ExtractedInfo[] = [];
    const project = parsedData.project || 'Prj';
    
    for (const character of parsedData.characters) {
      if (!character.tasks || character.tasks.length === 0) {
        logger.warn(`No tasks found for character ${character.name}`);
        continue;
      }
      
      for (const task of character.tasks) {
        if (!task) continue; // Skip empty tasks
        
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
    logger.info(`Found characters: ${characterNames || 'None'}`);
    logger.info(`Found tasks: ${taskNames || 'None'}`);
    logger.info(`Extracted ${results.length} character/task combinations`);
    
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information with Gemini', { message: error.message });
    throw error;
  }
};