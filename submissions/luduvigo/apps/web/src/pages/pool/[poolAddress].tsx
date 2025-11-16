import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getPoolHistory, getLatestApy } from "@/lib/api";

export default function PoolPage() {
  const router = useRouter();
  const { poolAddress } = router.query;

  const [selectedPeriod, setSelectedPeriod] = useState<
    "6h" | "24h" | "7d" | "30d"
  >("24h");
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [apyData, setApyData] = useState<any[]>([]);
  const [tvlData, setTvlData] = useState<any[]>([]);
  const [opportunityScoreData, setOpportunityScoreData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoursMap = {
    "6h": 6,
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };

  useEffect(() => {
    if (!poolAddress || typeof poolAddress !== "string") return;

    const fetchPoolData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get pool info from latest APY data
        const latestDataResponse = await getLatestApy();
        // Handle both direct array response and object with pools property
        const poolsArray = Array.isArray(latestDataResponse)
          ? latestDataResponse
          : latestDataResponse.pools || [];
        
        const pool = poolsArray.find(
          (p: any) =>
            p.pool_address?.toLowerCase() === poolAddress.toLowerCase()
        );

        if (!pool) {
          setError("Pool not found");
          setIsLoading(false);
          return;
        }

        setPoolInfo(pool);

        // Get historical data
        const hours = hoursMap[selectedPeriod];
        const historyResponse = await getPoolHistory(poolAddress, hours);

        if (!historyResponse.success) {
          throw new Error(
            historyResponse.error || "Failed to fetch pool history"
          );
        }

        const history = historyResponse.history || [];

        // Transform data for charts
        const chartData = history.map((h: any) => ({
          timestamp: new Date(h.timestamp).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          timestampRaw: h.timestamp,
          apy: h.total_apy || 0,
          historic_apy: h.historic_apy || 0,
          rewards_apy: h.rewards_apy || 0,
          tvl_usd: h.tvl_usd || null,
          opportunity_score: h.opportunity_score || null,
        }));

        setApyData(chartData);
        setTvlData(chartData);
        setOpportunityScoreData(chartData);
      } catch (err: any) {
        console.error("Error fetching pool data:", err);
        setError(err.message || "Failed to load pool data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoolData();
  }, [poolAddress, selectedPeriod]);

  const formatAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatNumber = (value: number, decimals: number = 2) => {
    if (value === 0) return "0";
    if (value < 0.01 && value > 0) return "<0.01";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="pool-page-container">
          <div className="loading-state">Loading pool data...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="pool-page-container">
          <div className="error-message">{error}</div>
        </div>
      </Layout>
    );
  }

  if (!poolInfo) {
    return (
      <Layout>
        <div className="pool-page-container">
          <div className="error-message">Pool not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pool-page-container">
        {/* Header */}
        <div className="pool-header">
          <Link
            href="/vault"
            className="back-button"
            style={{
              display: "inline-block",
              marginBottom: "1rem",
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              textDecoration: "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            ← Back to Vault
          </Link>
          <h1>{poolInfo.description || "Pool Details"}</h1>
          <div className="pool-meta">
            <div className="meta-item">
              <span className="meta-label">Address:</span>
              <span className="meta-value monospace">
                {formatAddress(poolAddress as string)}
              </span>
            </div>
            {poolInfo.url && (
              <a
                href={poolInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pool-link"
              >
                View on Platform ↗
              </a>
            )}
          </div>
        </div>

        {/* Current Stats */}
        <div className="pool-stats-grid">
          <div className="pool-stat-card">
            <div className="stat-label">Current APY</div>
            <div className="stat-value">
              {poolInfo.total_apy?.toFixed(2) || "0"}%
            </div>
            {poolInfo.historic_apy && (
              <div className="stat-detail">
                Historic: {poolInfo.historic_apy.toFixed(2)}%
              </div>
            )}
            {poolInfo.rewards_apy && poolInfo.rewards_apy > 0 && (
              <div className="stat-detail">
                Rewards: {poolInfo.rewards_apy.toFixed(2)}%
              </div>
            )}
          </div>

          <div className="pool-stat-card">
            <div className="stat-label">TVL</div>
            <div className="stat-value">
              {poolInfo.tvl_usd
                ? `$${formatNumber(poolInfo.tvl_usd, 0)}`
                : "N/A"}
            </div>
          </div>

          <div className="pool-stat-card">
            <div className="stat-label">
              Opportunity Score{" "}
              <Link
                href="/opportunity-score"
                className="info-link"
                title="Learn about Opportunity Score"
              >
                ℹ️
              </Link>
            </div>
            <div className="stat-value">
              {poolInfo.opportunity_score !== null &&
              poolInfo.opportunity_score !== undefined
                ? poolInfo.opportunity_score.toFixed(2)
                : "N/A"}
            </div>
            {poolInfo.opportunity_score_details && (
              <div className="stat-detail">
                Stability APY:{" "}
                {poolInfo.opportunity_score_details.stability_adjusted_apy?.toFixed(
                  2
                ) || "N/A"}
                %
              </div>
            )}
          </div>
        </div>

        {/* Period Selector */}
        <div className="chart-period-selector">
          {(["6h", "24h", "7d", "30d"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`period-button ${
                selectedPeriod === period ? "period-active" : ""
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Opportunity Score Chart */}
        <div className="pool-chart-card">
          <h2>Opportunity Score History</h2>
          {opportunityScoreData.length === 0 ? (
            <div className="chart-empty">No opportunity score data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={opportunityScoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9ca3af"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="opportunity_score"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="Opportunity Score"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* APY Chart */}
        <div className="pool-chart-card">
          <h2>APY History</h2>
          {apyData.length === 0 ? (
            <div className="chart-empty">No APY data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={apyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9ca3af"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="apy"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="Total APY"
                />
                <Line
                  type="monotone"
                  dataKey="historic_apy"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="Historic APY"
                />
                {apyData.some((d) => d.rewards_apy > 0) && (
                  <Line
                    type="monotone"
                    dataKey="rewards_apy"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="Rewards APY"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* TVL Chart */}
        <div className="pool-chart-card">
          <h2>TVL History</h2>
          {tvlData.length === 0 ||
          tvlData.every((d) => d.tvl_usd === null) ? (
            <div className="chart-empty">No TVL data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={tvlData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9ca3af"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(value) =>
                    `$${value.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                  formatter={(value: any) => [
                    `$${value.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`,
                    "TVL",
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tvl_usd"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="TVL (USD)"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  );
}

