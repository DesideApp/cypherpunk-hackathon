import { useState, useEffect } from 'react';
import {
  PERIOD_OPTIONS,
  buildPeriodRequest,
  formatRangeLabel,
  formatBucketDuration
} from '../utils/periods';
import './UserManagement.css';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const ADMIN_JWT =
  import.meta.env.VITE_ADMIN_JWT ||
  import.meta.env.VITE_API_TOKEN ||
  import.meta.env.VITE_BEARER_TOKEN ||
  '';

const resolveBaseUrl = () => {
  if (rawBaseUrl) {
    return rawBaseUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
};

const USER_PERIOD_OPTIONS = PERIOD_OPTIONS.filter((option) =>
  ['1h', '1d', '7d'].includes(option.key)
);

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('lastActivity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [stats, setStats] = useState(null);
  const [statsMeta, setStatsMeta] = useState(buildPeriodRequest('1h').meta);
  const [statsPeriod, setStatsPeriod] = useState('1h');
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    const loadUsers = () => {
      const mockUsers = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        wallet: `User${i + 1}...`,
        nickname: `User ${i + 1}`,
        registeredAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        loginCount: Math.floor(Math.random() * 100) + 1,
        messagesSent: Math.floor(Math.random() * 500) + 10,
        bytesTransferred: Math.floor(Math.random() * 1000000) + 10000,
        relayTier: ['basic'][Math.floor(Math.random() * 1)],
        relayUsedBytes: Math.floor(Math.random() * 8000000) + 1000000,
        relayQuotaBytes: 8000000,
        banned: Math.random() < 0.05,
        role: Math.random() < 0.1 ? 'admin' : 'user'
      }));

      setUsers(mockUsers);
      setLoading(false);
    };

    loadUsers();

    const interval = setInterval(loadUsers, 300000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    let controller = new AbortController();

    const fetchStats = async (silent = false) => {
      if (!silent) {
        setStatsLoading(true);
        setStatsError(null);
      }

      controller.abort();
      controller = new AbortController();

      try {
        const { params, meta } = buildPeriodRequest(statsPeriod);
        setStatsMeta(meta);

        const baseUrl = resolveBaseUrl();
        const url = baseUrl
          ? new URL('/api/v1/stats/overview', baseUrl)
          : new URL('/api/v1/stats/overview', window.location.origin);

        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(ADMIN_JWT ? { Authorization: `Bearer ${ADMIN_JWT}` } : {})
          },
          credentials: ADMIN_JWT ? 'omit' : 'include',
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!mounted) return;

        setStats(data);
        setStatsError(null);
        setStatsMeta((prev) => ({
          ...prev,
          rangeLabel: formatRangeLabel(data?.period?.start, data?.period?.end) || prev.rangeLabel,
          bucketMinutes: data?.bucket?.minutes ?? prev.bucketMinutes
        }));
      } catch (err) {
        if (!mounted || err.name === 'AbortError') return;
        console.error('Failed to load user stats', err);
        setStatsError('Failed to load user metrics');
      } finally {
        if (mounted) {
          setStatsLoading(false);
        }
      }
    };

    fetchStats(false);
    const interval = setInterval(() => fetchStats(true), 60000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [statsPeriod]);

  const filteredUsers = users.filter(user => 
    user.wallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statsConnections = stats?.connections ?? {};
  const statsMessages = stats?.messages ?? {};
  const statsBucketLabel = formatBucketDuration(stats?.bucket?.minutes ?? statsMeta.bucketMinutes);
  const statsRangeLabel =
    statsMeta.rangeLabel || formatRangeLabel(stats?.period?.start, stats?.period?.end) || '';

  const formatStat = (value) =>
    value == null ? '—' : Number(value).toLocaleString('en-US');

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    if (sortBy === 'registeredAt' || sortBy === 'lastLogin') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getQuotaPercentage = (used, total) => {
    return ((used / total) * 100).toFixed(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleBanUser = (userId) => {
    setUsers(users.map(user => 
      user.id === userId ? { ...user, banned: !user.banned } : user
    ));
  };

  const handleAdjustLimit = (userId, newLimit) => {
    setUsers(users.map(user => 
      user.id === userId ? { ...user, relayQuotaBytes: newLimit } : user
    ));
  };

  if (loading) {
    return (
      <div className="users-loading">
        <div className="loading-spinner"></div>
        <p>Loading users…</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="users-header">
        <div className="users-header-info">
          <h2>
            User Management
            <span className="mock-badge">MOCK DATA</span>
          </h2>
          <p>Manage users and their limits</p>
        </div>
        <div className="period-selector user-period-selector">
          {USER_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`period-btn ${statsPeriod === option.key ? 'active' : ''}`}
              onClick={() => setStatsPeriod(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="user-stats-overview">
        {statsLoading ? (
          <div className="user-stats-placeholder">Loading user metrics…</div>
        ) : statsError ? (
          <div className="user-stats-error">{statsError}</div>
        ) : (
          <>
            <div className="user-stats-summary">
              <div className="summary-card">
                <span className="summary-label">Active now</span>
                <span className="summary-value">{formatStat(statsConnections.active)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Active last hour</span>
                <span className="summary-value">
                  {formatStat(statsConnections.activeLastHour)}
                </span>
              </div>
              <div className="summary-card">
                <span className="summary-label">New connections today</span>
                <span className="summary-value">{formatStat(statsConnections.newToday)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Disconnections</span>
                <span className="summary-value">{formatStat(statsConnections.disconnections)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">DAU</span>
                <span className="summary-value">{formatStat(statsConnections.dau)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Avg active</span>
                <span className="summary-value">{formatStat(statsConnections.avgActive)}</span>
              </div>
            </div>

            <div className="user-stats-meta">
              <div className="meta-card">
                <span className="meta-label">Range</span>
                <span className="meta-value">{statsRangeLabel || 'Selected range'}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Bucket size</span>
                <span className="meta-value">{statsBucketLabel}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Messages today</span>
                <span className="meta-value">{formatStat(statsMessages.today)}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Messages last hour</span>
                <span className="meta-value">{formatStat(statsMessages.lastHour)}</span>
              </div>
              <div className="meta-card">
                <span className="meta-label">Messages last minute</span>
                <span className="meta-value">{formatStat(statsMessages.lastMinute)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="users-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by wallet or nickname…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="users-stats">
          <span className="stat">Total: {users.length}</span>
          <span className="stat">Active: {users.filter(u => !u.banned).length}</span>
          <span className="stat">Banned: {users.filter(u => u.banned).length}</span>
          <span className="stat">Admins: {users.filter(u => u.role === 'admin').length}</span>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('wallet')} className="sortable">
                Wallet {sortBy === 'wallet' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('nickname')} className="sortable">
                Nickname {sortBy === 'nickname' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('lastLogin')} className="sortable">
                Last Login {sortBy === 'lastLogin' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('messagesSent')} className="sortable">
                Messages {sortBy === 'messagesSent' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('relayUsedBytes')} className="sortable">
                Relay Usage {sortBy === 'relayUsedBytes' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map(user => (
              <tr key={user.id} className={user.banned ? 'banned' : ''}>
                <td className="wallet-cell">
                  <span className="wallet-address">{user.wallet}</span>
                  {user.role === 'admin' && <span className="admin-badge">ADMIN</span>}
                </td>
                <td>{user.nickname}</td>
                <td>{formatDate(user.lastLogin)}</td>
                <td>{user.messagesSent}</td>
                <td>
                  <div className="quota-info">
                    <span className="quota-used">{formatBytes(user.relayUsedBytes)}</span>
                    <span className="quota-total">/ {formatBytes(user.relayQuotaBytes)}</span>
                    <div className="quota-bar">
                      <div 
                        className="quota-fill"
                        style={{ 
                          width: `${getQuotaPercentage(user.relayUsedBytes, user.relayQuotaBytes)}%`,
                          backgroundColor: user.relayUsedBytes > user.relayQuotaBytes * 0.8 ? '#F44336' : '#4CAF50'
                        }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${user.banned ? 'banned' : 'active'}`}>
                    {user.banned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      onClick={() => handleBanUser(user.id)}
                      className={`action-btn ${user.banned ? 'unban' : 'ban'}`}
                    >
                      {user.banned ? 'Unban' : 'Ban'}
                    </button>
                    <button 
                      onClick={() => {
                        const newLimit = prompt('New limit in bytes:', user.relayQuotaBytes);
                        if (newLimit && !isNaN(newLimit)) {
                          handleAdjustLimit(user.id, parseInt(newLimit));
                        }
                      }}
                      className="action-btn adjust"
                    >
                      Adjust Limit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedUsers.length === 0 && (
        <div className="no-users">
          <p>No users found</p>
        </div>
      )}
    </div>
  );
}
