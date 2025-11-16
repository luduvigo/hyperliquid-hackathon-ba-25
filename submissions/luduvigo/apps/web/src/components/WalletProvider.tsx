import React, { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "../lib/privy";

interface WalletProviderProps {
  children: ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  return <PrivyProvider appId={PRIVY_APP_ID}>{children}</PrivyProvider>;
}
