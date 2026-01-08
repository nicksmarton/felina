/**
 * Backend API Client for MeowFi
 * Provides typed functions for interacting with the backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return data.data as T;
  }

  // Auth endpoints
  async connectWallet(walletAddress: string, signature: string, message: string) {
    return this.request<{ token: string; user: any }>('/auth/wallet/connect', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  }

  async verifySignature(walletAddress: string, signature: string, message: string) {
    return this.request<{ isValid: boolean }>('/auth/wallet/verify', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature, message }),
    });
  }

  async refreshToken(token: string) {
    return this.request<{ token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // User endpoints
  async getMe() {
    return this.request('/users/me');
  }

  async getUserByAddress(walletAddress: string) {
    return this.request(`/users/${walletAddress}`);
  }

  async updateProfile(data: { username?: string; email?: string }) {
    return this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getPreferences() {
    return this.request('/users/me/preferences');
  }

  async updatePreferences(data: { theme?: string; notifications?: boolean; language?: string }) {
    return this.request('/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserStats() {
    return this.request('/users/me/stats');
  }

  // Transaction endpoints
  async getTransactions(params?: { page?: number; limit?: number; status?: string; type?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    
    return this.request(`/transactions?${query.toString()}`);
  }

  async getTransactionByHash(txHash: string) {
    return this.request(`/transactions/${txHash}`);
  }

  async getUserTransactions(walletAddress: string, params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    
    return this.request(`/transactions/user/${walletAddress}?${query.toString()}`);
  }

  async trackTransaction(txHash: string) {
    return this.request('/transactions/track', {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    });
  }

  async getTransactionStats() {
    return this.request('/transactions/stats/summary');
  }

  // Token endpoints
  async getTokenInfo() {
    return this.request('/token/info');
  }

  async getTokenMetrics(hours?: number) {
    const query = hours ? `?hours=${hours}` : '';
    return this.request(`/token/metrics${query}`);
  }

  async getTokenSupply() {
    return this.request('/token/supply');
  }

  async getExchangeRate() {
    return this.request('/token/rate');
  }

  async getTokenPrice() {
    return this.request('/token/price');
  }

  // Analytics endpoints
  async getAnalyticsOverview() {
    return this.request('/analytics/overview');
  }

  async getVolumeStats(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request(`/analytics/volume${query}`);
  }

  async getUserStats() {
    return this.request('/analytics/users');
  }

  async getTransactionAnalytics(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request(`/analytics/transactions${query}`);
  }

  async getPriceHistory(hours?: number) {
    const query = hours ? `?hours=${hours}` : '';
    return this.request(`/analytics/price-history${query}`);
  }

  async getTrends() {
    return this.request('/analytics/trends');
  }

  // Leaderboard endpoints
  async getLeaderboard(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME', limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request(`/leaderboard/${period}${query}`);
  }

  async getUserRank(walletAddress: string, period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME') {
    return this.request(`/leaderboard/user/${walletAddress}?period=${period}`);
  }

  // Notification endpoints
  async getNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    
    return this.request(`/notifications?${query.toString()}`);
  }

  async getUnreadCount() {
    return this.request('/notifications/unread');
  }

  async markAsRead(notificationId: string) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async markAllAsRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(notificationId: string) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

