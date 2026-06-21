export type PatientLevel = 'normal' | 'vip' | 'urgent';

export type QueueStatus = 'waiting' | 'calling' | 'completed' | 'skipped';

export type ExamItemType = 'fasting' | 'non-fasting';

export type PaymentType = 'package' | 'self-pay' | 'split';

export interface SplitDetail {
  packageAmount: number;
  selfPayAmount: number;
}

export interface ExamItem {
  id: string;
  name: string;
  type: ExamItemType;
  duration: number;
  price: number;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  level: PatientLevel;
  packageName: string;
  remainingQuota: number;
  totalQuota: number;
  currentExamItemId: string | null;
  completedItems: string[];
  queueNumber: number;
  priority: number;
}

export interface QueueItem {
  id: string;
  patientId: string;
  patientName: string;
  patientLevel: PatientLevel;
  examItemId: string;
  examItemName: string;
  examItemType: ExamItemType;
  status: QueueStatus;
  priority: number;
  queueTime: string;
  estimatedTime: number;
}

export interface QuotaRecord {
  id: string;
  patientId: string;
  patientName: string;
  examItemId: string;
  examItemName: string;
  amount: number;
  paymentType: PaymentType;
  packageAmount: number;
  selfPayAmount: number;
  date: string;
  time: string;
  period: string;
  timestamp: number;
}

export interface PackageQuota {
  id: string;
  packageName: string;
  totalQuota: number;
  period: string;
  resetDate: string;
}

export interface ExamRoom {
  id: string;
  name: string;
  examItemId: string;
  status: 'idle' | 'busy';
  currentPatientId: string | null;
  currentPatientName: string | null;
  callTime: number | null;
}

export interface ItemLoadStat {
  examItemId: string;
  examItemName: string;
  waitingCount: number;
  busyRoomCount: number;
  idleRoomCount: number;
  totalRoomCount: number;
  avgDuration: number;
  estimatedWaitMinutes: number;
  estimatedFinishTime: string;
}
