// src/modules/natural-commands/controllers/naturalCommands.controller.js
// Controlador para manejar comandos naturales

import { NaturalCommandParser } from '../parser.js';
import { executeCommand } from '../handlers/index.js';
import logger from '#config/logger.js';

const parser = new NaturalCommandParser();

/**
 * Parsear y ejecutar comando natural
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function parseNaturalCommand(req, res) {
  try {
    const { message } = req.body;
    const userId = req.user?.wallet || req.user?.id;
    
    if (!message) {
      return res.status(400).json({
        error: 'MISSING_MESSAGE',
        message: 'Message is required'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User authentication required'
      });
    }
    
    // Parsear el comando
    const command = parser.parse(message);
    
    if (!command) {
      return res.status(200).json({
        success: false,
        message: 'No natural command detected',
        suggestions: getCommandSuggestions()
      });
    }
    
    // Validar el comando
    const validation = parser.validateCommand(command);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'INVALID_COMMAND',
        message: validation.error,
        command: command.action
      });
    }
    
    // Ejecutar el comando
    const result = await executeCommand(command, userId);
    
    logger.info('✅ [natural-commands] Command processed successfully', {
      userId,
      action: command.action,
      originalMessage: message
    });
    
    return res.status(200).json({
      success: true,
      command: {
        action: command.action,
        type: result.type,
        message: result.message
      },
      result: {
        blinkUrl: result.blinkUrl,
        actionUrl: result.action?.actionUrl,
        metadata: result.action
      }
    });
    
  } catch (error) {
    logger.error('❌ [natural-commands] Command processing failed', {
      error: error.message,
      userId: req.user?.wallet || req.user?.id,
      message: req.body?.message
    });
    
    return res.status(500).json({
      error: 'COMMAND_PROCESSING_FAILED',
      message: error.message
    });
  }
}

/**
 * Obtener acciones disponibles
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function getAvailableActions(req, res) {
  try {
    const actions = parser.getAvailableActions();
    
    const actionsWithExamples = actions.map(action => ({
      ...action,
      examples: parser.getActionExamples(action.name)
    }));
    
    return res.status(200).json({
      success: true,
      actions: actionsWithExamples
    });
    
  } catch (error) {
    logger.error('❌ [natural-commands] Failed to get available actions', {
      error: error.message
    });
    
    return res.status(500).json({
      error: 'FAILED_TO_GET_ACTIONS',
      message: error.message
    });
  }
}

/**
 * Registrar nueva acción dinámicamente
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function registerAction(req, res) {
  try {
    const { actionName, config } = req.body;
    const userId = req.user?.wallet || req.user?.id;
    
    if (!actionName || !config) {
      return res.status(400).json({
        error: 'MISSING_PARAMETERS',
        message: 'actionName and config are required'
      });
    }
    
    // Validar que el usuario tenga permisos (solo admin por ahora)
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin role required'
      });
    }
    
    // Registrar la nueva acción
    parser.registerAction(actionName, config);
    
    logger.info('✅ [natural-commands] New action registered', {
      userId,
      actionName,
      config: Object.keys(config)
    });
    
    return res.status(200).json({
      success: true,
      message: `Action '${actionName}' registered successfully`,
      action: {
        name: actionName,
        ...config
      }
    });
    
  } catch (error) {
    logger.error('❌ [natural-commands] Failed to register action', {
      error: error.message,
      userId: req.user?.wallet || req.user?.id,
      actionName: req.body?.actionName
    });
    
    return res.status(500).json({
      error: 'ACTION_REGISTRATION_FAILED',
      message: error.message
    });
  }
}

/**
 * Obtener sugerencias de comandos
 * @returns {Array} - Lista de sugerencias
 */
function getCommandSuggestions() {
  const actions = parser.getAvailableActions();
  const suggestions = [];
  
  actions.forEach(action => {
    const examples = parser.getActionExamples(action.name);
    suggestions.push(...examples.slice(0, 2)); // Máximo 2 ejemplos por acción
  });
  
  return suggestions;
}

/**
 * Validar comando sin ejecutarlo
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export async function validateCommand(req, res) {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'MISSING_MESSAGE',
        message: 'Message is required'
      });
    }
    
    // Parsear el comando
    const command = parser.parse(message);
    
    if (!command) {
      return res.status(200).json({
        valid: false,
        message: 'No natural command detected'
      });
    }
    
    // Validar el comando
    const validation = parser.validateCommand(command);
    
    return res.status(200).json({
      valid: validation.valid,
      command: validation.valid ? {
        action: command.action,
        params: command.params,
        handler: command.handler
      } : null,
      error: validation.valid ? null : validation.error
    });
    
  } catch (error) {
    logger.error('❌ [natural-commands] Command validation failed', {
      error: error.message,
      message: req.body?.message
    });
    
    return res.status(500).json({
      error: 'VALIDATION_FAILED',
      message: error.message
    });
  }
}






