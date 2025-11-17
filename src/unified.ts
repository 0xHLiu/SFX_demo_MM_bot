import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { loadState, markAsProcessed, isProcessed } from './bot/state';
import { processRFQEvent } from './bot/executor';
import { ProcessedState, RFQEventData } from './bot/types';
import RFQSystemArtifact from './lib/contracts/abis/RFQSystem.json';

dotenv.config();

const contractABI = RFQSystemArtifact.abi;

// Configuration
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const alchemyApiKey = getEnvVar('ALCHEMY_API_KEY');
const contractAddress = getEnvVar('CONTRACT_ADDRESS');
const ALCHEMY_WSS_URL = `wss://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;

// State
let state: ProcessedState;
let processingQueue: Promise<void> = Promise.resolve();

async function handleRFQCreated(eventData: RFQEventData): Promise<void> {
  const { requestId } = eventData;

  if (isProcessed(state, requestId)) {
    console.log(`[BOT] Skipping already processed request: ${requestId}`);
    return;
  }

  console.log(`[BOT] Processing new RFQ request: ${requestId}`);
  console.log(`[BOT] Customer: ${eventData.customer}`);
  console.log(`[BOT] TokenIn: ${eventData.tokenIn}, TokenOut: ${eventData.tokenOut}`);
  console.log(`[BOT] AmountIn: ${eventData.amountIn}, Deadline: ${eventData.deadline}`);

  try {
    await processRFQEvent(eventData);
    markAsProcessed(state, requestId);
    console.log(`[BOT] Successfully processed request: ${requestId}`);
  } catch (error) {
    console.error(`[BOT] Failed to process request ${requestId}:`, error);
    // Don't mark as processed so we can retry on restart
  }
}

async function main(): Promise<void> {
  console.log('Starting Unified Market Maker Bot...');
  console.log(`Contract: ${contractAddress}`);
  console.log(`WebSocket: ${ALCHEMY_WSS_URL}`);

  // Load state for idempotency
  state = loadState();
  console.log(`[BOT] Loaded state with ${state.processedRequestIds.length} processed request(s)`);

  // Connect to blockchain
  const provider = new ethers.WebSocketProvider(ALCHEMY_WSS_URL);
  const contract = new ethers.Contract(contractAddress, contractABI, provider);

  // RFQ Created - process immediately
  contract.on(
    'RFQCreated',
    (
      requestId: string,
      customer: string,
      tokenIn: string,
      tokenOut: string,
      amountIn: bigint,
      minAmountOut: bigint,
      deadline: bigint
    ) => {
      console.log(`[EVENT] RFQCreated - Request: ${requestId}`);

      const eventData: RFQEventData = {
        requestId,
        customer,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        deadline: deadline.toString(),
      };

      // Queue processing to avoid nonce conflicts
      processingQueue = processingQueue.then(() => handleRFQCreated(eventData));
    }
  );

  // Quote Submitted
  contract.on(
    'QuoteSubmitted',
    (quoteId: string, requestId: string, marketMaker: string) => {
      console.log(`[EVENT] QuoteSubmitted - Quote: ${quoteId}, Request: ${requestId}, MM: ${marketMaker}`);
    }
  );

  // Quote Accepted
  contract.on('QuoteAccepted', (quoteId: string, requestId: string, marketMaker: string) => {
    console.log(`[EVENT] QuoteAccepted - Quote: ${quoteId}, Request: ${requestId}, MM: ${marketMaker}`);
  });

  // Quote Cancelled
  contract.on('QuoteCancelled', (quoteId: string, marketMaker: string) => {
    console.log(`[EVENT] QuoteCancelled - Quote: ${quoteId}, MM: ${marketMaker}`);
  });

  // Quote Updated
  contract.on('QuoteUpdated', (quoteId: string, oldAmountOut: bigint, newAmountOut: bigint) => {
    console.log(`[EVENT] QuoteUpdated - Quote: ${quoteId}, Old: ${oldAmountOut}, New: ${newAmountOut}`);
  });

  // RFQ Cancelled
  contract.on('RFQCancelled', (requestId: string, customer: string) => {
    console.log(`[EVENT] RFQCancelled - Request: ${requestId}, Customer: ${customer}`);
  });

  // Swap Executed
  contract.on(
    'SwapExecuted',
    (requestId: string, customer: string, marketMaker: string, tokenIn: string, tokenOut: string) => {
      console.log(`[EVENT] SwapExecuted - Request: ${requestId}, Customer: ${customer}, MM: ${marketMaker}`);
    }
  );

  // Handle provider errors and reconnection
  provider.on('error', (error) => {
    console.error('[PROVIDER ERROR]', error);
  });

  // Handle WebSocket disconnect
  (provider.websocket as any).on('close', () => {
    console.error('[WEBSOCKET] Connection closed. Exiting...');
    process.exit(1);
  });

  console.log('[BOT] Listening for events and processing automatically...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
