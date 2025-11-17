import dotenv from 'dotenv';

dotenv.config();

interface BotConfig {
  privateKey: string;
  rpcUrl: string;
  contractAddress: string;
  eventsFile: string;
  stateFile: string;
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const alchemyApiKey = getEnvVar('ALCHEMY_API_KEY');

export const botConfig: BotConfig = {
  privateKey: getEnvVar('PRIVATE_KEY'),
  rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
  contractAddress: getEnvVar('CONTRACT_ADDRESS'),
  eventsFile: process.env.EVENTS_FILE || './events.jsonl',
  stateFile: process.env.STATE_FILE || './processed_requests.json',
};
