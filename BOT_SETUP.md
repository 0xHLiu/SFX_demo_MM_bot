# Market Maker Bot - Setup & Usage

## Prerequisites

1. **Foundry installed** - The bot uses `cast` commands
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Node.js dependencies** installed
   ```bash
   npm install
   ```

3. **Bot wallet** with:
   - ETH on Base Sepolia for gas fees
   - Sufficient balance of tokens you'll be quoting (tokenOut)

## Environment Setup

Add the following to your `.env` file:

```env
# Required - Bot wallet private key (without 0x prefix is fine)
PRIVATE_KEY=your_private_key_here

# Already configured
ALCHEMY_API_KEY=your_alchemy_key
CONTRACT_ADDRESS=your_contract_address
EVENTS_FILE=./events.jsonl
```

## Running the Bot

### Start the unified bot (single process)
```bash
npm run start
```

This runs the unified bot that both listens for events and processes them automatically.

## How It Works

1. **On startup**, the bot:
   - Connects to Base Sepolia via Alchemy WebSocket
   - Loads previously processed request IDs from `processed_requests.json`
   - Begins listening for blockchain events in real-time

2. **For each RFQ_CREATED event**, the bot immediately:
   - Checks if already processed (skips if yes)
   - Approves `tokenOut` for `amountIn` to the contract
   - Calls `submitQuote(requestId, amountIn, deadline)`
   - Marks the request as processed

3. **Real-time processing** - no file polling, events are processed as they arrive

## Files Created by Bot

- `processed_requests.json` - Tracks which request IDs have been processed (auto-created)

## Monitoring

The bot logs all activity to console:
- `[BOT]` - Main bot logic
- `[EXECUTOR]` - Foundry command execution
- `[WATCHER]` - File watching activity
- `[STATE]` - State persistence

## Stopping the Bot

Press `Ctrl+C` to stop. The bot will resume from where it left off on next start (thanks to state persistence).

## Troubleshooting

**"Missing required environment variable"**
- Ensure all required env vars are set in `.env`

**Cast command fails**
- Check Foundry is installed: `cast --version`
- Verify RPC URL is accessible
- Ensure wallet has sufficient ETH for gas
- Ensure wallet has sufficient token balance

**Duplicate submissions**
- Delete `processed_requests.json` to reset state (use with caution)

**Nonce too low error**
- This happens when running manual `cast send` commands while the bot is also sending transactions
- The bot now automatically retries up to 3 times on nonce conflicts
- If running manual commands, check current nonce first:
  ```bash
  # Get current nonce for your address
  cast nonce <YOUR_BOT_ADDRESS> --rpc-url $RPC_URL
  ```
- Let `cast` auto-manage nonces by NOT specifying `--nonce`:
  ```bash
  # Good - auto-manages nonce
  cast send $CONTRACT_ADDRESS "approveRequest(uint256)" 0 \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY

  # Bad - may conflict with bot transactions
  cast send ... --nonce 108
  ```
- Stop the bot before running manual transactions to avoid conflicts

**WebSocket connection closed**
- The bot will exit on disconnect - restart with `npm run start`
- Check your internet connection
- Verify Alchemy API key is valid
