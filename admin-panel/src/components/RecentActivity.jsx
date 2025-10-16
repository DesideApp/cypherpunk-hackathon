import { useState, useEffect } from 'react';
import './RecentActivity.css';

export default function RecentActivity() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const mockActivities = [
      {
        id: 1,
        type: 'message',
        user: 'User123...',
        action: 'Sent a message',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        status: 'success'
      },
      {
        id: 2,
        type: 'blink',
        user: 'User456...',
        action: 'Ran a blink',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        status: 'success'
      },
      {
        id: 3,
        type: 'error',
        user: 'User789...',
        action: 'Connection error',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        status: 'error'
      },
      {
        id: 4,
        type: 'login',
        user: 'UserABC...',
        action: 'Signed in',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        status: 'success'
      },
      {
        id: 5,
        type: 'message',
        user: 'UserXYZ...',
        action: 'Sent a message',
        timestamp: new Date(Date.now() - 20 * 60 * 1000),
        status: 'success'
      }
    ];

    setActivities(mockActivities);
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'message': return '💬';
      case 'blink': return '⚡';
      case 'login': return '🔑';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="recent-activity">
      <h3>
        Recent Activity
        <span className="mock-badge">MOCK DATA</span>
      </h3>
      
      <div className="activity-list">
        {activities.map(activity => (
          <div key={activity.id} className={`activity-item ${activity.status}`}>
            <div className="activity-icon">
              {getActivityIcon(activity.type)}
            </div>
            
            <div className="activity-content">
              <div className="activity-header">
                <span className="activity-user">{activity.user}</span>
                <span className="activity-time">{formatTime(activity.timestamp)}</span>
              </div>
              
              <div className="activity-action">
                {activity.action}
              </div>
            </div>
            
            <div className={`activity-status ${activity.status}`}>
              {activity.status === 'success' ? '✅' : '❌'}
            </div>
          </div>
        ))}
      </div>
      
      <div className="activity-footer">
        <button className="view-all-btn">
          View all activity
        </button>
      </div>
    </div>
  );
}
