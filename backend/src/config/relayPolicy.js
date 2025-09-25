// src/config/relayPolicy.js
import config from './appConfig.js';

export function effectivePerMsgCap({ tier, overridePerMsg, globalCap }) {
  const plan = config.tiers[tier] || config.tiers.basic;
  const perMsg = overridePerMsg ?? plan.perMessageMaxBytes;
  const cap = Math.min(globalCap ?? config.relayMaxBoxBytes, perMsg);
  return { plan, perMsg, cap };
}
