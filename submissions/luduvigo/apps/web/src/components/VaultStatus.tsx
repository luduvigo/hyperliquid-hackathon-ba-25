import React from "react";

interface VaultStatusProps {
  yieldData: any;
}

export default function VaultStatus({ yieldData }: VaultStatusProps) {
  if (!yieldData) {
    return (
      <div className="vault-status">
        <h2>Loading yield data...</h2>
      </div>
    );
  }

  // Group pools by input_token
  const groupedByToken = React.useMemo(() => {
    if (!yieldData.pools || yieldData.pools.length === 0) return {};

    const groups: { [key: string]: any[] } = {};

    yieldData.pools.forEach((pool: any) => {
      const token = pool.input_token || "unknown";
      if (!groups[token]) {
        groups[token] = [];
      }
      groups[token].push(pool);
    });

    // Sort pools within each group by APY (highest first)
    Object.keys(groups).forEach((token) => {
      groups[token].sort((a, b) => b.apy - a.apy);
    });

    return groups;
  }, [yieldData.pools]);

  return (
    <div className="vault-status">
      <h2>Best Yields by Token</h2>

      {/* Display grouped yield cards */}
      {Object.keys(groupedByToken).length > 0 && (
        <div className="yields-grid">
          {Object.entries(groupedByToken).map(
            ([token, pools]: [string, any[]]) => {
              const bestPool = pools[0]; // Highest APY pool for this token
              const alternativePools = pools.slice(1);

              return (
                <div key={token} className="yield-card token-group">
                  <div className="token-header">
                    <h3 className="token-name">
                      {bestPool.description || "Unknown Token"}
                    </h3>
                    <div className="best-apy-badge">
                      <span className="apy-label">Best APY</span>
                      <span className="apy-value">
                        {bestPool.apy ? `${bestPool.apy.toFixed(2)}%` : "N/A"}
                      </span>
                    </div>
                  </div>

                  <p className="token-address-main">Token: {token}</p>
                  <p className="chain">Chain: {bestPool.chain || "N/A"}</p>

                  {/* Deposit button for the specific token */}
                  {token.toLowerCase() ===
                    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb" && (
                    <a href="/vault" className="deposit-vault-button">
                      Deposit in Vault
                    </a>
                  )}

                  {/* Best Pool Option */}
                  <div className="pool-option best">
                    <div className="pool-option-header">
                      <span className="pool-badge">Recommended</span>
                      {bestPool.url && (
                        <a
                          href={bestPool.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pool-link-inline"
                        >
                          View Pool →
                        </a>
                      )}
                    </div>
                    <div className="apy-breakdown">
                      {bestPool.historic_apy !== undefined && (
                        <span className="apy-detail">
                          Historic: {bestPool.historic_apy.toFixed(2)}%
                        </span>
                      )}
                      {bestPool.rewards_apy !== undefined &&
                        bestPool.rewards_apy > 0 && (
                          <span className="apy-detail">
                            Rewards: {bestPool.rewards_apy.toFixed(2)}%
                          </span>
                        )}
                    </div>
                    <p className="pool-address-small">
                      Pool: {bestPool.pool_address}
                    </p>
                  </div>

                  {/* Alternative Pool Options */}
                  {alternativePools.length > 0 && (
                    <div className="alternative-pools">
                      <h4>Alternative Options:</h4>
                      {alternativePools.map((pool: any, idx: number) => (
                        <div key={idx} className="pool-option">
                          <div className="pool-option-header">
                            <span className="pool-name">
                              {pool.description || "Pool"}
                            </span>
                            {pool.url && (
                              <a
                                href={pool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pool-link-inline"
                              >
                                View →
                              </a>
                            )}
                          </div>
                          <div className="pool-apy-line">
                            <span className="apy-total">
                              {pool.apy ? `${pool.apy.toFixed(2)}%` : "N/A"}
                            </span>
                            <div className="apy-breakdown">
                              {pool.historic_apy !== undefined && (
                                <span className="apy-detail">
                                  Historic: {pool.historic_apy.toFixed(2)}%
                                </span>
                              )}
                              {pool.rewards_apy !== undefined &&
                                pool.rewards_apy > 0 && (
                                  <span className="apy-detail">
                                    Rewards: {pool.rewards_apy.toFixed(2)}%
                                  </span>
                                )}
                            </div>
                          </div>
                          <p className="pool-address-small">
                            Pool: {pool.pool_address}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Display full API response */}
      {/* <div className="api-response">
        <h3>Full API Response:</h3>
        <pre>{JSON.stringify(yieldData, null, 2)}</pre>
      </div> */}
    </div>
  );
}
