import dotenv from 'dotenv';

dotenv.config();

interface Config {
  alchemyApiKey: string;
  contractAddress: string;
  eventsFile: string;
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: Config = {
  alchemyApiKey: getEnvVar('ALCHEMY_API_KEY'),
  contractAddress: getEnvVar('CONTRACT_ADDRESS'),
  eventsFile: process.env.EVENTS_FILE || './events.jsonl',
};

export const ALCHEMY_WSS_URL = `wss://base-sepolia.g.alchemy.com/v2/${config.alchemyApiKey}`;
