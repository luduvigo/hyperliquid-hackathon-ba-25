import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { getMarketAverageHistory } from "@/lib/api";

export default function TokenMarketAveragePage() {
  const router = useRouter();
  const { token } = router.query;

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [hours, setHours] = useState(168); // Default 7 days

  const tokenAddress = token as string | undefined;

  const loadHistory = async () => {
    if (!tokenAddress) return;
    
    setLoading(true);
    setError("");
    try {
      const response = await getMarketAverageHistory(tokenAddress, hours);
      if (response.success && response.history) {
        // Sort by timestamp descending (newest first)
        const sortedHistory = [...response.history].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setHistory(sortedHistory);
      } else {
        setError("No market average data available");
        setHistory([]);
      }
    } catch (err: any) {
      console.error("Error loading market average history:", err);
      setError(err.message || "Failed to load market average history");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenAddress) {
      loadHistory();
    }
  }, [tokenAddress, hours]);

  const toggleRow = (timestamp: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(timestamp)) {
      newExpanded.delete(timestamp);
    } else {
      newExpanded.add(timestamp);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    if (value === 0) return "0";
    if (value < 0.01 && value > 0) return "<0.01";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Layout>
      <div className="market-average-page">
        <div className="market-average-header">
          <h1>
            Market Average Performance
            {tokenAddress && (
              <span className="token-badge">
                Token: {formatAddress(tokenAddress)}
              </span>
            )}
          </h1>
          <div className="controls">
            <label>
              Time Range:
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="hours-select"
              >
                <option value={24}>Last 24 hours</option>
                <option value={168}>Last 7 days</option>
                <option value={720}>Last 30 days</option>
                <option value={2160}>Last 90 days</option>
              </select>
            </label>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-state">Loading market average data...</div>
        ) : history.length === 0 ? (
          <div className="empty-state">No market average data available</div>
        ) : (
          <div className="market-average-table-container">
            <table className="market-average-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Weighted APY</th>
                  <th>Total TVL (USD)</th>
                  <th>Pool Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record, index) => {
                  const recordKey = record.timestamp || index.toString();
                  const isExpanded = expandedRows.has(recordKey);

                  return (
                    <React.Fragment key={recordKey}>
                      <tr className="data-row">
                        <td>{formatDate(record.timestamp)}</td>
                        <td className="apy-cell">
                          {record.market_avg_apy?.toFixed(2) || "0"}%
                        </td>
                        <td>${formatNumber(record.total_tvl_usd || 0, 0)}</td>
                        <td>{record.pool_count || 0}</td>
                        <td>
                          <button
                            className="expand-button"
                            onClick={() => toggleRow(recordKey)}
                          >
                            {isExpanded ? "▼ Hide Details" : "▶ Show Details"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="details-row">
                          <td colSpan={5}>
                            <div className="calculation-details">
                              <h3>Calculation Details</h3>
                              <div className="calculation-formula">
                                <div className="formula-item">
                                  <span className="formula-label">
                                    Market Average APY:
                                  </span>
                                  <span className="formula-value">
                                    {record.market_avg_apy?.toFixed(4) || "0"}%
                                  </span>
                                </div>
                                <div className="formula-explanation">
                                  Formula: Σ(APY(i) × TVL(i)) / Σ(TVL(i))
                                </div>
                              </div>

                              <div className="calculation-breakdown">
                                <h4>Pool Breakdown</h4>
                                <div className="breakdown-table">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Pool</th>
                                        <th>Description</th>
                                        <th>APY</th>
                                        <th>TVL (USD)</th>
                                        <th>Weighted Contribution</th>
                                        <th>Weight %</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {record.pool_breakdown?.map(
                                        (pool: any, poolIndex: number) => {
                                          const weightPercent =
                                            record.total_tvl_usd > 0
                                              ? (pool.tvl_usd /
                                                  record.total_tvl_usd) *
                                                100
                                              : 0;

                                          return (
                                            <tr key={poolIndex}>
                                              <td className="address-cell">
                                                {formatAddress(
                                                  pool.pool_address
                                                )}
                                              </td>
                                              <td>{pool.description}</td>
                                              <td>
                                                {pool.apy?.toFixed(2) || "0"}%
                                              </td>
                                              <td>
                                                $
                                                {formatNumber(
                                                  pool.tvl_usd || 0,
                                                  0
                                                )}
                                              </td>
                                              <td>
                                                {pool.weighted_contribution?.toFixed(
                                                  2
                                                ) || "0"}
                                              </td>
                                              <td>
                                                {weightPercent.toFixed(2)}%
                                              </td>
                                            </tr>
                                          );
                                        }
                                      ) || (
                                        <tr>
                                          <td colSpan={6}>
                                            No pool breakdown available
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="calculation-summary">
                                <div className="summary-item">
                                  <span className="summary-label">
                                    Total Weighted Sum:
                                  </span>
                                  <span className="summary-value">
                                    {record.pool_breakdown
                                      ?.reduce(
                                        (sum: number, pool: any) =>
                                          sum +
                                          (pool.weighted_contribution || 0),
                                        0
                                      )
                                      .toFixed(2) || "0"}
                                  </span>
                                </div>
                                <div className="summary-item">
                                  <span className="summary-label">
                                    Total TVL (USD):
                                  </span>
                                  <span className="summary-value">
                                    $
                                    {formatNumber(
                                      record.total_tvl_usd || 0,
                                      0
                                    )}
                                  </span>
                                </div>
                                <div className="summary-item">
                                  <span className="summary-label">
                                    Market Average:
                                  </span>
                                  <span className="summary-value">
                                    {record.market_avg_apy?.toFixed(4) || "0"}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

