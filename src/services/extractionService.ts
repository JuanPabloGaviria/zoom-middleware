import logger from '../config/logger';
import { ExtractedInfo, ApiError } from '../types';

/**
 * Extracts character, project and task information from transcribed text
 * @param text - The transcribed text to analyze
 * @returns Array of extracted information
 */
export const extractInformation = (text: string): ExtractedInfo[] => {
  try {
    logger.info('Extracting information from text');
    
    // Log a sample of the transcription for debugging
    const sampleLength = Math.min(text.length, 150);
    logger.info(`Transcription sample: ${text.substring(0, sampleLength)}...`);
    
    // Complete transcription for internal processing
    logger.debug(`Complete transcription: ${text}`);

    // Define patterns for explicit mentions in both Spanish and English
    const projectPatterns = [
      /(?:Project|Proyecto|Prj|Projecto|Proj):\s*(\w+)/gi,
      /(?:para el|para la|en el|en la)\s+(?:Project|Proyecto|Prj|Projecto|Proj)\s+(\w+)/gi,
      /(?:Project|Proyecto|Prj|Projecto|Proj)\s+(\w+)/gi
    ];
    
    const characterPatterns = [
      /(?:Character|Personaje|Char|Personage|Personajes):\s*(\w+)/gi,
      /(?:personaje|character)\s+(?:de|named|llamado)?\s+(\w+)/gi,
      /(\w+)(?:\s+(?:character|personaje))/gi,
      /(?:el personaje|el character|la character|character)\s+(\w+)/gi
    ];
    
    const taskPatterns = [
      /(?:Task|Tarea|Trabajo|Actividad):\s*(\w+)/gi,
      /(?:hacer|realizar|implementar|trabajar en|mejorar|update|actualizar)\s+(?:la|el)?\s*(\w+)/gi,
      /(?:task|tarea)\s+(?:de|para|on)?\s+(\w+)/gi,
      /(\w+)(?:\s+(?:task|tarea))/gi
    ];
    
    // Common animation-related tasks
    const knownTasks = [
      "Blocking", "Animation", "Rigging", "Modeling", "Texturing", 
      "Rendering", "Compositing", "Lighting", "Efecto", "Effect",
      "Character", "Design", "Diseño", "Animación", "Bloqueo",
      "Movimiento", "Movement", "Head", "Cabeza", "Body", "Cuerpo",
      "Facial", "Expression", "Expresión", "Legs", "Piernas", "Arms",
      "Brazos", "Voice", "Voz", "Audio", "Sonido", "Sound"
    ];
    
    // Known character names
    const knownCharacters = [
      "Tom", "Jerry", "Mickey", "Donald", "Goofy", "Minnie", 
      "Daisy", "Pluto", "SpongeBob", "Patrick", "Batman", "Superman",
      "Mario", "Luigi", "Sonic", "Pikachu", "Mr Krabs", "Squidward"
    ];
    
    let projects: string[] = [];
    let characters: string[] = [];
    let tasks: string[] = [];
    let match: RegExpExecArray | null;
    
    // Extract projects using multiple patterns
    for (const pattern of projectPatterns) {
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !projects.includes(match[1])) {
          projects.push(match[1]);
        }
      }
    }
    
    // Extract characters using multiple patterns
    for (const pattern of characterPatterns) {
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !characters.includes(match[1])) {
          characters.push(match[1]);
        }
      }
    }
    
    // Extract tasks using multiple patterns
    for (const pattern of taskPatterns) {
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !tasks.includes(match[1])) {
          tasks.push(match[1]);
        }
      }
    }
    
    // If explicit patterns didn't find characters, search for known character names
    if (characters.length === 0) {
      logger.info('No explicit character mentions found, searching for known character names');
      
      // Check for character names in the text
      for (const character of knownCharacters) {
        const regex = new RegExp(`\\b${character}\\b`, 'i');
        if (regex.test(text)) {
          logger.info(`Found character by name: ${character}`);
          if (!characters.includes(character)) {
            characters.push(character);
          }
        }
      }
    }
    
    // If no tasks were identified, search for known task types
    if (tasks.length === 0) {
      logger.info('No explicit task mentions found, searching for known task types');
      
      for (const task of knownTasks) {
        const regex = new RegExp(`\\b${task}\\b`, 'i');
        if (regex.test(text)) {
          logger.info(`Found task by name: ${task}`);
          if (!tasks.includes(task)) {
            tasks.push(task);
          }
        }
      }
    }
    
    // Default project if needed
    if (projects.length === 0) {
      projects = ['Prj']; // Default project
      logger.info('No projects found, using default project: Prj');
    }
    
    // Log findings
    logger.info(`Found projects: ${projects.join(', ')}`);
    logger.info(`Found characters: ${characters.join(', ')}`);
    logger.info(`Found tasks: ${tasks.join(', ')}`);
    
    // Exit early if no characters or tasks found
    if (characters.length === 0 || tasks.length === 0) {
      logger.warn('Insufficient information found (missing characters or tasks)');
      return [];
    }
    
    // Analyze context and create task-character associations
    const results: ExtractedInfo[] = [];
    
    // Find sentences containing both character and task mentions
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    const characterTaskPairs: Map<string, string[]> = new Map();
    
    // First attempt to find direct associations in the same sentence
    for (const character of characters) {
      const characterRegex = new RegExp(`\\b${character}\\b`, 'i');
      const characterSentences = sentences.filter(s => characterRegex.test(s));
      
      const associatedTasks: string[] = [];
      
      for (const task of tasks) {
        const taskRegex = new RegExp(`\\b${task}\\b`, 'i');
        const hasTaskMention = characterSentences.some(s => taskRegex.test(s));
        
        if (hasTaskMention) {
          associatedTasks.push(task);
        }
      }
      
      if (associatedTasks.length > 0) {
        characterTaskPairs.set(character, associatedTasks);
      } else if (tasks.length > 0) {
        // If no direct association found, assign the first task
        characterTaskPairs.set(character, [tasks[0]]);
      }
    }
    
    // Generate results based on associations
    for (const [character, characterTasks] of characterTaskPairs.entries()) {
      for (const task of characterTasks) {
        // Find a context sentence for this character-task pair
        const context = findContextSentence(text, character, task);
        
        results.push({
          project: projects[0], // Use the first project
          character,
          task,
          context: context || "",
          confidence: 0.9 // Maintain compatibility with existing code
        });
      }
    }
    
    logger.info(`Extracted ${results.length} character/task combinations`);
    
    // If still no results, exit gracefully rather than using hardcoded values
    if (results.length === 0) {
      logger.warn('Unable to extract actionable character/task combinations from transcript');
      return [];
    }
    
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information', { message: error.message });
    throw new Error(`Extraction failed: ${error.message}`);
  }
};

/**
 * Finds a sentence that best represents the context for a character-task pair
 * @param text - The text to search in
 * @param character - The character name
 * @param task - The task name
 * @returns The most relevant context sentence, or null if not found
 */
const findContextSentence = (text: string, character: string, task: string): string | null => {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  // First, look for sentences containing both character and task
  const characterRegex = new RegExp(`\\b${character}\\b`, 'i');
  const taskRegex = new RegExp(`\\b${task}\\b`, 'i');
  
  const bothMentions = sentences.filter(s => 
    characterRegex.test(s) && taskRegex.test(s)
  );
  
  if (bothMentions.length > 0) {
    // Return the shortest sentence that mentions both (likely more concise)
    return bothMentions.sort((a, b) => a.length - b.length)[0];
  }
  
  // Next, look for sentences mentioning the character
  const characterMentions = sentences.filter(s => characterRegex.test(s));
  
  if (characterMentions.length > 0) {
    return characterMentions[0];
  }
  
  // Fall back to task mentions if no character mentions found
  const taskMentions = sentences.filter(s => taskRegex.test(s));
  
  if (taskMentions.length > 0) {
    return taskMentions[0];
  }
  
  return null;
};