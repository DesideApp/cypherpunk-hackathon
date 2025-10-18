// frontend/src/utils/naturalCommandsParser.js
// Cliente para comandos naturales - usa API backend

import { apiRequest } from "@shared/services/apiService.js";

/**
 * Parsear comando natural usando API backend
 * @param {string} message - Mensaje del usuario
 * @returns {Promise<Object>} - Resultado del parsing
 */
export async function parseNaturalCommand(message) {
  try {
    const response = await apiRequest('/api/v1/natural-commands/parse', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    
    return response;
  } catch (error) {
    console.error('Error parsing natural command:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validar comando natural usando API backend
 * @param {string} message - Mensaje del usuario
 * @returns {Promise<Object>} - Resultado de la validación
 */
export async function validateNaturalCommand(message) {
  try {
    const response = await apiRequest('/api/v1/natural-commands/validate', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    
    return response;
  } catch (error) {
    console.error('Error validating natural command:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtener acciones disponibles
 * @returns {Promise<Object>} - Lista de acciones
 */
export async function getAvailableActions() {
  try {
    const response = await apiRequest('/api/v1/natural-commands/actions', {
      method: 'GET'
    });
    
    return response;
  } catch (error) {
    console.error('Error getting available actions:', error);
    return { success: false, error: error.message };
  }
}

