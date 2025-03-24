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
    
    const projectPattern = /(?:Project|Proyecto|Prj):\s*(\w+)/gi;
    const characterPattern = /(?:Character|Personaje|Char):\s*(\w+)/gi;
    const taskPattern = /(?:Task|Tarea):\s*(\w+)/gi;
    
    let projects: string[] = [];
    let characters: string[] = [];
    let tasks: string[] = [];
    let match: RegExpExecArray | null;
    
    // Extract project names
    while ((match = projectPattern.exec(text)) !== null) {
      projects.push(match[1]);
    }
    
    // Extract character names
    while ((match = characterPattern.exec(text)) !== null) {
      characters.push(match[1]);
    }
    
    // Extract task names
    while ((match = taskPattern.exec(text)) !== null) {
      tasks.push(match[1]);
    }
    
    logger.debug('Extraction results', { projects, characters, tasks });
    
    // Default project if none found
    if (projects.length === 0) {
      projects = ['Prj'];
    }
    
    if (characters.length === 0) {
      logger.warn('No characters found in transcription');
      return [];
    }
    
    // Map characters to tasks and projects
    const results: ExtractedInfo[] = [];
    
    for (let i = 0; i < characters.length; i++) {
      results.push({
        project: projects.length > i ? projects[i] : projects[0],
        character: characters[i],
        task: tasks.length > i ? tasks[i] : (tasks.length > 0 ? tasks[0] : 'general'),
        context: findSentenceWithMention(text, characters[i]),
        confidence: 0.9
      });
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
 * Finds a sentence that mentions a specific term
 * @param text - The text to search in
 * @param mention - The term to find
 * @returns The sentence containing the mention, or empty string if not found
 */
const findSentenceWithMention = (text: string, mention: string): string => {
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(mention.toLowerCase())) {
      return sentence.trim();
    }
  }
  return '';
};

/**
 * Advanced extraction that uses context analysis
 * @param text - The text to analyze
 * @returns Array of extracted information
 */
export const extractInformationWithContext = (text: string): ExtractedInfo[] => {
  try {
    // Start with basic extraction
    const basicResults = extractInformation(text);
    
    if (basicResults.length > 0) {
      return basicResults;
    }
    
    // If basic extraction found nothing, try more advanced contextual extraction
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const results: ExtractedInfo[] = [];
    
    // Known characters and tasks in the animation domain
    const knownCharacters = ["Tom", "Jerry", "Mickey", "Donald", "Goofy", "Daffy"];
    const knownTasks = ["blocking", "animation", "modeling", "rendering", "rigging", "texturing"];
    
    // Action verbs that might indicate tasks
    const actionVerbs = ["improve", "change", "review", "modify", "update"];
    
    // Analyze each sentence
    for (const sentence of sentences) {
      // Find characters mentioned
      const foundCharacters = knownCharacters.filter(character => 
        new RegExp(`\\b${character}\\b`, 'i').test(sentence)
      );
      
      if (foundCharacters.length === 0) continue;
      
      // Find tasks mentioned
      let foundTask = "general";
      let confidence = 0.5;
      
      // Check for known tasks
      for (const task of knownTasks) {
        if (new RegExp(`\\b${task}\\b`, 'i').test(sentence)) {
          foundTask = task;
          confidence = 0.8;
          break;
        }
      }
      
      // Check for action verbs that might indicate tasks
      if (foundTask === "general") {
        for (const verb of actionVerbs) {
          if (sentence.toLowerCase().includes(verb)) {
            const parts = sentence.toLowerCase().split(verb);
            if (parts.length > 1 && parts[1].trim()) {
              const words = parts[1].trim().split(/\s+/);
              if (words.length > 0) {
                // Use the first noun after the verb as the task
                foundTask = words[0];
                confidence = 0.6;
              }
            }
          }
        }
      }
      
      // Add a result for each character found
      for (const character of foundCharacters) {
        results.push({
          project: "Prj",
          character,
          task: foundTask,
          context: sentence.trim(),
          confidence
        });
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error in contextual extraction', { error });
    return [];
  }
};