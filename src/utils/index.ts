import type { QueueItem, PatientLevel, ExamItemType } from '@/types';

export const getLevelLabel = (level: PatientLevel): string => {
  const labelMap: Record<PatientLevel, string> = {
    normal: '普通',
    vip: 'VIP',
    urgent: '急检'
  };
  return labelMap[level];
};

export const getLevelColor = (level: PatientLevel): string => {
  const colorMap: Record<PatientLevel, string> = {
    normal: '#4e5969',
    vip: '#ffb100',
    urgent: '#f53f3f'
  };
  return colorMap[level];
};

export const getExamItemTypeLabel = (type: ExamItemType): string => {
  return type === 'fasting' ? '空腹' : '非空腹';
};

export const sortQueueByPriority = (queue: QueueItem[]): QueueItem[] => {
  return [...queue].sort((a, b) => {
    if (a.status === 'calling' && b.status !== 'calling') return -1;
    if (a.status !== 'calling' && b.status === 'calling') return 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.examItemType === 'fasting' && b.examItemType !== 'fasting') return -1;
    if (a.examItemType !== 'fasting' && b.examItemType === 'fasting') return 1;
    return a.queueTime.localeCompare(b.queueTime);
  });
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

export const formatCurrency = (amount: number): string => {
  return `¥${amount.toFixed(0)}`;
};
