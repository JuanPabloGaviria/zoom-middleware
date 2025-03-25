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
    
    // Initialize the model - using Pro for better Spanish understanding
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Use Pro instead of Flash
    
    // Create improved prompt for Gemini with stronger emphasis on Spanish understanding
    const prompt = `
      Analiza esta conversación en español sobre personajes de animación y sus tareas.
      
      IMPORTANTE: La conversación está principalmente en ESPAÑOL. El sistema está diseñado para identificar personajes de animación como Tom y Jerry, pero también debe reconocer otros personajes que se mencionen.
      
      Identifica lo siguiente:
      1. Nombres de personajes de animación que se mencionan en la conversación
      2. Tareas que deben realizarse con estos personajes (Blocking, Animation, Rigging, Modeling, etc.)
      3. El nombre del proyecto si se menciona (usa "Prj" como valor predeterminado si no se especifica)
      
      Instrucciones importantes:
      - NO incluyas a los participantes de la conversación como personajes.
      - Enfócate SOLO en los personajes de animación que se discuten.
      - Traduce los nombres de tareas del español al inglés (ej. "Animación" → "Animation", "Bloqueo" → "Blocking").
      - Las tareas estándar de animación incluyen: Blocking, Animation, Rigging, Modeling, Texturing, Lighting, Rendering.
      - Proporciona contexto para cada par personaje-tarea.
      
      Devuelve la información en este formato JSON exacto (respuesta solo en inglés):
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
      
      Aquí está la conversación para analizar:
      ${text}
    `;
    
    // Generate content with a higher temperature for more creative parsing
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      }
    });
    
    const response = await result.response;
    const responseText = response.text();
    
    logger.info('Gemini analysis completed');
    logger.debug(`Raw Gemini response: ${responseText}`);
    
    // Extract JSON from the response with improved parsing
    let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                   responseText.match(/```\n([\s\S]*?)\n```/) || 
                   responseText.match(/{[\s\S]*}/);
    
    let parsedData;
    
    if (jsonMatch) {
      try {
        parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (e) {
        logger.error('Failed to parse matched JSON', { match: jsonMatch[0] });
        // Try additional cleanup to fix common JSON parsing issues
        const cleanedJson = (jsonMatch[1] || jsonMatch[0])
          .replace(/,\s*}/g, '}')
          .replace(/,\s*\]/g, ']')
          .replace(/\\'/g, "'")
          .replace(/\\"/g, '"');
        
        try {
          parsedData = JSON.parse(cleanedJson);
        } catch (e2) {
          throw new Error('Invalid JSON format in Gemini response even after cleanup');
        }
      }
    } else {
      try {
        // Try to parse the entire response as JSON with additional cleanup
        const cleanedResponse = responseText
          .replace(/[\n\r]/g, ' ')
          .replace(/\s+/g, ' ')
          .match(/{.*}/);
          
        if (cleanedResponse) {
          parsedData = JSON.parse(cleanedResponse[0]);
        } else {
          throw new Error('No JSON found in response');
        }
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