import axios from 'axios';
import config from '../config/env';
import logger from '../config/logger';
import { 
  ExtractedInfo, 
  ClickUpTeam, 
  ClickUpSpace, 
  ClickUpList, 
  ClickUpTask, 
  ChecklistItem,
  ApiError
} from '../types';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';
const API_KEY = config.clickup.apiKey;

/**
 * Get all teams from ClickUp
 * @returns Array of ClickUp teams
 */
export const getTeams = async (): Promise<ClickUpTeam[]> => {
  try {
    logger.info('Fetching ClickUp teams');
    
    const response = await axios.get(`${CLICKUP_API_URL}/team`, {
      headers: {
        'Authorization': API_KEY
      }
    });
    
    if (!response.data || !response.data.teams) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.teams;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error fetching ClickUp teams', { 
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to fetch ClickUp teams: ${error.message}`);
  }
};

/**
 * Get spaces for a team
 * @param teamId - The ClickUp team ID
 * @returns Array of spaces
 */
export const getSpaces = async (teamId: string): Promise<ClickUpSpace[]> => {
  try {
    logger.info(`Fetching spaces for team ${teamId}`);
    
    const response = await axios.get(`${CLICKUP_API_URL}/team/${teamId}/space`, {
      headers: {
        'Authorization': API_KEY
      }
    });
    
    if (!response.data || !response.data.spaces) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.spaces;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error fetching ClickUp spaces', { 
      teamId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to fetch spaces: ${error.message}`);
  }
};

/**
 * Get folders for a space
 * @param spaceId - The ClickUp space ID
 * @returns Array of folders
 */
export const getFolders = async (spaceId: string): Promise<any[]> => {
  try {
    logger.info(`Fetching folders for space ${spaceId}`);
    
    const response = await axios.get(`${CLICKUP_API_URL}/space/${spaceId}/folder`, {
      headers: {
        'Authorization': API_KEY
      }
    });
    
    if (!response.data || !response.data.folders) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.folders;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error fetching ClickUp folders', { 
      spaceId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }
};

/**
 * Get lists in a folder
 * @param folderId - The ClickUp folder ID
 * @returns Array of lists
 */
export const getListsInFolder = async (folderId: string): Promise<ClickUpList[]> => {
  try {
    logger.info(`Fetching lists in folder ${folderId}`);
    
    const response = await axios.get(`${CLICKUP_API_URL}/folder/${folderId}/list`, {
      headers: {
        'Authorization': API_KEY
      }
    });
    
    if (!response.data || !response.data.lists) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.lists;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error fetching lists in folder', { 
      folderId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to fetch lists in folder: ${error.message}`);
  }
};

/**
 * Get lists for a space
 * @param spaceId - The ClickUp space ID
 * @returns Array of lists
 */
export const getLists = async (spaceId: string): Promise<ClickUpList[]> => {
  try {
    logger.info(`Fetching lists for space ${spaceId}`);
    
    const response = await axios.get(`${CLICKUP_API_URL}/space/${spaceId}/list`, {
      headers: {
        'Authorization': API_KEY
      }
    });
    
    if (!response.data || !response.data.lists) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.lists;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error fetching ClickUp lists', { 
      spaceId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to fetch lists: ${error.message}`);
  }
};

/**
 * Get tasks in a list
 * @param listId - The ClickUp list ID
 * @returns Array of tasks
 */
export const getTasksInList = async (listId: string): Promise<ClickUpTask[]> => {
  try {
    logger.info(`Fetching tasks in list ${listId}`);
    
    const response = await axios.get(`${CLICKUP_API_URL}/list/${listId}/task`, {
      headers: {
        'Authorization': API_KEY
      }
    });
    
    if (!response.data || !response.data.tasks) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.tasks;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error fetching tasks in list', { 
      listId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to fetch tasks in list: ${error.message}`);
  }
};

/**
 * Create a new list in a space
 * @param spaceId - The ClickUp space ID
 * @param name - The name for the new list
 * @returns ID of the created list
 */
export const createList = async (spaceId: string, name: string): Promise<string> => {
  try {
    logger.info(`Creating new list "${name}" in space ${spaceId}`);
    
    const response = await axios.post(
      `${CLICKUP_API_URL}/space/${spaceId}/list`,
      { name },
      {
        headers: {
          'Authorization': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.id) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    logger.info(`Created new list: ${name} (${response.data.id})`);
    return response.data.id;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error creating ClickUp list', { 
      spaceId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to create list: ${error.message}`);
  }
};

/**
 * Get or create a list in a space
 * @param spaceId - The ClickUp space ID
 * @returns ID of an existing or newly created list
 */
export const getOrCreateList = async (spaceId: string): Promise<string> => {
  try {
    const lists = await getLists(spaceId);
    
    if (lists.length > 0) {
      // Use existing list
      const list = lists[0];
      logger.info(`Using existing list: ${list.name} (${list.id})`);
      return list.id;
    }
    
    // No lists found, create one
    logger.info(`No lists found in space ${spaceId}, creating new list`);
    return await createList(spaceId, "Characters");
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error getting or creating list', { message: error.message });
    throw error;
  }
};

/**
 * Search tasks by character name
 * @param listId - The ClickUp list ID
 * @param characterName - The character name to search for
 * @returns Array of matching tasks
 */
export const searchTasks = async (listId: string, characterName: string): Promise<ClickUpTask[]> => {
  try {
    logger.info(`Searching for tasks with character ${characterName} in list ${listId}`);
    
    const tasks = await getTasksInList(listId);
    const matchingTasks = tasks.filter(task => 
      task.name.toLowerCase().includes(characterName.toLowerCase())
    );
    
    return matchingTasks;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error searching ClickUp tasks', { 
      listId,
      characterName,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to search tasks: ${error.message}`);
  }
};

/**
 * Find task for a character by searching in all relevant places
 * @param spaceId - The ClickUp space ID
 * @param character - Character name to search for
 * @returns Task ID if found
 */
export const findTaskForCharacter = async (spaceId: string, character: string): Promise<string | null> => {
  try {
    logger.info(`Finding task for character ${character} in space ${spaceId}`);
    
    // First check folders (especially the "Prj" folder)
    const folders = await getFolders(spaceId);
    const prjFolder = folders.find(folder => folder.name === "Prj" || folder.name.toLowerCase().includes("prj"));
    
    if (prjFolder) {
      logger.info(`Found "Prj" folder: ${prjFolder.id}`);
      
      // Get lists in the Prj folder
      const listsInFolder = await getListsInFolder(prjFolder.id);
      
      if (listsInFolder.length > 0) {
        // Search for character in each list in the folder
        for (const list of listsInFolder) {
          logger.info(`Checking list ${list.name} (${list.id}) for character ${character}`);
          
          try {
            const tasks = await getTasksInList(list.id);
            const characterTask = tasks.find(task => 
              task.name.toLowerCase().includes(character.toLowerCase())
            );
            
            if (characterTask) {
              logger.info(`Found task for ${character} in list ${list.name}: ${characterTask.id}`);
              return characterTask.id;
            }
          } catch (listErr: unknown) {
            const listError = listErr as ApiError;
            logger.warn(`Error searching list ${list.id}`, { message: listError.message });
            // Continue to next list if one fails
          }
        }
      }
    }
    
    // If not found in folder structure, try direct lists in space
    try {
      const lists = await getLists(spaceId);
      
      for (const list of lists) {
        logger.info(`Checking space list ${list.name} (${list.id}) for character ${character}`);
        
        try {
          const tasks = await getTasksInList(list.id);
          const characterTask = tasks.find(task => 
            task.name.toLowerCase().includes(character.toLowerCase())
          );
          
          if (characterTask) {
            logger.info(`Found task for ${character} in list ${list.name}: ${characterTask.id}`);
            return characterTask.id;
          }
        } catch (listErr: unknown) {
          const listError = listErr as ApiError;
          logger.warn(`Error searching list ${list.id}`, { message: listError.message });
          // Continue to next list if one fails
        }
      }
    } catch (err: unknown) {
      const error = err as ApiError;
      logger.warn(`Error searching space lists`, { message: error.message });
    }
    
    logger.warn(`No task found for character ${character}`);
    return null;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error(`Error finding task for character ${character}`, { message: error.message });
    return null;
  }
};

/**
 * Add comment to task
 * @param taskId - The ClickUp task ID
 * @param commentText - The comment text
 */
export const addComment = async (taskId: string, commentText: string): Promise<void> => {
  try {
    logger.info(`Adding comment to task ${taskId}`);
    
    await axios.post(
      `${CLICKUP_API_URL}/task/${taskId}/comment`,
      { comment_text: commentText },
      {
        headers: {
          'Authorization': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('Comment added successfully');
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error adding comment to task', { 
      taskId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to add comment: ${error.message}`);
  }
};

/**
 * Create checklist on task
 * @param taskId - The ClickUp task ID
 * @param name - The checklist name
 * @param items - Array of checklist items
 */
export const createChecklist = async (taskId: string, name: string, items: ChecklistItem[]): Promise<void> => {
  try {
    logger.info(`Creating checklist on task ${taskId}`);
    
    await axios.post(
      `${CLICKUP_API_URL}/task/${taskId}/checklist`,
      { name, items },
      {
        headers: {
          'Authorization': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('Checklist created successfully');
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error creating checklist', { 
      taskId,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to create checklist: ${error.message}`);
  }
};

/**
 * Create a new task for a character
 * @param listId - The ClickUp list ID
 * @param character - Character name
 * @returns ID of the created task
 */
export const createTask = async (listId: string, character: string): Promise<string> => {
  try {
    logger.info(`Creating new task for character ${character} in list ${listId}`);
    
    const response = await axios.post(
      `${CLICKUP_API_URL}/list/${listId}/task`,
      { 
        name: `${character} character`,
        description: `Task for character ${character} created automatically`
      },
      {
        headers: {
          'Authorization': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.id) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    logger.info(`Created new task for ${character}: ${response.data.id}`);
    return response.data.id;
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error creating task', { 
      listId,
      character,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message 
    });
    throw new Error(`Failed to create task: ${error.message}`);
  }
};

/**
 * Generate checklist items based on task type
 * @param taskType - The type of task
 * @returns Array of checklist items
 */
export const generateChecklistItems = (taskType: string): ChecklistItem[] => {
  const taskTypeLower = taskType.toLowerCase();
  
  if (taskTypeLower === 'blocking') {
    return [
      { name: 'head', resolved: false },
      { name: 'body', resolved: false },
      { name: 'facial expressions', resolved: false }
    ];
  } else if (taskTypeLower === 'animation') {
    return [
      { name: 'walk cycle', resolved: false },
      { name: 'run cycle', resolved: false },
      { name: 'hind legs', resolved: false }
    ];
  } else if (taskTypeLower === 'rigging') {
    return [
      { name: 'skeleton', resolved: false },
      { name: 'controls', resolved: false },
      { name: 'weights', resolved: false }
    ];
  } else {
    return [
      { name: 'general', resolved: false },
      { name: 'review', resolved: false }
    ];
  }
};

/**
 * Update ClickUp task from extracted information
 * @param info - The extracted information
 */
export const updateClickUpTask = async (info: ExtractedInfo): Promise<void> => {
  try {
    logger.info(`Updating ClickUp for character ${info.character}`);
    
    // Get the first team
    const teams = await getTeams();
    if (teams.length === 0) {
      throw new Error('No teams found in ClickUp');
    }
    
    const teamId = teams[0].id;
    logger.info(`Using team: ${teams[0].name}`);
    
    // Get spaces
    const spaces = await getSpaces(teamId);
    if (spaces.length === 0) {
      throw new Error('No spaces found in ClickUp');
    }
    
    // Find a relevant space or use the first one
    let spaceId = spaces[0].id;
    for (const space of spaces) {
      if (space.name.toLowerCase().includes('character') || 
          space.name.toLowerCase().includes('personaje')) {
        spaceId = space.id;
        logger.info(`Found relevant space: ${space.name}`);
        break;
      }
    }
    
    // Find task for the character
    let taskId = await findTaskForCharacter(spaceId, info.character);
    
    // If not found, try to create a new task
    if (!taskId) {
      logger.info(`No existing task found for ${info.character}, creating new task`);
      try {
        const listId = await getOrCreateList(spaceId);
        taskId = await createTask(listId, info.character);
      } catch (err: unknown) {
        const error = err as ApiError;
        logger.error(`Failed to create task for ${info.character}`, { message: error.message });
        throw new Error(`Could not find or create task for ${info.character}`);
      }
    }
    
    // Add comment to task
    const commentText = `Update from Zoom meeting: ${info.task} required for character ${info.character}. ${info.context ? `Context: ${info.context}` : ''}`;
    await addComment(taskId, commentText);
    
    // Create checklist
    const checklistName = `${info.task} for ${info.character}`;
    const checklistItems = generateChecklistItems(info.task);
    await createChecklist(taskId, checklistName, checklistItems);
    
    logger.info(`ClickUp task ${taskId} updated successfully`);
  } catch (err: unknown) {
    const error = err as ApiError;
    logger.error('Error updating ClickUp task', { message: error.message });
    throw new Error(`Failed to update ClickUp: ${error.message}`);
  }
};