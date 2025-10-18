import Stats from '../models/stats.model.js';

/**
 * Registra eventos y contadores de actividad para un usuario.
 * Mantiene compatibilidad con el backend original para facilitar futuras migraciones.
 */
export async function logEvent(userId, eventType, data = {}, country = null) {
  if (!userId || !eventType) return;

  try {
    const update = {
      $push: {
        events: {
          type: eventType,
          data,
          timestamp: new Date()
        }
      },
      $set: {
        lastActive: new Date()
      }
    };

    update.$inc = buildIncrements(eventType, data);

    if (country) {
      update.$push.connectionHistory = {
        timestamp: new Date(),
        platform: data.platform || 'web',
        country
      };
    }

    await Stats.findOneAndUpdate(
      { user: userId },
      update,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error(`❌ [stats] Error logging event ${eventType} for ${userId}:`, error.message);
  }
}

function buildIncrements(eventType, data) {
  const inc = {};

  switch (eventType) {
    case 'message_sent':
      inc.messagesSent = 1;
      break;
    case 'message_received':
      inc.messagesReceived = 1;
      break;
    case 'web3_connection':
      inc.web3Connections = 1;
      break;
    case 'backup_created':
      inc.backupsCreated = 1;
      inc.storageUsed = data.size || 0;
      break;
    // Hackathon-specific events (placeholders for future aggregations)
    case 'token_added':
      inc.tokensAdded = 1;
      break;
    case 'blink_metadata_hit':
      inc.blinkMetadataHits = 1;
      break;
    case 'blink_execute':
      inc.blinkExecutes = 1;
      inc.blinkVolume = (data.volume || 0);
      break;
    case 'natural_command_parsed':
      inc.naturalCommandsParsed = 1;
      break;
    case 'natural_command_executed':
      inc.naturalCommandsExecuted = 1;
      break;
    case 'natural_command_rejected':
      inc.naturalCommandsRejected = 1;
      break;
    case 'natural_command_failed':
      inc.naturalCommandsFailed = 1;
      break;
    case 'dm_started':
      inc.dmStarted = 1;
      break;
    case 'dm_accepted':
      inc.dmAccepted = 1;
      break;
    case 'relay_message':
      inc.relayMessages = 1;
      break;
    default:
      break;
  }

  return Object.keys(inc).length ? inc : undefined;
}

export default logEvent;
