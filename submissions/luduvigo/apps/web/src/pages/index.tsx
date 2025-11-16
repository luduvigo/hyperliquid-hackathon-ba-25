import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { getBestYield } from "../lib/api";
import Layout from "../components/Layout";
import VaultStatus from "../components/VaultStatus";

export default function Home() {
  const { login, logout, ready, authenticated, user } = usePrivy();
  const [yieldData, setYieldData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchYields = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBestYield();
      setYieldData(data);
    } catch (err: any) {
      console.error("Error fetching yields:", err);
      setError(err.message || "Failed to fetch yield data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchYields();
    }
  }, [authenticated]);

  if (!ready) return <div>Loading...</div>;

  return (
    <Layout>
      <div className="container">
        <h1>GlueX Yield Optimizer</h1>

        {!authenticated && (
          <div className="connect-section">
            <p>Connect your wallet to start optimizing yields</p>
            <button onClick={login} className="btn-primary">
              Connect Wallet
            </button>
          </div>
        )}

        {authenticated && (
          <>
            <div className="wallet-info">
              <p>Connected: {user?.wallet?.address}</p>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                }}
              >
                <button onClick={logout} className="btn-secondary">
                  Disconnect
                </button>
                <button
                  onClick={fetchYields}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Refreshing..." : "Refresh Yields"}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <p>Error: {error}</p>
              </div>
            )}

            <VaultStatus yieldData={yieldData} />
          </>
        )}
      </div>
    </Layout>
  );
}
