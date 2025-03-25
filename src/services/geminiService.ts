import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import config from '../config/env';
import logger from '../config/logger';
import { ExtractedInfo, ApiError } from '../types';
import fs from 'fs';
import path from 'path';

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

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
    
    // Completely revised prompt focused on precise identification
    const prompt = `
      Esta es la transcripción completa de una reunión de animación en español. Necesito que analices el texto y extraigas ÚNICAMENTE los personajes animados mencionados junto con las tareas específicas que se discuten para cada uno.

      REGLAS ESTRICTAS:
      1. Solo incluye personajes animados que se mencionan EXPLÍCITAMENTE como personajes de animación
      2. Excluye COMPLETAMENTE nombres que son personas reales (como José, Luis, Javier, etc.)
      3. Para cada personaje, identifica solo las tareas específicas asignadas (como Blocking, Animation, Modeling, etc.)
      4. Si no hay tareas específicas asignadas a un personaje, no lo incluyas
      5. NO INVENTES personajes ni tareas que no estén claramente mencionados
      6. Si no encuentras ningún personaje de animación, devuelve un array vacío
      7. Tareas comunes incluyen: Modeling, Animation, Rigging, Blocking, Texturing, Lighting, Topology

      FORMATO DE RESPUESTA JSON:
      {
        "characters": [
          {
            "name": "NombrePersonaje",
            "tasks": ["Tarea1", "Tarea2"],
            "context": "Descripción exacta de lo que debe hacerse"
          }
        ],
        "project": "NombreProyecto"
      }

      Si no estás 100% seguro de que algo es un personaje animado, NO lo incluyas.
      
      TRANSCRIPCIÓN COMPLETA:
      ${text}
    `;
    
    // Generate content with very low temperature for precise extraction
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
    logger.info(`Raw Gemini response: ${responseText}`);
    
    // Parse JSON with robust error handling
    let parsedData;
    
    try {
      // First try direct JSON parsing
      parsedData = JSON.parse(responseText.trim());
    } catch (e) {
      logger.warn('Direct JSON parsing failed, trying to extract JSON from response');
      
      // Extract JSON with regex patterns
      const jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n\s*```/) || 
                        responseText.match(/```\s*\n([\s\S]*?)\n\s*```/) || 
                        responseText.match(/{[\s\S]*"characters"[\s\S]*}/);
      
      if (jsonMatch) {
        try {
          const jsonText = jsonMatch[1] || jsonMatch[0];
          parsedData = JSON.parse(jsonText);
        } catch (e2) {
          logger.error('Failed to parse extracted JSON, trying cleanup');
          
          // Enhanced cleanup for common JSON issues
          const cleanedJson = (jsonMatch[1] || jsonMatch[0])
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          try {
            parsedData = JSON.parse(cleanedJson);
          } catch (e3) {
            logger.error('All JSON parsing attempts failed');
            throw new Error('Unable to extract valid JSON from Gemini response after multiple attempts');
          }
        }
      } else {
        // If no JSON structure found, create a default empty structure
        logger.warn('No JSON structure found, returning empty results');
        parsedData = { characters: [], project: "Prj" };
      }
    }
    
    // Validate the structure
    if (!parsedData.characters) {
      parsedData.characters = [];
    }
    
    if (!parsedData.project) {
      parsedData.project = "Prj";
    }
    
    // Post-process to validate characters are actually in the transcript
    const validatedCharacters = [];
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