/**
 * Router and swap-related types
 */

export interface SwapRoute {
  from_token: string;
  to_token: string;
  amount_in: string;
  amount_out: string;
  price_impact: number;
  path: string[];
  gas_estimate: string;
}

export interface SwapRequest {
  from_token: string;
  to_token: string;
  amount: string;
  slippage: number;
  recipient?: string;
}

export interface SwapResponse {
  route: SwapRoute;
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
  };
}
