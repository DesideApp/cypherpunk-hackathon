import logger from '#config/logger.js';
import { executeBlinkAction, BlinkExecutionError } from '#shared/services/dialectBlinkService.js';

export async function executeBlink(req, res) {
  const { actionUrl, account } = req.body || {};

  try {
    logger.info('▶️ [blink] request received', { actionUrl, account });
    const result = await executeBlinkAction({ actionUrl, account });
    logger.info('✅ [blink] execution success', {
      actionUrl,
      account,
      type: result?.type,
      multiCount: Array.isArray(result?.transactions) ? result.transactions.length : undefined,
    });
    return res.status(200).json({ data: result });
  } catch (error) {
    if (error instanceof BlinkExecutionError) {
      logger.warn('⚠️ [blink] execution error', {
        actionUrl,
        status: error.status,
        body: error.body,
      });
      return res.status(error.status).json({
        error: error.body?.error || 'BLINK_EXEC_FAILED',
        details: error.body,
        nextStep: 'FALLBACK',
      });
    }

    logger.error('❌ [blink] unexpected error', {
      actionUrl,
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({
      error: 'BLINK_EXEC_INTERNAL_ERROR',
      nextStep: 'RETRY',
    });
  }
}
