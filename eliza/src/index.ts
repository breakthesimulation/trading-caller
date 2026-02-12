import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import { character } from './character.ts';

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing TradingCaller agent');
  logger.info({ name: character.name }, 'Character:');

  const tradingMode = runtime.getSetting('TRADING_MODE') || 'paper';
  logger.info({ tradingMode }, 'Trading mode:');

  const apiUrl =
    runtime.getSetting('TRADING_CALLER_API_URL') ||
    'https://trading-caller-production.up.railway.app';
  logger.info({ apiUrl }, 'Signal API:');
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  // plugins: [tradingCallerPlugin], <-- Will be wired in a later task
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';

export default project;
