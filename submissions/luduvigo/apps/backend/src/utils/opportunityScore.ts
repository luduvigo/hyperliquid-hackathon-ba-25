/**
 * Opportunity Score Calculator
 * 
 * Implements a formula that balances:
 * 1. Stability-Adjusted APY (using average and standard deviation)
 * 2. TVL Confidence Factor (using sigmoid function)
 * 
 * Formula:
 * Opportunity_Score = Stability_Adjusted_APY * TVL_Confidence_Factor
 * 
 * Where:
 * - Stability_Adjusted_APY = APY_avg_24h - (Risk_Penalty_Factor * APY_std_24h)
 * - TVL_Confidence_Factor = 1 / (1 + e^(-k * (TVL_current / My_Asset_Size - m)))
 */

export interface OpportunityScoreParams {
  apyAvg24h: number;
  apyStd24h: number;
  tvlCurrent: number;
  myAssetSize: number;
  riskPenaltyFactor?: number; // Default: 1
  tvlK?: number; // Sigmoid steepness, default: 20
  tvlM?: number; // Sigmoid midpoint, default: 0.1
}

export interface OpportunityScoreResult {
  opportunityScore: number;
  stabilityAdjustedApy: number;
  tvlConfidenceFactor: number;
  apyAvg24h: number;
  apyStd24h: number;
  tvlCurrent: number;
  myAssetSize: number;
}

/**
 * Calculate standard deviation from an array of numbers
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate TVL Confidence Factor using sigmoid function
 * 
 * @param tvlCurrent - Current TVL of the pool
 * @param myAssetSize - Size of assets to deploy
 * @param k - Sigmoid steepness (default: 20)
 * @param m - Sigmoid midpoint ratio (default: 0.1, meaning 10% of pool)
 * @returns Confidence factor between 0 and 1
 */
export function calculateTvlConfidenceFactor(
  tvlCurrent: number,
  myAssetSize: number,
  k: number = 20,
  m: number = 0.1
): number {
  if (tvlCurrent <= 0 || myAssetSize <= 0) return 0;

  // Calculate ratio: TVL / My_Asset_Size
  const ratio = tvlCurrent / myAssetSize;

  // Sigmoid function: 1 / (1 + e^(-k * (ratio - m)))
  // When ratio is large (pool is much bigger than our assets), confidence approaches 1
  // When ratio is small (pool is similar size to our assets), confidence approaches 0
  const exponent = -k * (ratio - m);
  const confidence = 1 / (1 + Math.exp(exponent));

  return confidence;
}

/**
 * Calculate Stability-Adjusted APY
 * 
 * @param apyAvg24h - Average APY over 24 hours
 * @param apyStd24h - Standard deviation of APY over 24 hours
 * @param riskPenaltyFactor - Risk penalty multiplier (default: 1)
 * @returns Stability-adjusted APY (can be negative)
 */
export function calculateStabilityAdjustedApy(
  apyAvg24h: number,
  apyStd24h: number,
  riskPenaltyFactor: number = 1
): number {
  return apyAvg24h - riskPenaltyFactor * apyStd24h;
}

/**
 * Calculate Opportunity Score for a pool
 * 
 * @param params - Opportunity score calculation parameters
 * @returns Opportunity score result
 */
export function calculateOpportunityScore(
  params: OpportunityScoreParams
): OpportunityScoreResult {
  const {
    apyAvg24h,
    apyStd24h,
    tvlCurrent,
    myAssetSize,
    riskPenaltyFactor = 1,
    tvlK = 20,
    tvlM = 0.1,
  } = params;

  // Calculate stability-adjusted APY
  const stabilityAdjustedApy = calculateStabilityAdjustedApy(
    apyAvg24h,
    apyStd24h,
    riskPenaltyFactor
  );

  // Calculate TVL confidence factor
  const tvlConfidenceFactor = calculateTvlConfidenceFactor(
    tvlCurrent,
    myAssetSize,
    tvlK,
    tvlM
  );

  // Calculate opportunity score
  // If stability-adjusted APY is negative, set score to 0
  let opportunityScore = stabilityAdjustedApy * tvlConfidenceFactor;
  if (opportunityScore < 0) {
    opportunityScore = 0;
  }

  return {
    opportunityScore,
    stabilityAdjustedApy,
    tvlConfidenceFactor,
    apyAvg24h,
    apyStd24h,
    tvlCurrent,
    myAssetSize,
  };
}

