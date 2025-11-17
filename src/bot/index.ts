import { botConfig } from './config';
import { loadState, markAsProcessed, isProcessed } from './state';
import { readAllEvents, watchEventsFile } from './watcher';
import { processRFQEvent } from './executor';
import { RFQEvent, ProcessedState } from './types';

let state: ProcessedState;

async function handleEvent(event: RFQEvent): Promise<void> {
  const { requestId } = event.data;

  if (isProcessed(state, requestId)) {
    console.log(`[BOT] Skipping already processed request: ${requestId}`);
    return;
  }

  console.log(`[BOT] Processing new RFQ request: ${requestId}`);
  console.log(`[BOT] Customer: ${event.data.customer}`);
  console.log(`[BOT] TokenIn: ${event.data.tokenIn}, TokenOut: ${event.data.tokenOut}`);
  console.log(`[BOT] AmountIn: ${event.data.amountIn}, Deadline: ${event.data.deadline}`);

  try {
    await processRFQEvent(event.data);
    markAsProcessed(state, requestId);
    console.log(`[BOT] Successfully processed request: ${requestId}`);
  } catch (error) {
    console.error(`[BOT] Failed to process request ${requestId}:`, error);
    // Don't mark as processed so we can retry later
  }
}

async function processExistingEvents(): Promise<void> {
  console.log('[BOT] Processing existing events...');
  const events = readAllEvents();
  console.log(`[BOT] Found ${events.length} existing RFQ_CREATED event(s)`);

  for (const event of events) {
    await handleEvent(event);
  }
}

async function main(): Promise<void> {
  console.log('Starting Market Maker Bot...');
  console.log(`Contract: ${botConfig.contractAddress}`);
  console.log(`Events file: ${botConfig.eventsFile}`);
  console.log(`State file: ${botConfig.stateFile}`);
  console.log(`RPC URL: ${botConfig.rpcUrl}`);

  // Load state
  state = loadState();
  console.log(`[BOT] Loaded state with ${state.processedRequestIds.length} processed request(s)`);

  // Process any existing events first
  await processExistingEvents();

  // Watch for new events
  watchEventsFile(handleEvent);

  console.log('[BOT] Bot is running and watching for new events...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
