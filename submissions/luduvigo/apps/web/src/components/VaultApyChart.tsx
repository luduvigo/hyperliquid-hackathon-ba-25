"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getVaultHistory } from "@/lib/api";
import { VAULT_ADDRESS } from "@/config/contracts";

interface VaultApyDataPoint {
  timestamp: string;
  apy: number | null;
}

const VaultApyChart: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<
    "6h" | "24h" | "7d" | "30d"
  >("7d");
  const [chartData, setChartData] = useState<VaultApyDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoursMap = {
    "6h": 6,
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };

  useEffect(() => {
    const fetchVaultApyData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const hours = hoursMap[selectedPeriod];
        const response = await getVaultHistory(VAULT_ADDRESS, hours);

        if (!response.success) {
          throw new Error(response.error || "Failed to fetch vault APY data");
        }

        const historyData = response.data || [];

        if (historyData.length === 0) {
          setError("No vault APY data available for this period");
          setChartData([]);
          setIsLoading(false);
          return;
        }

        // Transform data for chart
        const chartDataPoints: VaultApyDataPoint[] = historyData
          .filter((point: any) => point.apy !== null && point.apy !== undefined)
          .map((point: any) => {
            const timestamp = new Date(point.timestamp);
            return {
              timestamp: timestamp.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              apy: point.apy,
            };
          });

        setChartData(chartDataPoints);
      } catch (err: any) {
        console.error("Error fetching vault APY data:", err);
        setError(err.message || "Failed to load vault APY data");
        setChartData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVaultApyData();
  }, [selectedPeriod]);

  const formatTooltipValue = (value: number) => {
    if (typeof value !== "number" || isNaN(value)) return "N/A";
    return `${value.toFixed(2)}%`;
  };

  const latestApy = chartData.length > 0 ? chartData[chartData.length - 1].apy : null;

  return (
    <div className="apy-chart-container">
      <div className="apy-chart-header">
        <div className="apy-chart-title-section">
          <h3 className="apy-chart-title">Vault Historical APY</h3>
          <span className="apy-chart-subtitle">
            Track the vault's APY over time
            {latestApy !== null && (
              <span style={{ marginLeft: "0.5rem", fontWeight: 600 }}>
                Current: {latestApy.toFixed(2)}%
              </span>
            )}
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
            <span>Loading vault APY data...</span>
          </div>
        ) : error ? (
          <div className="apy-chart-error">
            <span>{error}</span>
          </div>
        ) : chartData.length === 0 ? (
          <div className="apy-chart-empty">
            <span>No vault APY data available for this period</span>
          </div>
        ) : (
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
              />
              <Line
                type="monotone"
                dataKey="apy"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#8b5cf6" }}
                connectNulls={false}
                name="Vault APY"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default VaultApyChart;

