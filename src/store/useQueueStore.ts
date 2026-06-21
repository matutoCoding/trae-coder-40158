import { create } from 'zustand';
import type { QueueItem, Patient, QuotaRecord, ExamRoom, PatientLevel, ExamItem } from '@/types';
import { initialQueue, patients as mockPatients, quotaRecords as mockRecords, examRooms as mockRooms, examItems as mockExamItems } from '@/data/mockData';
import { sortQueueByPriority, generateId } from '@/utils';

interface QueueState {
  queue: QueueItem[];
  patients: Patient[];
  quotaRecords: QuotaRecord[];
  examRooms: ExamRoom[];
  examItems: ExamItem[];
  currentCalling: QueueItem | null;

  addToQueue: (patientId: string, examItemId: string) => void;
  callNext: () => void;
  completeCurrent: () => void;
  skipCurrent: () => void;
  insertVip: (patientId: string, examItemId: string) => void;
  insertUrgent: (patientId: string, examItemId: string) => void;
  resetQuota: (patientId: string) => void;
  useQuota: (patientId: string, amount: number) => { success: boolean; paymentType: 'package' | 'self-pay' };
  getWaitingCount: () => number;
  getFastingCount: () => number;
  getVipCount: () => number;
  getUrgentCount: () => number;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: sortQueueByPriority(initialQueue),
  patients: mockPatients,
  quotaRecords: mockRecords,
  examRooms: mockRooms,
  examItems: mockExamItems,
  currentCalling: initialQueue.find(item => item.status === 'calling') || null,

  addToQueue: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const priorityMap: Record<PatientLevel, number> = {
      normal: 3,
      vip: 2,
      urgent: 1
    };

    const newItem: QueueItem = {
      id: generateId(),
      patientId,
      patientName: patient.name,
      patientLevel: patient.level,
      examItemId,
      examItemName: examItem.name,
      examItemType: examItem.type,
      status: 'waiting',
      priority: priorityMap[patient.level],
      queueTime: timeStr,
      estimatedTime: queue.length * 10 + 10
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    console.log('[Queue] 添加排队:', patient.name, examItem.name);
  },

  callNext: () => {
    const { queue } = get();
    const sortedQueue = sortQueueByPriority(queue);
    const nextItem = sortedQueue.find(item => item.status === 'waiting');
    if (!nextItem) {
      console.log('[Queue] 没有等待中的患者');
      return;
    }

    const newQueue = queue.map(item => {
      if (item.status === 'calling') {
        return { ...item, status: 'waiting' as const };
      }
      if (item.id === nextItem.id) {
        return { ...item, status: 'calling' as const };
      }
      return item;
    });

    set({
      queue: sortQueueByPriority(newQueue),
      currentCalling: { ...nextItem, status: 'calling' }
    });
    console.log('[Queue] 叫号:', nextItem.patientName, nextItem.examItemName);
  },

  completeCurrent: () => {
    const { queue, currentCalling, patients } = get();
    if (!currentCalling) return;

    const newQueue = queue.map(item =>
      item.id === currentCalling.id ? { ...item, status: 'completed' as const } : item
    );

    const examItem = get().examItems.find(e => e.id === currentCalling.examItemId);
    if (examItem) {
      const patient = patients.find(p => p.id === currentCalling.patientId);
      if (patient) {
        const result = get().useQuota(currentCalling.patientId, examItem.price);
        const newRecord: QuotaRecord = {
          id: generateId(),
          patientId: currentCalling.patientId,
          patientName: currentCalling.patientName,
          examItemId: currentCalling.examItemId,
          examItemName: currentCalling.examItemName,
          amount: examItem.price,
          paymentType: result.paymentType,
          date: new Date().toISOString().split('T')[0],
          period: '2024-01'
        };
        set(state => ({
          quotaRecords: [newRecord, ...state.quotaRecords]
        }));
      }
    }

    const waitingQueue = newQueue.filter(item => item.status === 'waiting');
    const newCalling = waitingQueue.length > 0 ? sortQueueByPriority(waitingQueue)[0] : null;

    if (newCalling) {
      const finalQueue = newQueue.map(item =>
        item.id === newCalling.id ? { ...item, status: 'calling' as const } : item
      );
      set({
        queue: sortQueueByPriority(finalQueue),
        currentCalling: { ...newCalling, status: 'calling' }
      });
    } else {
      set({
        queue: sortQueueByPriority(newQueue),
        currentCalling: null
      });
    }

    console.log('[Queue] 完成检查:', currentCalling.patientName);
  },

  skipCurrent: () => {
    const { queue, currentCalling } = get();
    if (!currentCalling) return;

    const newQueue = queue.map(item =>
      item.id === currentCalling.id ? { ...item, status: 'skipped' as const } : item
    );

    const waitingQueue = newQueue.filter(item => item.status === 'waiting');
    const newCalling = waitingQueue.length > 0 ? sortQueueByPriority(waitingQueue)[0] : null;

    if (newCalling) {
      const finalQueue = newQueue.map(item =>
        item.id === newCalling.id ? { ...item, status: 'calling' as const } : item
      );
      set({
        queue: sortQueueByPriority(finalQueue),
        currentCalling: { ...newCalling, status: 'calling' }
      });
    } else {
      set({
        queue: sortQueueByPriority(newQueue),
        currentCalling: null
      });
    }

    console.log('[Queue] 跳过:', currentCalling.patientName);
  },

  insertVip: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newItem: QueueItem = {
      id: generateId(),
      patientId,
      patientName: patient.name,
      patientLevel: 'vip' as const,
      examItemId,
      examItemName: examItem.name,
      examItemType: examItem.type,
      status: 'waiting',
      priority: 2,
      queueTime: timeStr,
      estimatedTime: 15
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    console.log('[Queue] VIP插队:', patient.name, examItem.name);
  },

  insertUrgent: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newItem: QueueItem = {
      id: generateId(),
      patientId,
      patientName: patient.name,
      patientLevel: 'urgent' as const,
      examItemId,
      examItemName: examItem.name,
      examItemType: examItem.type,
      status: 'waiting',
      priority: 1,
      queueTime: timeStr,
      estimatedTime: 5
    };

    const callingItem = queue.find(item => item.status === 'calling');
    const newQueue = callingItem
      ? [callingItem, newItem, ...queue.filter(item => item.status !== 'calling')]
      : [newItem, ...queue];

    set({ queue: sortQueueByPriority(newQueue) });
    console.log('[Queue] 急检插队:', patient.name, examItem.name);
  },

  resetQuota: (patientId: string) => {
    set(state => ({
      patients: state.patients.map(p =>
        p.id === patientId ? { ...p, remainingQuota: p.totalQuota } : p
      )
    }));
    console.log('[Quota] 重置额度:', patientId);
  },

  useQuota: (patientId: string, amount: number) => {
    const { patients } = get();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return { success: false, paymentType: 'package' as const };

    if (patient.remainingQuota >= amount) {
      set(state => ({
        patients: state.patients.map(p =>
          p.id === patientId ? { ...p, remainingQuota: p.remainingQuota - amount } : p
        )
      }));
      console.log('[Quota] 套餐扣费:', patient.name, amount);
      return { success: true, paymentType: 'package' as const };
    } else {
      console.log('[Quota] 额度不足，转自费:', patient.name, amount);
      return { success: true, paymentType: 'self-pay' as const };
    }
  },

  getWaitingCount: () => {
    return get().queue.filter(item => item.status === 'waiting').length;
  },

  getFastingCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.examItemType === 'fasting').length;
  },

  getVipCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.patientLevel === 'vip').length;
  },

  getUrgentCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.patientLevel === 'urgent').length;
  }
}));
