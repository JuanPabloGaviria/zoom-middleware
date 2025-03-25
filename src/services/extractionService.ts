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
    
    // List of specific characters to detect (case-insensitive)
    const TARGET_CHARACTERS = ['tom', 'jerry', 'mickey', 'donald'];
    
    // List of specific tasks to detect (case-insensitive)
    const TARGET_TASKS = ['blocking', 'animation', 'rigging', 'modeling', 'texturing'];
    
    // Define strict patterns for explicit mentions
    const projectPattern = /\b(?:project|proyecto|prj)\s*:\s*(\w+)\b/i;
    const characterPattern = /\b(?:character|personaje|char)\s*:\s*(\w+)\b/i;
    const taskPattern = /\b(?:task|tarea)\s*:\s*(\w+)\b/i;
    
    // Storage for found entities
    let projects: string[] = [];
    let characters: string[] = [];
    let tasks: string[] = [];
    
    // Extract explicit project mentions
    const projectMatches = text.match(new RegExp(projectPattern, 'gi')) || [];
    for (const match of projectMatches) {
      const result = projectPattern.exec(match);
      if (result && result[1]) {
        const project = result[1].trim();
        if (project && !projects.includes(project)) {
          projects.push(project);
        }
      }
    }
    
    // Extract explicit character mentions
    const characterMatches = text.match(new RegExp(characterPattern, 'gi')) || [];
    for (const match of characterMatches) {
      const result = characterPattern.exec(match);
      if (result && result[1]) {
        const character = result[1].trim();
        // Validate: Only accept known characters or explicitly mentioned ones
        if (character && 
            (TARGET_CHARACTERS.includes(character.toLowerCase()) || 
             match.toLowerCase().includes('character:') || 
             match.toLowerCase().includes('personaje:')) && 
            !characters.includes(character)) {
          characters.push(character);
        }
      }
    }
    
    // Extract explicit task mentions
    const taskMatches = text.match(new RegExp(taskPattern, 'gi')) || [];
    for (const match of taskMatches) {
      const result = taskPattern.exec(match);
      if (result && result[1]) {
        const task = result[1].trim();
        // Validate: Only accept known tasks or explicitly mentioned ones
        if (task && 
            (TARGET_TASKS.includes(task.toLowerCase()) || 
             match.toLowerCase().includes('task:') || 
             match.toLowerCase().includes('tarea:')) && 
            !tasks.includes(task)) {
          tasks.push(task);
        }
      }
    }
    
    // Secondary phase: Look for target characters by name if none found yet
    if (characters.length === 0) {
      for (const character of TARGET_CHARACTERS) {
        // Use word boundary to avoid partial matches
        const characterRegex = new RegExp(`\\b${character}\\b`, 'i');
        if (characterRegex.test(text)) {
          logger.info(`Found target character: ${character}`);
          characters.push(character);
        }
      }
    }
    
    // Secondary phase: Look for target tasks by name if none found yet
    if (tasks.length === 0) {
      for (const task of TARGET_TASKS) {
        // Use word boundary to avoid partial matches
        const taskRegex = new RegExp(`\\b${task}\\b`, 'i');
        if (taskRegex.test(text)) {
          logger.info(`Found target task: ${task}`);
          tasks.push(task);
        }
      }
    }
    
    // Default project if needed - only use "Prj" as specified
    if (projects.length === 0) {
      projects = ['Prj']; // Default project as specified in requirements
      logger.info('No projects found, using default project: Prj');
    }
    
    // Log findings
    logger.info(`Found projects: ${projects.join(', ')}`);
    logger.info(`Found characters: ${characters.join(', ')}`);
    logger.info(`Found tasks: ${tasks.join(', ')}`);
    
    // Exit if no characters or tasks identified
    if (characters.length === 0 || tasks.length === 0) {
      logger.warn('No valid characters or tasks found in transcription');
      return [];
    }
    
    // Match characters to tasks with context
    const results: ExtractedInfo[] = [];
    
    // Break text into sentences for context analysis
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // For each character, try to find associated tasks
    for (const character of characters) {
      // Find sentences mentioning this character
      const characterRegex = new RegExp(`\\b${character}\\b`, 'i');
      const characterSentences = sentences.filter(s => characterRegex.test(s));
      
      // If specific task associations found in sentences
      let associatedTasks: string[] = [];
      
      for (const task of tasks) {
        const taskRegex = new RegExp(`\\b${task}\\b`, 'i');
        // Check if any sentence contains both character and task
        const hasAssociation = characterSentences.some(s => taskRegex.test(s));
        
        if (hasAssociation) {
          associatedTasks.push(task);
        }
      }
      
      // If no specific associations found, use the first task
      if (associatedTasks.length === 0 && tasks.length > 0) {
        associatedTasks = [tasks[0]];
      }
      
      // Create entries for each character-task combination
      for (const task of associatedTasks) {
        // Find most relevant context sentence
        const context = findBestContextSentence(sentences, character, task);
        
        results.push({
          project: projects[0],
          character,
          task,
          context: context || "",
          confidence: 0.9
        });
      }
    }
    
    logger.info(`Extracted ${results.length} character/task combinations`);
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information', { message: error.message });
    throw new Error(`Extraction failed: ${error.message}`);
  }
};

/**
 * Finds the best context sentence for a character-task pair
 * @param sentences - Array of sentences from the text
 * @param character - Character name to find
 * @param task - Task name to find
 * @returns The best context sentence or null if none found
 */
function findBestContextSentence(sentences: string[], character: string, task: string): string | null {
  const characterRegex = new RegExp(`\\b${character}\\b`, 'i');
  const taskRegex = new RegExp(`\\b${task}\\b`, 'i');
  
  // First priority: Sentences containing both character and task mentions
  const jointMentions = sentences.filter(s => characterRegex.test(s) && taskRegex.test(s));
  if (jointMentions.length > 0) {
    // Return the shortest one for conciseness
    return jointMentions.sort((a, b) => a.length - b.length)[0];
  }
  
  // Second priority: Sentences containing character mentions
  const characterMentions = sentences.filter(s => characterRegex.test(s));
  if (characterMentions.length > 0) {
    return characterMentions[0];
  }
  
  // Third priority: Sentences containing task mentions
  const taskMentions = sentences.filter(s => taskRegex.test(s));
  if (taskMentions.length > 0) {
    return taskMentions[0];
  }
  
  return null;
}