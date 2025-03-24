import axios from 'axios';
import config from '../config/env';
import logger from '../config/logger';
import { 
  ExtractedInfo, 
  ClickUpTeam, 
  ClickUpSpace, 
  ClickUpList, 
  ClickUpTask, 
  ChecklistItem 
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
 * Search tasks by character name
 * @param listId - The ClickUp list ID
 * @param characterName - The character name to search for
 * @returns Array of matching tasks
 */
export const searchTasks = async (listId: string, characterName: string): Promise<ClickUpTask[]> => {
  try {
    logger.info(`Searching for tasks with character ${characterName} in list ${listId}`);
    
    const response = await axios.get(`${CLICKUP_API_URL}/list/${listId}/task`, {
      headers: {
        'Authorization': API_KEY
      },
      params: {
        name: characterName
      }
    });
    
    if (!response.data || !response.data.tasks) {
      throw new Error('Invalid response format from ClickUp API');
    }
    
    return response.data.tasks;
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
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
    
    // Get lists
    const lists = await getLists(spaceId);
    if (lists.length === 0) {
      throw new Error('No lists found in ClickUp');
    }
    
    // Find a relevant list or use the first one
    let listId = lists[0].id;
    for (const list of lists) {
      if (list.name.toLowerCase().includes('character') || 
          list.name.toLowerCase().includes('personaje')) {
        listId = list.id;
        logger.info(`Found relevant list: ${list.name}`);
        break;
      }
    }
    
    // Search for tasks by character name
    const tasks = await searchTasks(listId, info.character);
    if (tasks.length === 0) {
      logger.warn(`No tasks found for character ${info.character}`);
      return;
    }
    
    // Use the first matching task
    const taskId = tasks[0].id;
    logger.info(`Found task: ${tasks[0].name}`);
    
    // Add comment to task
    const commentText = `Update from Zoom meeting: ${info.task} required for character ${info.character}. ${info.context ? `Context: ${info.context}` : ''}`;
    await addComment(taskId, commentText);
    
    // Create checklist
    const checklistName = `${info.task} for ${info.character}`;
    const checklistItems = generateChecklistItems(info.task);
    await createChecklist(taskId, checklistName, checklistItems);
    
    logger.info(`ClickUp task ${taskId} updated successfully`);
  } catch (error) {
    logger.error('Error updating ClickUp task', { error });
    throw new Error(`Failed to update ClickUp: ${error.message}`);
  }
};