// src/App.jsx
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

import "@shared/ui";

import { ServerProvider, useServer } from "@features/auth/contexts/ServerContext.jsx";
import { LayoutProvider } from "@features/layout/contexts/LayoutContext.jsx";
import { ThemeProvider, RpcProvider, WalletProvider } from '@wallet-adapter';
import { SocketProvider } from "@shared/socket";

import Layout from "@Layout";
import { AuthProvider } from "@features/auth/contexts/AuthContext.jsx";
import { MessagingProvider } from "@features/messaging/contexts/MessagingProvider.jsx";
import { useSocket } from "@shared/socket";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";

function MessagingProviderHost({ children }) {
  const { socket } = useSocket();
  const { isAuthenticated } = useAuthManager();
  return (
    <MessagingProvider socket={socket} isAuthenticated={isAuthenticated}>
      {children}
    </MessagingProvider>
  );
}

function SocketReauthOnAuth() {
  const { isAuthenticated } = useServer();
  const { reconnectWithAuth } = useSocket();
  const didRef = React.useRef(false);
  React.useEffect(() => {
    if (isAuthenticated) {
      if (!didRef.current && typeof reconnectWithAuth === 'function') {
        try { reconnectWithAuth(); } catch {}
        didRef.current = true;
      }
    } else {
      didRef.current = false;
    }
  }, [isAuthenticated, reconnectWithAuth]);
  return null;
}

import NotificationsHost from "@shared/components/NotificationsHost.jsx";

// 🔑 Tu flujo de auth / paneles (tal como ya tengas)
import AuthFlowHost from "@features/auth/components/AuthFlowHost.jsx";
import WalletPanelHost from "@features/wallet/components/WalletPanelHost.jsx";


export default function App() {
  const endpoint = import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com';

  return (
    <ServerProvider>
      <ThemeProvider>
        <RpcProvider endpoint={endpoint}>
          <WalletProvider>
            <AuthProvider>
              <SocketProvider>
                <SocketReauthOnAuth />
                <MessagingProviderHost>
                  <LayoutProvider>
                    <Router>
                      <Layout />
                      <NotificationsHost />

                      <AuthFlowHost />
                      <WalletPanelHost />
                    </Router>
                  </LayoutProvider>
                </MessagingProviderHost>
              </SocketProvider>
            </AuthProvider>
          </WalletProvider>
        </RpcProvider>
      </ThemeProvider>
    </ServerProvider>
  );
}
