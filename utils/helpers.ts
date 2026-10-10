import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const screenWidth = width;
export const screenHeight = height;

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending': return '#FF9800';
    case 'viewed': return '#2196F3';
    case 'shortlisted': return '#9C27B0';
    case 'interview': return '#00BCD4';
    case 'accepted': return '#4CAF50';
    case 'rejected': return '#F44336';
    case 'completed': return '#4CAF50';
    case 'cancelled': return '#757575';
    case 'terminated': return '#DC2626';
    default: return '#666666';
  }
};

export const getStatusBgColor = (status: string): string => {
  switch (status) {
    case 'pending': return '#FFF3E0';
    case 'viewed': return '#E3F2FD';
    case 'shortlisted': return '#F3E5F5';
    case 'interview': return '#E0F7FA';
    case 'accepted': return '#E8F5E9';
    case 'rejected': return '#FFEBEE';
    case 'completed': return '#E8F5E9';
    case 'cancelled': return '#F5F5F5';
    case 'terminated': return '#FEE2E2';
    default: return '#F5F5F5';
  }
};

export const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'pending': return 'hourglass-empty';
    case 'viewed': return 'visibility';
    case 'shortlisted': return 'star';
    case 'interview': return 'event';
    case 'accepted': return 'check-circle';
    case 'rejected': return 'cancel';
    case 'completed': return 'task-alt';
    case 'cancelled': return 'not-interested';
    case 'terminated': return 'gavel';
    default: return 'help-outline';
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getInitials = (name: string): string => {
  const words = name.split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const formatCurrency = (amount: number): string => {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
