// src/config/relayPolicy.js
import config from './appConfig.js';

export function effectivePerMsgCap({ tier, overridePerMsg, globalCap }) {
  const tierKey = tier === 'basic' ? 'free' : tier;
  const plan = config.tiers[tierKey] || config.tiers.free;
  const perMsg = overridePerMsg ?? plan.perMessageMaxBytes;
  const cap = Math.min(globalCap ?? config.relayMaxBoxBytes, perMsg);
  return { plan, perMsg, cap };
}
