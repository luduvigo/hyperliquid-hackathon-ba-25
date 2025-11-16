"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
import { getTokenOpportunityScoreHistory } from "@/lib/api";
import { ASSET_TOKEN } from "@/config/contracts";

interface ScoreDataPoint {
  timestamp: string;
  [poolAddress: string]: string | number | null;
}

interface PoolData {
  pool_address: string;
  description: string;
  url: string;
  history: Array<{
    timestamp: string;
    opportunity_score: number | null;
    opportunity_score_details: any | null;
  }>;
}

const OpportunityScoreChart: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "6h" | "24h" | "7d" | "30d"
  >("24h");
  const [chartData, setChartData] = useState<ScoreDataPoint[]>([]);
  const [pools, setPools] = useState<PoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoursMap = {
    "6h": 6,
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };

  useEffect(() => {
    const fetchScoreData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const hours = hoursMap[selectedPeriod];
        const response = await getTokenOpportunityScoreHistory(ASSET_TOKEN, hours);

        if (!response.success) {
          throw new Error(response.error || "Failed to fetch opportunity score data");
        }

        const poolsData: PoolData[] = response.pools || [];

        if (poolsData.length === 0) {
          setError("No opportunity score data available for this token");
          setChartData([]);
          setPools([]);
          setIsLoading(false);
          return;
        }

        setPools(poolsData);

        // Transform data for chart
        const allTimestamps = new Set<string>();
        poolsData.forEach((pool) => {
          pool.history.forEach((point) => {
            if (point.opportunity_score !== null) {
              const date = new Date(point.timestamp);
              date.setSeconds(0, 0);
              allTimestamps.add(date.toISOString());
            }
          });
        });

        const sortedTimestamps = Array.from(allTimestamps).sort();

        const chartDataPoints: ScoreDataPoint[] = sortedTimestamps.map(
          (isoString) => {
            const timestamp = new Date(isoString);
            const dataPoint: ScoreDataPoint = {
              timestamp: timestamp.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            };

            poolsData.forEach((pool) => {
              const targetTime = timestamp.getTime();
              let bestMatch: { point: any; diff: number } | null = null;

              pool.history.forEach((point) => {
                const pointTime = new Date(point.timestamp).getTime();
                const diff = Math.abs(pointTime - targetTime);

                if (diff <= 60000) {
                  if (!bestMatch || diff < bestMatch.diff) {
                    bestMatch = { point, diff };
                  }
                }
              });

              if (bestMatch && bestMatch.point.opportunity_score !== null) {
                dataPoint[pool.pool_address] = bestMatch.point.opportunity_score;
                dataPoint[`${pool.pool_address}_desc`] = pool.description;
              }
            });

            return dataPoint;
          }
        );

        setChartData(chartDataPoints);
      } catch (err: any) {
        console.error("Error fetching opportunity score data:", err);
        setError(err.message || "Failed to load opportunity score data");
        setChartData([]);
        setPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScoreData();
  }, [selectedPeriod]);

  const formatTooltipValue = (value: number, name: string) => {
    if (typeof value !== "number" || isNaN(value)) return ["N/A", ""];
    return [value.toFixed(2), ""];
  };

  const formatTooltipLabel = (label: string, payload: any[]) => {
    if (!payload || payload.length === 0) return label;

    const firstPayload = payload[0];
    const poolAddress = firstPayload.dataKey as string;
    const descKey = `${poolAddress}_desc`;
    const description =
      chartData.find((d) => d[descKey])?.[descKey] || poolAddress;

    return (
      <div>
        <div style={{ marginBottom: "4px" }}>{label}</div>
        <div style={{ fontSize: "12px", color: "#9ca3af" }}>{description}</div>
      </div>
    );
  };

  const colors = [
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#10b981", // green
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#ef4444", // red
    "#06b6d4", // cyan
  ];

  return (
    <div className="apy-chart-container">
      <div className="apy-chart-header">
        <div className="apy-chart-title-section">
          <h3 className="apy-chart-title">
            <Link
              href="/opportunity-score"
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
              title="Learn about Opportunity Score"
            >
              Opportunity Score Performance
            </Link>
          </h3>
          <span className="apy-chart-subtitle">
            Track opportunity scores across all pools for USD₮0
          </span>
        </div>

        <div className="apy-period-selector">
          {(["6h", "24h", "7d", "30d"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`apy-period-button ${
                selectedPeriod === period ? "apy-period-active" : ""
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="apy-chart-wrapper">
        {isLoading ? (
          <div className="apy-chart-loading">
            <span>Loading opportunity score data...</span>
          </div>
        ) : error ? (
          <div className="apy-chart-error">
            <span>{error}</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="apy-chart-empty">
            <span>No opportunity score data available for this period</span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
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
                  domain={["auto", "auto"]}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                  formatter={formatTooltipValue}
                  labelFormatter={formatTooltipLabel}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => {
                    const pool = pools.find((p) => p.pool_address === value);
                    return pool?.description || value;
                  }}
                />
                {pools.map((pool, index) => (
                  <Line
                    key={pool.pool_address}
                    type="monotone"
                    dataKey={pool.pool_address}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: colors[index % colors.length] }}
                    connectNulls={false}
                    name={pool.pool_address}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="apy-pool-legend">
              {pools.map((pool, index) => {
                const latestScore = pool.history
                  .filter((h) => h.opportunity_score !== null)
                  .slice(-1)[0]?.opportunity_score;
                return (
                  <div key={pool.pool_address} className="apy-legend-item">
                    <div
                      className="apy-legend-color"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <Link
                      href={`/pool/${pool.pool_address}`}
                      className="apy-legend-label"
                      style={{
                        color: "var(--text-primary)",
                        textDecoration: "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--primary)";
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-primary)";
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      {pool.description}
                    </Link>
                    {latestScore !== null && latestScore !== undefined && (
                      <span className="apy-legend-value">
                        {latestScore.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OpportunityScoreChart;

