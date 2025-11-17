# Base Sepolia Event Listener - HTTP Webhook Gateway

## Overview

A lightweight Node.js service that listens to blockchain events on Base Sepolia and delivers them to an external trading system via HTTP webhooks.

---

## Architecture

```
┌─────────────────────┐
│   Base Sepolia      │
│   (via Alchemy)     │
└──────────┬──────────┘
           │ WebSocket
           ▼
┌─────────────────────┐
│  Event Gateway      │
│  (This Service)     │
│   - Listen          │
│   - Decode          │
│   - POST to webhook │
└──────────┬──────────┘
           │ HTTP POST
           ▼
┌─────────────────────┐
│  External Trading   │
│  Application        │
└─────────────────────┘
```

---

## Core Implementation

```typescript
import { ethers } from 'ethers';

const ALCHEMY_WSS_URL = `wss://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const provider = new ethers.WebSocketProvider(ALCHEMY_WSS_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Listen and forward events
contract.on('RFQCreated', async (id, maker, taker, amount, event) => {
  const payload = {
    type: 'RFQ_CREATED',
    timestamp: Date.now(),
    blockNumber: event.log.blockNumber,
    transactionHash: event.log.transactionHash,
    logIndex: event.log.index,
    data: {
      id,
      maker,
      taker,
      amount: amount.toString()
    }
  };

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log(`Event delivered: ${payload.type} @ block ${payload.blockNumber}`);
});

// Handle errors
provider.on('error', (error) => {
  console.error('Provider error:', error);
});

console.log('Listening for events...');
```

---

## Event Schema

The webhook payload sent to your trading system:

```typescript
interface WebhookPayload {
  type: string;              // Event identifier (e.g., 'RFQ_CREATED')
  timestamp: number;         // Unix ms when event was received
  blockNumber: number;       // Block containing the event
  transactionHash: string;   // Transaction hash
  logIndex: number;          // Event position in block
  data: Record<string, any>; // Event-specific data (contract arguments)
}
```

**Example payload:**
```json
{
  "type": "RFQ_CREATED",
  "timestamp": 1700000000000,
  "blockNumber": 12345678,
  "transactionHash": "0xabc123...",
  "logIndex": 0,
  "data": {
    "id": "0x...",
    "maker": "0x...",
    "taker": "0x...",
    "amount": "1000000000000000000"
  }
}
```

---

## Configuration

```typescript
interface Config {
  // Required
  alchemyApiKey: string;     // Alchemy API key
  webhookUrl: string;        // Trading system endpoint
  contractAddress: string;   // Contract to monitor
  contractAbi: any[];        // Contract ABI

  // Optional
  retryAttempts?: number;    // Retry failed webhooks (default: 3)
  retryDelay?: number;       // Delay between retries in ms (default: 1000)
}
```

**Environment variables:**
```bash
ALCHEMY_API_KEY=your_key_here
WEBHOOK_URL=http://localhost:8080/events
CONTRACT_ADDRESS=0x...
```

---

## Project Structure (Minimal)

```
src/
├── index.ts          # Main entry point
├── config.ts         # Load environment variables
└── abi.json          # Contract ABI
```

That's it. Expand only when needed.

---

## Error Handling

### 1. Webhook Delivery Failures
```typescript
async function deliverEvent(payload: WebhookPayload, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) return;

      console.error(`Webhook failed (${response.status}), attempt ${attempt}/${retries}`);
    } catch (error) {
      console.error(`Webhook error, attempt ${attempt}/${retries}:`, error);
    }

    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  console.error('Event delivery failed after all retries:', payload);
  // Optionally: write to dead letter queue or file for recovery
}
```

### 2. WebSocket Reconnection
```typescript
provider.on('error', async (error) => {
  console.error('WebSocket error:', error);
  // ethers.js WebSocketProvider handles reconnection automatically
  // but you may want to add alerting here
});
```

---

## What This Service Does

- Connects to Base Sepolia via Alchemy WebSocket
- Subscribes to specific contract events
- Decodes events using the contract ABI
- Formats events into consistent JSON schema
- POSTs events to your trading system's webhook endpoint
- Retries on delivery failure
- Logs all activity

---

## What This Service Does NOT Do

- Execute trades
- Make trading decisions
- Store events persistently
- Manage positions
- Handle complex event ordering (trading system's responsibility)

---

## Trading System Requirements

Your external trading application needs:

1. **HTTP endpoint** that accepts POST requests (e.g., `POST /events`)
2. **JSON parsing** for the webhook payload
3. **Idempotency handling** - may receive duplicate events
4. **Response** - return 2xx status code to acknowledge receipt

**Example (Express.js):**
```typescript
app.post('/events', (req, res) => {
  const event = req.body;
  console.log('Received:', event.type, event.data);
  // Process event...
  res.sendStatus(200);
});
```

---

## Next Steps

1. **Initialize project**: `npm init -y && npm install ethers typescript ts-node`
2. **Add ABI**: Get your contract's ABI JSON
3. **Configure**: Set environment variables
4. **Run**: `npx ts-node src/index.ts`
5. **Test**: Trigger an event on Base Sepolia and verify webhook receipt

---

## Base Sepolia Network Details

- **Chain ID**: 84532
- **WebSocket**: `wss://base-sepolia.g.alchemy.com/v2/{API_KEY}`
- **Block Explorer**: https://sepolia.basescan.org
- **Block Time**: ~2 seconds
