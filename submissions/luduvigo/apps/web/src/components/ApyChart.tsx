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
import { getTokenApyHistory } from "@/lib/api";
import { ASSET_TOKEN } from "@/config/contracts";

interface ApyDataPoint {
  timestamp: string;
  [poolAddress: string]: string | number;
}

interface PoolData {
  pool_address: string;
  description: string;
  url: string;
  history: Array<{
    timestamp: string;
    total_apy: number;
    historic_apy: number;
    rewards_apy: number;
  }>;
}

const ApyChart: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "6h" | "24h" | "7d" | "30d"
  >("24h");
  const [chartData, setChartData] = useState<ApyDataPoint[]>([]);
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
    const fetchApyData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const hours = hoursMap[selectedPeriod];
        const response = await getTokenApyHistory(ASSET_TOKEN, hours);

        if (!response.success) {
          throw new Error(response.error || "Failed to fetch APY data");
        }

        const poolsData: PoolData[] = response.pools || [];

        if (poolsData.length === 0) {
          setError("No APY data available for this token");
          setChartData([]);
          setPools([]);
          setIsLoading(false);
          return;
        }

        setPools(poolsData);

        // Transform data for chart
        // Collect all unique timestamps from all pools
        const allTimestamps = new Set<string>();
        poolsData.forEach((pool) => {
          pool.history.forEach((point) => {
            // Round to nearest minute for alignment
            const date = new Date(point.timestamp);
            date.setSeconds(0, 0);
            allTimestamps.add(date.toISOString());
          });
        });

        // Sort timestamps
        const sortedTimestamps = Array.from(allTimestamps).sort();

        // Create data points for each timestamp
        const chartDataPoints: ApyDataPoint[] = sortedTimestamps.map(
          (isoString) => {
            const timestamp = new Date(isoString);
            const dataPoint: ApyDataPoint = {
              timestamp: timestamp.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            };

            // For each pool, find data at this timestamp (or closest within 1 minute)
            poolsData.forEach((pool) => {
              const targetTime = timestamp.getTime();

              // Find exact match or closest within 1 minute
              let bestMatch: { point: any; diff: number } | null = null;

              pool.history.forEach((point) => {
                const pointTime = new Date(point.timestamp).getTime();
                const diff = Math.abs(pointTime - targetTime);

                // Within 1 minute (60000ms)
                if (diff <= 60000) {
                  if (!bestMatch || diff < bestMatch.diff) {
                    bestMatch = { point, diff };
                  }
                }
              });

              if (bestMatch) {
                dataPoint[pool.pool_address] = bestMatch.point.total_apy;
                dataPoint[`${pool.pool_address}_desc`] = pool.description;
              }
            });

            return dataPoint;
          }
        );

        setChartData(chartDataPoints);
      } catch (err: any) {
        console.error("Error fetching APY data:", err);
        setError(err.message || "Failed to load APY data");
        setChartData([]);
        setPools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApyData();
  }, [selectedPeriod]);

  const formatTooltipValue = (value: number, name: string) => {
    if (typeof value !== "number" || isNaN(value)) return ["N/A", ""];
    return [`${value.toFixed(2)}%`, ""];
  };

  const formatTooltipLabel = (label: string, payload: any[]) => {
    if (!payload || payload.length === 0) return label;

    // Find the description from the first payload item
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

  // Generate colors for each pool
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
          <h3 className="apy-chart-title">APY Performance</h3>
          <span className="apy-chart-subtitle">
            Track APY across all pools for USD₮0
          </span>
        </div>

        {/* Time Period Selector */}
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

      {/* Chart */}
      <div className="apy-chart-wrapper">
        {isLoading ? (
          <div className="apy-chart-loading">
            <span>Loading APY data...</span>
          </div>
        ) : error ? (
          <div className="apy-chart-error">
            <span>{error}</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="apy-chart-empty">
            <span>No APY data available for this period</span>
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
                  tickFormatter={(value) => `${value}%`}
                  domain={["auto", "auto"]}
                  width={60}
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

            {/* Pool Legend */}
            <div className="apy-pool-legend">
              {pools.map((pool, index) => (
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
                  {pool.history.length > 0 && (
                    <span className="apy-legend-value">
                      {pool.history[pool.history.length - 1].total_apy.toFixed(
                        2
                      )}
                      %
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApyChart;
