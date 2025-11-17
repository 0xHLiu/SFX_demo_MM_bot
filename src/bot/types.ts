export interface RFQEventData {
  requestId: string;
  customer: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  deadline: string;
}

export interface RFQEvent {
  type: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  data: RFQEventData;
}

export interface ProcessedState {
  processedRequestIds: string[];
  lastProcessedLine: number;
}
