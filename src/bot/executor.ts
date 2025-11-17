import { execSync } from 'child_process';
import { botConfig } from './config';
import { RFQEventData } from './types';

function runCastCommand(args: string[], retryCount: number = 0): string {
  // Add gas price bump if retrying to handle "replacement transaction underpriced"
  let finalArgs = [...args];
  if (retryCount > 0) {
    const gasPriceMultiplier = 1 + (retryCount * 0.2); // 20% bump per retry
    const gasPrice = Math.floor(20000000000 * gasPriceMultiplier); // 20 gwei base
    finalArgs.push('--gas-price', gasPrice.toString());
  }

  const command = `cast ${finalArgs.join(' ')}`;
  console.log(`[EXECUTOR] Running: ${command}`);

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout: 60000, // 60 second timeout
      env: { ...process.env, PATH: `${process.env.PATH}:/Users/howell/.foundry/bin` }
    });
    return output.trim();
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    const errorMessage = err.stderr || err.message || '';

    // Check for nonce-related errors and retry
    if ((errorMessage.includes('nonce too low') || errorMessage.includes('replacement transaction underpriced')) && retryCount < 3) {
      console.warn(`[EXECUTOR] Transaction conflict detected, retrying with higher gas (attempt ${retryCount + 1}/3)...`);
      // Wait a bit for pending transactions to be mined
      execSync('sleep 2');
      return runCastCommand(args, retryCount + 1);
    }

    console.error('[EXECUTOR] Command failed:', errorMessage);
    throw error;
  }
}

export async function approveToken(tokenAddress: string, amount: string): Promise<string> {
  console.log(`[EXECUTOR] Approving ${amount} of token ${tokenAddress} for contract ${botConfig.contractAddress}`);

  const args = [
    'send',
    tokenAddress,
    '"approve(address,uint256)"',
    botConfig.contractAddress,
    amount,
    '--private-key',
    botConfig.privateKey,
    '--rpc-url',
    botConfig.rpcUrl,
  ];

  const txHash = runCastCommand(args);
  console.log(`[EXECUTOR] Approval tx: ${txHash}`);
  return txHash;
}

export async function submitQuote(eventData: RFQEventData): Promise<string> {
  const { requestId, amountIn, deadline } = eventData;

  console.log(`[EXECUTOR] Submitting quote for request ${requestId}`);
  console.log(`[EXECUTOR] amountOut: ${amountIn}, quoteExpiry: ${deadline}`);

  const args = [
    'send',
    botConfig.contractAddress,
    '"submitQuote(bytes32,uint256,uint256)"',
    requestId,
    amountIn,
    deadline,
    '--private-key',
    botConfig.privateKey,
    '--rpc-url',
    botConfig.rpcUrl,
  ];

  const txHash = runCastCommand(args);
  console.log(`[EXECUTOR] Quote submitted tx: ${txHash}`);
  return txHash;
}

export async function processRFQEvent(eventData: RFQEventData): Promise<void> {
  // Step 1: Approve tokenOut for the amount we'll send
  await approveToken(eventData.tokenOut, eventData.amountIn);

  // Step 2: Submit the quote
  await submitQuote(eventData);
}
