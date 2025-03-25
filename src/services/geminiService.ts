import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
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
    logger.info('Extracting information using Google Gemini 2.0 Pro Experimental');
    logger.info(`Text to analyze: ${text.substring(0, 200)}...`);
    
    // Initialize the Gemini 2.0 Pro Experimental model
    // This is the experimental version with enhanced capabilities
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
    
    // Create more specific prompt focused on exact character and task extraction
    const prompt = `
      CONVERSACIÓN DE ANIMACIÓN: EXTRACCIÓN DE PERSONAJES Y TAREAS
      
      La siguiente es una transcripción en español de una reunión de animación. Necesito que identifiques con precisión:
      
      1. PERSONAJES ANIMADOS mencionados (como Tom, Jerry, etc.)
      2. TAREAS específicas que deben realizarse para estos personajes
      3. PROYECTO al que pertenecen (usa "Prj" si no se especifica)
      
      INSTRUCCIONES CRÍTICAS:
      - Analiza con extremo cuidado cada mención de nombres que podrían ser personajes
      - La transcripción es de una reunión real y los personajes pueden tener nombres como: Tom, Jerry, Alfale, Pietro, Jane, Fairy, Chain, Butterworth, Goodfellow u otros nombres propios
      - Las tareas pueden incluir: Blocking, Animation, Rigging, Modeling, Texturing, Topology, etc.
      - Identifica exactamente las tareas mencionadas para cada personaje
      - NO inventes personajes o tareas que no están explícitamente mencionados
      - Captura el contexto exacto de lo que se debe hacer con cada personaje
      - NO CONFUNDAS personas reales (José, Luis, Javier) con personajes animados
      
      FORMATO DE RESPUESTA:
      Devuelve ÚNICAMENTE un objeto JSON válido con este formato exacto:
      {
        "characters": [
          {
            "name": "NombrePersonaje",
            "tasks": ["Tarea1", "Tarea2"],
            "context": "Descripción breve y exacta de lo que debe hacerse"
          }
        ],
        "project": "NombreProyecto"
      }
      
      TRANSCRIPCIÓN:
      ${text}
    `;
    
    // Generate content with configuration optimized for precise extraction
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,      // Lower temperature for more precise extraction
        topP: 0.95,            // Higher topP to allow for more precise outputs
        topK: 40,
        maxOutputTokens: 4096,
      }
    });
    
    const response = await result.response;
    const responseText = response.text();
    
    logger.info('Gemini analysis completed');
    logger.info(`Raw Gemini response: ${responseText}`);
    
    // Improved JSON extraction with robust parsing
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
        throw new Error('No JSON structure found in Gemini response');
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