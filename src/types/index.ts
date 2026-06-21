export type PatientLevel = 'normal' | 'vip' | 'urgent';

export type QueueStatus = 'waiting' | 'calling' | 'completed' | 'skipped';

export type ExamItemType = 'fasting' | 'non-fasting';

export type PaymentType = 'package' | 'self-pay' | 'split';

export type DispatchAction = 'call' | 'skip' | 'cancel' | 'transfer' | 'complete' | 'recall' | 'add_queue' | 'insert_vip' | 'insert_urgent';

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
  skippedFromRoomId?: string | null;
  skippedFromRoomName?: string | null;
  skippedAt?: number | null;
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
  roomId?: string | null;
  roomName?: string | null;
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

export interface DispatchLog {
  id: string;
  action: DispatchAction;
  actionLabel: string;
  timestamp: number;
  date: string;
  time: string;
  patientId: string | null;
  patientName: string | null;
  examItemId: string | null;
  examItemName: string | null;
  fromRoomId: string | null;
  fromRoomName: string | null;
  toRoomId: string | null;
  toRoomName: string | null;
  amount: number | null;
  paymentType: PaymentType | null;
  note: string | null;
}

export interface ExamItemSummary {
  examItemId: string;
  examItemName: string;
  patientCount: number;
  packageTotal: number;
  selfPayTotal: number;
  totalAmount: number;
  records: QuotaRecord[];
}
