export type PatientLevel = 'normal' | 'vip' | 'urgent';

export type QueueStatus = 'waiting' | 'calling' | 'completed' | 'skipped';

export type ExamItemType = 'fasting' | 'non-fasting';

export type PaymentType = 'package' | 'self-pay';

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
  date: string;
  period: string;
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
}
