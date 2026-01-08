# Backend Integration Guide

This guide explains how to integrate the new backend API with your existing Felina frontend.

## Overview

The backend provides:
- **REST API** for all data operations
- **WebSocket** for real-time updates
- **Authentication** via wallet signatures
- **Analytics** and metrics tracking
- **Transaction indexing** from blockchain

## Setup

### 1. Environment Variables

Add to your frontend `.env` file:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
```

### 2. Install Dependencies

```bash
npm install socket.io-client
```

### 3. Backend Setup

See `backend/README.md` for complete backend setup instructions.

## Integration Steps

### Step 1: Update Wallet Service

Modify `src/services/wallet.ts` to integrate with backend:

```typescript
import { apiClient } from '@/lib/api';

// After successful swap, track transaction
async swapETHForTokens(ethAmount: string, slippageTolerance: number = 0.5) {
  // ... existing swap logic ...
  
  if (receipt && receipt.status === 1) {
    // Track transaction in backend
    try {
      await apiClient.trackTransaction(receipt.transactionHash);
    } catch (error) {
      console.error('Failed to track transaction:', error);
    }
    
    // Refresh balance
    await this.refreshBalance();
    return true;
  }
}
```

### Step 2: Add Authentication

Create a new hook `src/hooks/use-auth.ts`:

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useWallet } from './use-wallet';
import { ethers } from 'ethers';

export function useAuth() {
  const { address, isConnected } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      checkAuth();
    } else {
      setIsAuthenticated(false);
    }
  }, [isConnected, address]);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        apiClient.setToken(token);
        const user = await apiClient.getMe();
        setIsAuthenticated(true);
      }
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum || !address) return;

    setIsLoading(true);
    try {
      // Create message to sign
      const message = `Sign this message to authenticate with Felina\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      
      // Sign message
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      // Authenticate with backend
      const { token, user } = await apiClient.connectWallet(address, signature, message);
      apiClient.setToken(token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Authentication failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    connectWallet,
  };
}
```

### Step 3: Add WebSocket Integration

Update your swap component to use WebSocket for real-time updates:

```typescript
import { useEffect } from 'react';
import { wsClient } from '@/lib/websocket';
import { apiClient } from '@/lib/api';

export function SwapCard() {
  // ... existing code ...

  useEffect(() => {
    // Connect WebSocket
    const token = localStorage.getItem('auth_token');
    wsClient.connect(token || undefined);

    // Subscribe to transaction updates
    const handleTxUpdate = (data: any) => {
      if (data.txHash === currentTxHash) {
        // Update UI with transaction status
        toast.success('Transaction confirmed!');
        refreshBalance();
      }
    };

    wsClient.onAnalyticsUpdate((data) => {
      // Update analytics in real-time
      setAnalytics(data);
    });

    wsClient.onRateUpdate((data) => {
      // Update exchange rate in real-time
      setExchangeRate(data.tokensPerEth);
    });

    return () => {
      wsClient.disconnect();
    };
  }, []);

  // ... rest of component
}
```

### Step 4: Add Transaction History

Create a new component `src/components/transaction-history.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useWallet } from '@/hooks/use-wallet';

export function TransactionHistory() {
  const { address } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address) {
      loadTransactions();
    }
  }, [address]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUserTransactions(address, { page: 1, limit: 20 });
      setTransactions(data.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Transaction History</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {transactions.map((tx) => (
            <li key={tx.id}>
              {tx.txHash} - {tx.status} - {tx.amountInEth} ETH
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Step 5: Add Analytics Dashboard

Create `src/components/analytics-dashboard.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { wsClient } from '@/lib/websocket';

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState(null);
  const [volumeStats, setVolumeStats] = useState([]);

  useEffect(() => {
    loadAnalytics();
    
    // Subscribe to real-time updates
    wsClient.onAnalyticsUpdate((data) => {
      setOverview(data);
    });

    return () => {
      wsClient.disconnect();
    };
  }, []);

  const loadAnalytics = async () => {
    try {
      const [overviewData, volumeData] = await Promise.all([
        apiClient.getAnalyticsOverview(),
        apiClient.getVolumeStats(7),
      ]);
      setOverview(overviewData);
      setVolumeStats(volumeData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  return (
    <div>
      <h2>Analytics</h2>
      {overview && (
        <div>
          <p>Total Users: {overview.totalUsers}</p>
          <p>Total Transactions: {overview.totalTransactions}</p>
          <p>Total Volume: {overview.totalVolumeEth} ETH</p>
        </div>
      )}
    </div>
  );
}
```

### Step 6: Add Notifications

Create `src/components/notifications.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { wsClient } from '@/lib/websocket';

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    
    // Subscribe to new notifications
    wsClient.subscribeNotifications((notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
  }, []);

  const loadNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        apiClient.getNotifications({ page: 1, limit: 20 }),
        apiClient.getUnreadCount(),
      ]);
      setNotifications(notifs.notifications);
      setUnreadCount(count.count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  return (
    <div>
      <h2>Notifications {unreadCount > 0 && `(${unreadCount})`}</h2>
      {notifications.map((notif) => (
        <div key={notif.id}>
          <h3>{notif.title}</h3>
          <p>{notif.message}</p>
        </div>
      ))}
    </div>
  );
}
```

## API Usage Examples

### Get Token Info
```typescript
const tokenInfo = await apiClient.getTokenInfo();
console.log(tokenInfo); // { name, symbol, decimals, totalSupply, contractAddress }
```

### Get Exchange Rate
```typescript
const rate = await apiClient.getExchangeRate();
console.log(rate); // { tokensPerEth, ethPerToken }
```

### Get Leaderboard
```typescript
const leaderboard = await apiClient.getLeaderboard('WEEKLY', 100);
console.log(leaderboard); // Array of leaderboard entries
```

### Track Transaction
```typescript
await apiClient.trackTransaction('0x...');
```

## WebSocket Events

### Subscribe to Transaction Updates
```typescript
wsClient.subscribeTransaction('0x...', (data) => {
  console.log('Transaction update:', data);
});
```

### Subscribe to Notifications
```typescript
wsClient.subscribeNotifications((notification) => {
  console.log('New notification:', notification);
});
```

### Listen to Rate Updates
```typescript
wsClient.onRateUpdate((data) => {
  console.log('Rate updated:', data);
});
```

## Error Handling

All API calls should be wrapped in try-catch:

```typescript
try {
  const data = await apiClient.getTokenInfo();
} catch (error) {
  if (error.message.includes('401')) {
    // Handle authentication error
    // Redirect to login or refresh token
  } else {
    // Handle other errors
    toast.error(error.message);
  }
}
```

## Best Practices

1. **Always check authentication** before making authenticated API calls
2. **Use WebSocket** for real-time data that changes frequently
3. **Cache API responses** when appropriate to reduce load
4. **Handle errors gracefully** with user-friendly messages
5. **Disconnect WebSocket** when component unmounts
6. **Refresh tokens** before they expire
7. **Track transactions** after successful swaps

## Next Steps

1. Start the backend server: `cd backend && npm run dev`
2. Start the blockchain indexer: `cd backend && npm run worker:indexer`
3. Start the analytics worker: `cd backend && npm run worker:analytics`
4. Update your frontend to use the new API client
5. Test authentication flow
6. Test WebSocket connections
7. Add transaction history UI
8. Add analytics dashboard
9. Add notifications UI

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGIN` in backend `.env` matches your frontend URL
- Check that backend is running on the correct port

### WebSocket Connection Failed
- Verify `VITE_WS_URL` matches backend URL
- Check that Socket.IO server is running
- Verify authentication token is valid

### Authentication Errors
- Ensure wallet is connected
- Verify signature is correct
- Check JWT token expiration

### Transaction Not Tracking
- Verify blockchain indexer is running
- Check contract address is correct
- Verify RPC endpoint is accessible

