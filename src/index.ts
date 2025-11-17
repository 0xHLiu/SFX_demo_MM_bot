import { ethers } from 'ethers';
import { writeFileSync } from 'fs';
import { config, ALCHEMY_WSS_URL } from './config';
import contractABI from './abi.json';

interface EventPayload {
  type: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  data: Record<string, unknown>;
}

function writeEvent(payload: EventPayload): void {
  const line = JSON.stringify(payload) + '\n';
  writeFileSync(config.eventsFile, line);
  console.log(`[WRITTEN] ${payload.type} @ block ${payload.blockNumber}`);
}

function createPayload(
  type: string,
  event: ethers.ContractEventPayload,
  data: Record<string, unknown>
): EventPayload {
  return {
    type,
    timestamp: Date.now(),
    blockNumber: event.log.blockNumber,
    transactionHash: event.log.transactionHash,
    logIndex: event.log.index,
    data,
  };
}

async function main(): Promise<void> {
  console.log('Starting Base Sepolia Event Listener...');
  console.log(`Contract: ${config.contractAddress}`);
  console.log(`Events file: ${config.eventsFile}`);

  const provider = new ethers.WebSocketProvider(ALCHEMY_WSS_URL);
  const contract = new ethers.Contract(config.contractAddress, contractABI, provider);

  // RFQ Created
  contract.on(
    'RFQCreated',
    (
      requestId: string,
      customer: string,
      tokenIn: string,
      tokenOut: string,
      amountIn: bigint,
      minAmountOut: bigint,
      deadline: bigint,
      event: ethers.ContractEventPayload
    ) => {
      console.log(`[EVENT] RFQCreated - Request: ${requestId}`);
      const payload = createPayload('RFQ_CREATED', event, {
        requestId,
        customer,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        deadline: deadline.toString(),
      });
      writeEvent(payload);
    }
  );

  // Quote Submitted (log only, don't write to file)
  contract.on(
    'QuoteSubmitted',
    (quoteId: string, requestId: string, marketMaker: string) => {
      console.log(`[EVENT] QuoteSubmitted - Quote: ${quoteId}, Request: ${requestId}, MM: ${marketMaker}`);
    }
  );

  // Quote Accepted (log only)
  contract.on('QuoteAccepted', (quoteId: string, requestId: string, marketMaker: string) => {
    console.log(`[EVENT] QuoteAccepted - Quote: ${quoteId}, Request: ${requestId}, MM: ${marketMaker}`);
  });

  // Quote Cancelled (log only)
  contract.on('QuoteCancelled', (quoteId: string, marketMaker: string) => {
    console.log(`[EVENT] QuoteCancelled - Quote: ${quoteId}, MM: ${marketMaker}`);
  });

  // Quote Updated (log only)
  contract.on('QuoteUpdated', (quoteId: string, oldAmountOut: bigint, newAmountOut: bigint) => {
    console.log(`[EVENT] QuoteUpdated - Quote: ${quoteId}, Old: ${oldAmountOut}, New: ${newAmountOut}`);
  });

  // RFQ Cancelled (log only)
  contract.on('RFQCancelled', (requestId: string, customer: string) => {
    console.log(`[EVENT] RFQCancelled - Request: ${requestId}, Customer: ${customer}`);
  });

  // Swap Executed (log only)
  contract.on(
    'SwapExecuted',
    (requestId: string, customer: string, marketMaker: string, tokenIn: string, tokenOut: string) => {
      console.log(`[EVENT] SwapExecuted - Request: ${requestId}, Customer: ${customer}, MM: ${marketMaker}`);
    }
  );

  // Handle provider errors
  provider.on('error', (error) => {
    console.error('[PROVIDER ERROR]', error);
  });

  console.log('Listening for events...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
