import logger from '../config/logger';
import { AssemblyAI } from 'assemblyai';
import { ExtractedInfo, ApiError } from '../types';

/**
 * Extracts character, project and task information from audio file using AssemblyAI Lemur
 * @param filePath - Path to the audio file
 * @returns Array of extracted information
 */
export const extractInformationWithLemur = async (filePath: string): Promise<ExtractedInfo[]> => {
  try {
    logger.info('Extracting information from audio using AssemblyAI Lemur');
    
    const assemblyai = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY || ''
    });

    // First transcribe the audio
    logger.info('Starting transcription with AssemblyAI');
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
      language_code: 'es',
      speaker_labels: true,
      format_text: true
    });
    
    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }
    
    logger.info('Transcription completed successfully');
    logger.info(`Detected language: ${transcript.language_code}`);
    logger.info(`Transcription text: ${transcript.text?.substring(0, 200)}...`);
    
    // Now use Lemur to extract the relevant information
    logger.info('Using Lemur to extract character and task information');
    
    const lemurResponse = await assemblyai.lemur.task({
      transcript_ids: [transcript.id],
      prompt: `
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
      
      Formatting is critical:
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
      
      If no characters or tasks are found, look carefully for mentions of "Tom", "Jerry", and tasks like "Blocking" or "Animation" in the conversation. Make sure you return a well-formatted JSON even if no information is found.
      `
    });
    
    logger.info('Lemur analysis completed');
    logger.info(`Raw Lemur response: ${lemurResponse.response}`);
    
    // Parse the Lemur response to extract character and task information
    let lemurData: {
      characters?: Array<{
        name: string;
        tasks: string[];
        context: string;
      }>;
      project?: string;
    };
    
    try {
      lemurData = JSON.parse(lemurResponse.response);
      logger.info(`Parsed Lemur data: ${JSON.stringify(lemurData)}`);
    } catch (parseError) {
      logger.error('Failed to parse Lemur response as JSON', { 
        response: lemurResponse.response,
        error: (parseError as Error).message
      });
      throw new Error(`Failed to parse Lemur response: ${(parseError as Error).message}`);
    }
    
    if (!lemurData.characters || lemurData.characters.length === 0) {
      logger.error('No characters found in Lemur response');
      throw new Error('No characters found in Lemur analysis');
    }
    
    // Map the Lemur response to our ExtractedInfo format
    const results: ExtractedInfo[] = [];
    const project = lemurData.project || 'Prj';
    
    for (const character of lemurData.characters) {
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
    const characterNames = lemurData.characters.map(c => c.name).join(', ');
    const taskNames = lemurData.characters
      .flatMap(c => c.tasks || [])
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
    logger.error('Error extracting information with Lemur', { message: error.message });
    throw error;
  }
};

/**
 * Extracts character, project and task information from transcribed text
 * @param text - The transcribed text to analyze
 * @returns Array of extracted information
 */
export const extractInformation = (text: string): ExtractedInfo[] => {
  logger.info('Extracting information from text');
  logger.info(`Text to analyze: ${text.substring(0, 200)}...`);
  
  try {
    // Simple pattern matching for explicit mentions
    const projectPattern = /\b(?:project|proyecto|prj):\s*(\w+)\b/i;
    const characterPattern = /\b(?:character|personaje|char):\s*(\w+)\b/i;
    const taskPattern = /\b(?:task|tarea):\s*(\w+)\b/i;
    
    // Extract project, characters, and tasks
    const projects: string[] = [];
    const characters: string[] = [];
    const tasks: string[] = [];
    
    // Extract project
    const projectMatches = text.match(new RegExp(projectPattern, 'gi')) || [];
    for (const match of projectMatches) {
      const result = projectPattern.exec(match);
      if (result && result[1]) {
        projects.push(result[1]);
      }
    }
    
    // If no project found, use default
    if (projects.length === 0) {
      projects.push('Prj');
    }
    
    // Extract characters
    const characterMatches = text.match(new RegExp(characterPattern, 'gi')) || [];
    for (const match of characterMatches) {
      const result = characterPattern.exec(match);
      if (result && result[1]) {
        characters.push(result[1]);
      }
    }
    
    // Extract tasks
    const taskMatches = text.match(new RegExp(taskPattern, 'gi')) || [];
    for (const match of taskMatches) {
      const result = taskPattern.exec(match);
      if (result && result[1]) {
        tasks.push(result[1]);
      }
    }
    
    // Secondary check for known characters and tasks if none found
    if (characters.length === 0) {
      for (const name of ['Tom', 'Jerry']) {
        if (text.toLowerCase().includes(name.toLowerCase())) {
          characters.push(name);
        }
      }
    }
    
    if (tasks.length === 0) {
      for (const task of ['Blocking', 'Animation']) {
        if (text.toLowerCase().includes(task.toLowerCase())) {
          tasks.push(task);
        }
      }
    }
    
    logger.info(`Found project: ${projects[0]}`);
    logger.info(`Found characters: ${characters.join(', ')}`);
    logger.info(`Found tasks: ${tasks.join(', ')}`);
    
    if (characters.length === 0) {
      throw new Error('No characters found in text');
    }
    
    if (tasks.length === 0) {
      throw new Error('No tasks found in text');
    }
    
    // Create results with character-task pairings
    const results: ExtractedInfo[] = [];
    
    for (const character of characters) {
      let matchedTask = '';
      
      // Try to find a specific task for this character
      const characterContext = findSentence(text, character);
      if (characterContext) {
        for (const task of tasks) {
          if (characterContext.toLowerCase().includes(task.toLowerCase())) {
            matchedTask = task;
            break;
          }
        }
      }
      
      // If no specific task found, use first task
      if (!matchedTask && tasks.length > 0) {
        matchedTask = tasks[0];
      }
      
      results.push({
        project: projects[0],
        character,
        task: matchedTask,
        context: characterContext || `Task for character ${character}`,
        confidence: 0.9
      });
    }
    
    logger.info(`Extracted ${results.length} character/task combinations`);
    return results;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error extracting information from text', { message: error.message });
    throw error;
  }
};

/**
 * Find a sentence containing a specific character mention
 * @param text - Full text to search
 * @param character - Character name to find
 * @returns The sentence containing the character, or null if not found
 */
function findSentence(text: string, character: string): string | null {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(character.toLowerCase())) {
      return sentence;
    }
  }
  
  return null;
}