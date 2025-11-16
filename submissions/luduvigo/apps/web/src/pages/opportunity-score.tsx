import React from "react";
import Layout from "@/components/Layout";
import Link from "next/link";

export default function OpportunityScorePage() {
  return (
    <Layout>
      <div className="opportunity-score-page">
        <div className="page-header">
          <Link href="/vault" className="back-link">
            ← Back to Vault
          </Link>
          <h1>Understanding Opportunity Score</h1>
          <p className="page-subtitle">
            Learn how the Opportunity Score helps identify the best yield
            opportunities
          </p>
        </div>

        <div className="opportunity-score-content">
          <div className="opportunity-score-explanation">
            <p className="explanation-intro">
              The Opportunity Score is a metric that balances
              <strong> current yield potential</strong> with{" "}
              <strong>historical stability</strong> and{" "}
              <strong>pool capacity</strong>. It helps identify pools that offer
              sustainable, trustworthy returns rather than chasing temporary
              high yields.
            </p>

            <div className="formula-section">
              <h4>The Formula</h4>
              <div className="formula-block">
                <div className="formula-main">
                  <span className="formula-label">Opportunity Score</span>
                  <span className="formula-equals">=</span>
                  <span className="formula-components">
                    Stability-Adjusted APY × TVL Confidence Factor
                  </span>
                </div>
              </div>
            </div>

            <div className="formula-section">
              <h4>1. Stability-Adjusted APY</h4>
              <p className="formula-description">
                This component penalizes volatile pools and rewards stable
                yields:
              </p>
              <div className="formula-block">
                <div className="formula-main">
                  <span className="formula-label">Stability-Adjusted APY</span>
                  <span className="formula-equals">=</span>
                  <span className="formula-components">
                    APY<sub>avg 24h</sub> - (Risk Penalty × APY
                    <sub>std 24h</sub>)
                  </span>
                </div>
              </div>
              <ul className="formula-details">
                <li>
                  <strong>
                    APY<sub>avg 24h</sub>
                  </strong>
                  : Average APY over the last 24 hours (more reliable than a
                  single point)
                </li>
                <li>
                  <strong>
                    APY<sub>std 24h</sub>
                  </strong>
                  : Standard deviation of APY (measures volatility/risk)
                </li>
                <li>
                  <strong>Risk Penalty</strong>: Default = 1 (adjustable based
                  on risk appetite)
                </li>
              </ul>
              <div className="formula-example">
                <strong>Example:</strong> Pool with 12% avg APY and 5% std
                deviation → Stability-Adjusted APY = 12% - (1 × 5%) = 7%
              </div>
            </div>

            <div className="formula-section">
              <h4>2. TVL Confidence Factor</h4>
              <p className="formula-description">
                This factor ensures the pool can safely absorb your assets
                without yield dilution:
              </p>
              <div className="formula-block">
                <div className="formula-main">
                  <span className="formula-label">TVL Confidence Factor</span>
                  <span className="formula-equals">=</span>
                  <span className="formula-components">
                    1 / (1 + e<sup>-k × (TVL/AssetSize - m)</sup>)
                  </span>
                </div>
              </div>
              <ul className="formula-details">
                <li>
                  <strong>TVL</strong>: Total Value Locked in the pool
                </li>
                <li>
                  <strong>Asset Size</strong>: Your deployment amount (default:
                  $100k)
                </li>
                <li>
                  <strong>k</strong>: Sigmoid steepness (default: 20)
                </li>
                <li>
                  <strong>m</strong>: Midpoint ratio (default: 0.1 = 10% of
                  pool)
                </li>
              </ul>
              <div className="formula-example">
                <strong>Example:</strong> Pool with $50M TVL, your $100k assets
                → Ratio = 500 → Confidence Factor ≈ 100% (very safe)
              </div>
            </div>

            <div className="formula-section">
              <h4>Final Score Interpretation</h4>
              <ul className="formula-details">
                <li>
                  <strong>Higher Score</strong>: Better opportunity (stable
                  yield + large pool capacity)
                </li>
                <li>
                  <strong>Negative Score</strong>: Set to 0 (risk-adjusted
                  return is unacceptable)
                </li>
                <li>
                  <strong>Score = 0</strong>: Either no data available or
                  risk-adjusted return is negative
                </li>
              </ul>
              <p className="formula-note">
                <strong>Note:</strong> The system automatically allocates to
                pools with the highest opportunity scores, ensuring optimal
                risk-adjusted returns.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
