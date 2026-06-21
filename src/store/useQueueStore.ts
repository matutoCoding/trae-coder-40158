import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { QueueItem, Patient, QuotaRecord, ExamRoom, PatientLevel, ExamItem } from '@/types';
import { initialQueue, patients as mockPatients, quotaRecords as mockRecords, examRooms as mockRooms, examItems as mockExamItems } from '@/data/mockData';
import { sortQueueByPriority, generateId } from '@/utils';

const STORAGE_KEY = 'health_check_queue_store_v1';

const getCurrentPeriod = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getTodayStr = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getNowTimeStr = (): string => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

interface QueueState {
  queue: QueueItem[];
  patients: Patient[];
  quotaRecords: QuotaRecord[];
  examRooms: ExamRoom[];
  examItems: ExamItem[];
  currentPeriod: string;
  isInitialized: boolean;

  initStore: () => void;
  persist: () => void;
  restore: () => boolean;
  checkAndResetPeriod: () => void;

  addToQueue: (patientId: string, examItemId: string) => void;
  callNextForRoom: (roomId: string) => QueueItem | null;
  completeExam: (roomId: string) => void;
  skipCurrent: (roomId: string) => void;

  insertVip: (patientId: string, examItemId: string) => void;
  insertUrgent: (patientId: string, examItemId: string) => void;

  resetQuota: (patientId: string) => void;
  resetAllQuota: () => void;
  useQuota: (patientId: string, amount: number) => { success: boolean; paymentType: 'package' | 'self-pay' };

  getWaitingCount: () => number;
  getWaitingByExamItem: (examItemId: string) => QueueItem[];
  getCurrentCallingByRoom: (roomId: string) => QueueItem | null;
  getIdleRooms: () => ExamRoom[];
  getBusyRooms: () => ExamRoom[];
  getFastingCount: () => number;
  getVipCount: () => number;
  getUrgentCount: () => number;
  getCurrentMonthRecords: () => QuotaRecord[];
  getCurrentMonthTotal: () => number;
  getCurrentMonthPackageTotal: () => number;
  getCurrentMonthSelfPayTotal: () => number;
  getPatientQuotaStatus: (patientId: string) => { remaining: number; total: number; percent: number };
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: sortQueueByPriority(initialQueue),
  patients: mockPatients,
  quotaRecords: mockRecords,
  examRooms: mockRooms,
  examItems: mockExamItems,
  currentPeriod: getCurrentPeriod(),
  isInitialized: false,

  initStore: () => {
    if (get().isInitialized) return;

    const restored = get().restore();
    if (!restored) {
      get().persist();
    }

    get().checkAndResetPeriod();
    set({ isInitialized: true });
    console.log('[Store] 初始化完成, 当前周期:', get().currentPeriod);
  },

  persist: () => {
    const { queue, patients, quotaRecords, examRooms, currentPeriod } = get();
    const data = {
      queue,
      patients,
      quotaRecords,
      examRooms,
      currentPeriod,
      savedAt: Date.now()
    };
    try {
      Taro.setStorageSync(STORAGE_KEY, data);
      console.log('[Store] 数据已持久化');
    } catch (e) {
      console.error('[Store] 持久化失败:', e);
    }
  },

  restore: (): boolean => {
    try {
      const data = Taro.getStorageSync(STORAGE_KEY);
      if (data && data.queue && data.patients) {
        set({
          queue: data.queue || [],
          patients: data.patients || [],
          quotaRecords: data.quotaRecords || [],
          examRooms: data.examRooms || mockRooms,
          currentPeriod: data.currentPeriod || getCurrentPeriod()
        });
        console.log('[Store] 数据已从本地存储恢复');
        return true;
      }
    } catch (e) {
      console.error('[Store] 恢复数据失败:', e);
    }
    return false;
  },

  checkAndResetPeriod: () => {
    const { currentPeriod, patients, quotaRecords } = get();
    const newPeriod = getCurrentPeriod();

    if (currentPeriod !== newPeriod) {
      console.log(`[Store] 周期变更: ${currentPeriod} -> ${newPeriod}, 开始重置额度`);

      const resetPatients = patients.map(p => ({
        ...p,
        remainingQuota: p.totalQuota
      }));

      const newRecords = quotaRecords.filter(r => {
        const recordDate = new Date(r.date);
        const periodDate = new Date(newPeriod + '-01');
        return recordDate >= periodDate;
      });

      set({
        patients: resetPatients,
        currentPeriod: newPeriod,
        quotaRecords: newRecords.length > 0 ? newRecords : quotaRecords
      });

      get().persist();
      console.log('[Store] 新周期额度已重置');
    }
  },

  addToQueue: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    const priorityMap: Record<PatientLevel, number> = {
      normal: 3,
      vip: 2,
      urgent: 1
    };

    const sameItemQueue = queue.filter(
      q => q.examItemId === examItemId && q.status === 'waiting'
    );

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
      queueTime: getNowTimeStr(),
      estimatedTime: sameItemQueue.length * examItem.duration + examItem.duration
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    get().persist();
    console.log('[Queue] 添加排队:', patient.name, examItem.name);
  },

  callNextForRoom: (roomId: string): QueueItem | null => {
    const { queue, examRooms } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room) return null;

    if (room.status === 'busy') {
      console.log('[Queue] 检查室忙碌中:', room.name);
      return null;
    }

    const waitingForItem = sortQueueByPriority(
      queue.filter(q => q.examItemId === room.examItemId && q.status === 'waiting')
    );

    if (waitingForItem.length === 0) {
      console.log('[Queue] 该项目无等待患者:', room.examItemId);
      return null;
    }

    const nextItem = waitingForItem[0];

    const newQueue = queue.map(item => {
      if (item.id === nextItem.id) {
        return { ...item, status: 'calling' as const };
      }
      return item;
    });

    const newRooms = examRooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'busy' as const,
          currentPatientId: nextItem.patientId,
          currentPatientName: nextItem.patientName
        };
      }
      return r;
    });

    const callingItem = { ...nextItem, status: 'calling' as const };

    set({
      queue: sortQueueByPriority(newQueue),
      examRooms: newRooms
    });
    get().persist();

    console.log('[Queue] 叫号:', nextItem.patientName, '到', room.name);
    return callingItem;
  },

  completeExam: (roomId: string) => {
    const { queue, examRooms, patients, examItems, currentPeriod } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || room.status !== 'busy') return;

    const callingItem = queue.find(
      q => q.patientId === room.currentPatientId && q.examItemId === room.examItemId && q.status === 'calling'
    );

    let updatedPatients = [...patients];
    let newRecord: QuotaRecord | null = null;

    if (callingItem) {
      const examItem = examItems.find(e => e.id === callingItem.examItemId);
      if (examItem) {
        const patient = patients.find(p => p.id === callingItem.patientId);
        if (patient) {
          const { paymentType } = get().useQuota(callingItem.patientId, examItem.price);
          updatedPatients = get().patients;

          newRecord = {
            id: generateId(),
            patientId: callingItem.patientId,
            patientName: callingItem.patientName,
            examItemId: callingItem.examItemId,
            examItemName: callingItem.examItemName,
            amount: examItem.price,
            paymentType,
            date: getTodayStr(),
            time: getNowTimeStr(),
            period: currentPeriod,
            timestamp: Date.now()
          };
        }
      }
    }

    const newQueue = queue.map(item => {
      if (callingItem && item.id === callingItem.id) {
        return { ...item, status: 'completed' as const };
      }
      return item;
    });

    const newRooms = examRooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'idle' as const,
          currentPatientId: null,
          currentPatientName: null
        };
      }
      return r;
    });

    set({
      queue: sortQueueByPriority(newQueue),
      examRooms: newRooms,
      patients: updatedPatients,
      quotaRecords: newRecord ? [newRecord, ...get().quotaRecords] : get().quotaRecords
    });
    get().persist();

    console.log('[Queue] 完成检查:', room.name, room.currentPatientName);
  },

  skipCurrent: (roomId: string) => {
    const { queue, examRooms } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || room.status !== 'busy') return;

    const callingItem = queue.find(
      q => q.patientId === room.currentPatientId && q.examItemId === room.examItemId && q.status === 'calling'
    );

    let newQueue = [...queue];
    if (callingItem) {
      newQueue = queue.map(item => {
        if (item.id === callingItem.id) {
          return { ...item, status: 'skipped' as const };
        }
        return item;
      });
    }

    const newRooms = examRooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'idle' as const,
          currentPatientId: null,
          currentPatientName: null
        };
      }
      return r;
    });

    set({
      queue: sortQueueByPriority(newQueue),
      examRooms: newRooms
    });
    get().persist();

    console.log('[Queue] 跳过:', room.name, room.currentPatientName);
  },

  insertVip: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    const sameItemWaiting = queue.filter(
      q => q.examItemId === examItemId && q.status === 'waiting'
    );

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
      queueTime: getNowTimeStr(),
      estimatedTime: sameItemWaiting.length > 0
        ? Math.ceil(sameItemWaiting.filter(q => q.priority <= 2).length * examItem.duration)
        : examItem.duration
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    get().persist();
    console.log('[Queue] VIP插队:', patient.name, examItem.name);
  },

  insertUrgent: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

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
      queueTime: getNowTimeStr(),
      estimatedTime: examItem.duration
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    get().persist();
    console.log('[Queue] 急检插队:', patient.name, examItem.name);
  },

  resetQuota: (patientId: string) => {
    set(state => ({
      patients: state.patients.map(p =>
        p.id === patientId ? { ...p, remainingQuota: p.totalQuota } : p
      )
    }));
    get().persist();
    console.log('[Quota] 重置额度:', patientId);
  },

  resetAllQuota: () => {
    set(state => ({
      patients: state.patients.map(p => ({
        ...p,
        remainingQuota: p.totalQuota
      }))
    }));
    get().persist();
    console.log('[Quota] 重置全部额度');
  },

  useQuota: (patientId: string, amount: number) => {
    const { patients } = get();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return { success: false, paymentType: 'package' as const };

    let paymentType: 'package' | 'self-pay' = 'package';

    if (patient.remainingQuota >= amount) {
      set(state => ({
        patients: state.patients.map(p =>
          p.id === patientId ? { ...p, remainingQuota: p.remainingQuota - amount } : p
        )
      }));
      paymentType = 'package';
      console.log('[Quota] 套餐扣费:', patient.name, amount, '剩余:', patient.remainingQuota - amount);
    } else {
      paymentType = 'self-pay';
      console.log('[Quota] 额度不足，转自费:', patient.name, amount, '剩余额度:', patient.remainingQuota);
    }

    return { success: true, paymentType };
  },

  getWaitingCount: () => {
    return get().queue.filter(item => item.status === 'waiting').length;
  },

  getWaitingByExamItem: (examItemId: string) => {
    return sortQueueByPriority(
      get().queue.filter(
        item => item.examItemId === examItemId && item.status === 'waiting'
      )
    );
  },

  getCurrentCallingByRoom: (roomId: string) => {
    const { examRooms, queue } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || !room.currentPatientId) return null;

    return queue.find(
      q => q.patientId === room.currentPatientId &&
           q.examItemId === room.examItemId &&
           q.status === 'calling'
    ) || null;
  },

  getIdleRooms: () => {
    return get().examRooms.filter(r => r.status === 'idle');
  },

  getBusyRooms: () => {
    return get().examRooms.filter(r => r.status === 'busy');
  },

  getFastingCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.examItemType === 'fasting').length;
  },

  getVipCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.patientLevel === 'vip').length;
  },

  getUrgentCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.patientLevel === 'urgent').length;
  },

  getCurrentMonthRecords: () => {
    const period = get().currentPeriod;
    return get().quotaRecords.filter(r => r.period === period);
  },

  getCurrentMonthTotal: () => {
    return get().getCurrentMonthRecords().reduce((sum, r) => sum + r.amount, 0);
  },

  getCurrentMonthPackageTotal: () => {
    return get().getCurrentMonthRecords()
      .filter(r => r.paymentType === 'package')
      .reduce((sum, r) => sum + r.amount, 0);
  },

  getCurrentMonthSelfPayTotal: () => {
    return get().getCurrentMonthRecords()
      .filter(r => r.paymentType === 'self-pay')
      .reduce((sum, r) => sum + r.amount, 0);
  },

  getPatientQuotaStatus: (patientId: string) => {
    const patient = get().patients.find(p => p.id === patientId);
    if (!patient) return { remaining: 0, total: 0, percent: 0 };
    return {
      remaining: patient.remainingQuota,
      total: patient.totalQuota,
      percent: patient.totalQuota > 0 ? (patient.remainingQuota / patient.totalQuota) * 100 : 0
    };
  }
}));
