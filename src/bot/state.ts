import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ProcessedState } from './types';
import { botConfig } from './config';

const DEFAULT_STATE: ProcessedState = {
  processedRequestIds: [],
  lastProcessedLine: 0,
};

export function loadState(): ProcessedState {
  if (!existsSync(botConfig.stateFile)) {
    return { ...DEFAULT_STATE };
  }

  try {
    const data = readFileSync(botConfig.stateFile, 'utf-8');
    return JSON.parse(data) as ProcessedState;
  } catch (error) {
    console.error('[STATE] Error loading state file, using default:', error);
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: ProcessedState): void {
  try {
    writeFileSync(botConfig.stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[STATE] Error saving state:', error);
  }
}

export function markAsProcessed(state: ProcessedState, requestId: string): void {
  if (!state.processedRequestIds.includes(requestId)) {
    state.processedRequestIds.push(requestId);
    saveState(state);
  }
}

export function isProcessed(state: ProcessedState, requestId: string): boolean {
  return state.processedRequestIds.includes(requestId);
}
