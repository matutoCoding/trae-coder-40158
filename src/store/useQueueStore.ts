import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { QueueItem, Patient, QuotaRecord, ExamRoom, PatientLevel, ExamItem, SplitDetail, ItemLoadStat } from '@/types';
import { initialQueue, patients as mockPatients, quotaRecords as mockRecords, examRooms as mockRooms, examItems as mockExamItems } from '@/data/mockData';
import { sortQueueByPriority, generateId } from '@/utils';

const STORAGE_KEY = 'health_check_queue_store_v2';

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
  completeExam: (roomId: string) => { success: boolean; record?: QuotaRecord };
  skipCurrent: (roomId: string) => void;
  cancelExam: (roomId: string) => void;
  transferRoom: (fromRoomId: string, toRoomId: string) => boolean;
  recallSkipped: (queueItemId: string, roomId?: string) => boolean;

  insertVip: (patientId: string, examItemId: string) => void;
  insertUrgent: (patientId: string, examItemId: string) => void;

  resetQuota: (patientId: string) => void;
  resetAllQuota: () => void;
  useQuota: (patientId: string, amount: number) => { success: boolean; paymentType: 'package' | 'self-pay' | 'split'; splitDetail: SplitDetail };

  getWaitingCount: () => number;
  getWaitingByExamItem: (examItemId: string) => QueueItem[];
  getCurrentCallingByRoom: (roomId: string) => QueueItem | null;
  getIdleRooms: () => ExamRoom[];
  getBusyRooms: () => ExamRoom[];
  getRoomsByExamItem: (examItemId: string) => ExamRoom[];
  getFastingCount: () => number;
  getVipCount: () => number;
  getUrgentCount: () => number;
  getSkippedByExamItem: (examItemId: string) => QueueItem[];
  getCurrentMonthRecords: () => QuotaRecord[];
  getCurrentMonthTotal: () => number;
  getCurrentMonthPackageTotal: () => number;
  getCurrentMonthSelfPayTotal: () => number;
  getPatientQuotaStatus: (patientId: string) => { remaining: number; total: number; percent: number };
  getPatientMonthBill: (patientId: string, period?: string) => { packageTotal: number; selfPayTotal: number; total: number; completedItems: QuotaRecord[]; remaining: number };
  getItemLoadStats: () => ItemLoadStat[];
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
    } catch (e) {
      console.error('[Store] persist error:', e);
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
        return true;
      }
    } catch (e) {
      console.error('[Store] restore error:', e);
    }
    return false;
  },

  checkAndResetPeriod: () => {
    const { currentPeriod, patients, quotaRecords } = get();
    const newPeriod = getCurrentPeriod();

    if (currentPeriod !== newPeriod) {
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
  },

  callNextForRoom: (roomId: string): QueueItem | null => {
    const { queue, examRooms } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room) return null;

    if (room.status === 'busy') return null;

    const waitingForItem = sortQueueByPriority(
      queue.filter(q => q.examItemId === room.examItemId && q.status === 'waiting')
    );

    if (waitingForItem.length === 0) return null;

    const nextItem = waitingForItem[0];
    const now = Date.now();

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
          currentPatientName: nextItem.patientName,
          callTime: now
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

    return callingItem;
  },

  completeExam: (roomId: string) => {
    const { queue, examRooms, patients, examItems, currentPeriod, quotaRecords } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || room.status !== 'busy' || !room.currentPatientId) {
      return { success: false };
    }

    const patientId = room.currentPatientId;
    const patientName = room.currentPatientName;
    const examItemId = room.examItemId;
    const examItem = examItems.find(e => e.id === examItemId);
    if (!examItem) return { success: false };

    const patient = patients.find(p => p.id === patientId);
    if (!patient) return { success: false };

    const { paymentType, splitDetail } = get().useQuota(patientId, examItem.price);
    const updatedPatients = get().patients;

    const recordBase = {
      id: generateId(),
      patientId,
      patientName: patientName || patient.name,
      examItemId,
      examItemName: examItem.name,
      date: getTodayStr(),
      time: getNowTimeStr(),
      period: currentPeriod,
      timestamp: Date.now()
    };

    let newRecord: QuotaRecord;
    if (paymentType === 'split') {
      newRecord = {
        ...recordBase,
        amount: examItem.price,
        paymentType: 'split',
        packageAmount: splitDetail.packageAmount,
        selfPayAmount: splitDetail.selfPayAmount
      };
    } else {
      newRecord = {
        ...recordBase,
        amount: examItem.price,
        paymentType,
        packageAmount: paymentType === 'package' ? examItem.price : 0,
        selfPayAmount: paymentType === 'self-pay' ? examItem.price : 0
      };
    }

    const callingItem = queue.find(
      q => q.patientId === patientId &&
           q.examItemId === examItemId &&
           q.status === 'calling'
    );

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
          currentPatientName: null,
          callTime: null
        };
      }
      return r;
    });

    set({
      queue: sortQueueByPriority(newQueue),
      examRooms: newRooms,
      patients: updatedPatients,
      quotaRecords: [newRecord, ...quotaRecords]
    });
    get().persist();

    return { success: true, record: newRecord };
  },

  skipCurrent: (roomId: string) => {
    const { queue, examRooms } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || room.status !== 'busy') return;

    const callingItem = queue.find(
      q => q.patientId === room.currentPatientId &&
           q.examItemId === room.examItemId &&
           q.status === 'calling'
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
          currentPatientName: null,
          callTime: null
        };
      }
      return r;
    });

    set({
      queue: sortQueueByPriority(newQueue),
      examRooms: newRooms
    });
    get().persist();
  },

  cancelExam: (roomId: string) => {
    const { queue, examRooms } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || room.status !== 'busy' || !room.currentPatientId) return;

    const callingItem = queue.find(
      q => q.patientId === room.currentPatientId &&
           q.examItemId === room.examItemId &&
           q.status === 'calling'
    );

    let newQueue = [...queue];
    if (callingItem) {
      newQueue = queue.map(item => {
        if (item.id === callingItem.id) {
          return { ...item, status: 'waiting' as const };
        }
        return item;
      });
    } else {
      const patient = get().patients.find(p => p.id === room.currentPatientId);
      const examItem = get().examItems.find(e => e.id === room.examItemId);
      if (patient && examItem) {
        const priorityMap: Record<PatientLevel, number> = {
          normal: 3,
          vip: 2,
          urgent: 1
        };
        const newItem: QueueItem = {
          id: generateId(),
          patientId: patient.id,
          patientName: patient.name,
          patientLevel: patient.level,
          examItemId: examItem.id,
          examItemName: examItem.name,
          examItemType: examItem.type,
          status: 'waiting',
          priority: priorityMap[patient.level],
          queueTime: getNowTimeStr(),
          estimatedTime: examItem.duration
        };
        newQueue = sortQueueByPriority([...queue, newItem]);
      }
    }

    const newRooms = examRooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: 'idle' as const,
          currentPatientId: null,
          currentPatientName: null,
          callTime: null
        };
      }
      return r;
    });

    set({
      queue: newQueue,
      examRooms: newRooms
    });
    get().persist();
  },

  transferRoom: (fromRoomId: string, toRoomId: string): boolean => {
    const { examRooms } = get();
    const fromRoom = examRooms.find(r => r.id === fromRoomId);
    const toRoom = examRooms.find(r => r.id === toRoomId);

    if (!fromRoom || !toRoom) return false;
    if (fromRoom.status !== 'busy' || toRoom.status !== 'idle') return false;
    if (fromRoom.examItemId !== toRoom.examItemId) return false;

    const newRooms = examRooms.map(r => {
      if (r.id === fromRoomId) {
        return {
          ...r,
          status: 'idle' as const,
          currentPatientId: null,
          currentPatientName: null,
          callTime: null
        };
      }
      if (r.id === toRoomId) {
        return {
          ...r,
          status: 'busy' as const,
          currentPatientId: fromRoom.currentPatientId,
          currentPatientName: fromRoom.currentPatientName,
          callTime: fromRoom.callTime
        };
      }
      return r;
    });

    set({ examRooms: newRooms });
    get().persist();
    return true;
  },

  recallSkipped: (queueItemId: string, roomId?: string): boolean => {
    const { queue, examRooms } = get();
    const skippedItem = queue.find(q => q.id === queueItemId && q.status === 'skipped');
    if (!skippedItem) return false;

    if (roomId) {
      const room = examRooms.find(r => r.id === roomId);
      if (!room || room.status !== 'idle' || room.examItemId !== skippedItem.examItemId) {
        return false;
      }

      const newQueue = queue.map(item => {
        if (item.id === queueItemId) {
          return { ...item, status: 'calling' as const };
        }
        return item;
      });

      const newRooms = examRooms.map(r => {
        if (r.id === roomId) {
          return {
            ...r,
            status: 'busy' as const,
            currentPatientId: skippedItem.patientId,
            currentPatientName: skippedItem.patientName,
            callTime: Date.now()
          };
        }
        return r;
      });

      set({
        queue: sortQueueByPriority(newQueue),
        examRooms: newRooms
      });
      get().persist();
      return true;
    }

    const newQueue = queue.map(item => {
      if (item.id === queueItemId) {
        return { ...item, status: 'waiting' as const };
      }
      return item;
    });

    set({ queue: sortQueueByPriority(newQueue) });
    get().persist();
    return true;
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
  },

  resetQuota: (patientId: string) => {
    set(state => ({
      patients: state.patients.map(p =>
        p.id === patientId ? { ...p, remainingQuota: p.totalQuota } : p
      )
    }));
    get().persist();
  },

  resetAllQuota: () => {
    set(state => ({
      patients: state.patients.map(p => ({
        ...p,
        remainingQuota: p.totalQuota
      }))
    }));
    get().persist();
  },

  useQuota: (patientId: string, amount: number) => {
    const { patients } = get();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return { success: false, paymentType: 'package' as const, splitDetail: { packageAmount: 0, selfPayAmount: 0 } };

    const remaining = patient.remainingQuota;

    if (remaining >= amount) {
      set(state => ({
        patients: state.patients.map(p =>
          p.id === patientId ? { ...p, remainingQuota: p.remainingQuota - amount } : p
        )
      }));
      return {
        success: true,
        paymentType: 'package' as const,
        splitDetail: { packageAmount: amount, selfPayAmount: 0 }
      };
    }

    if (remaining > 0) {
      const selfPayAmount = amount - remaining;
      set(state => ({
        patients: state.patients.map(p =>
          p.id === patientId ? { ...p, remainingQuota: 0 } : p
        )
      }));
      return {
        success: true,
        paymentType: 'split' as const,
        splitDetail: { packageAmount: remaining, selfPayAmount }
      };
    }

    return {
      success: true,
      paymentType: 'self-pay' as const,
      splitDetail: { packageAmount: 0, selfPayAmount: amount }
    };
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

  getRoomsByExamItem: (examItemId: string) => {
    return get().examRooms.filter(r => r.examItemId === examItemId);
  },

  getSkippedByExamItem: (examItemId: string) => {
    return get().queue.filter(
      item => item.examItemId === examItemId && item.status === 'skipped'
    );
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
      .reduce((sum, r) => sum + r.packageAmount, 0);
  },

  getCurrentMonthSelfPayTotal: () => {
    return get().getCurrentMonthRecords()
      .reduce((sum, r) => sum + r.selfPayAmount, 0);
  },

  getPatientQuotaStatus: (patientId: string) => {
    const patient = get().patients.find(p => p.id === patientId);
    if (!patient) return { remaining: 0, total: 0, percent: 0 };
    return {
      remaining: patient.remainingQuota,
      total: patient.totalQuota,
      percent: patient.totalQuota > 0 ? (patient.remainingQuota / patient.totalQuota) * 100 : 0
    };
  },

  getPatientMonthBill: (patientId: string, period?: string) => {
    const targetPeriod = period || get().currentPeriod;
    const patient = get().patients.find(p => p.id === patientId);
    const records = get().quotaRecords.filter(r => r.patientId === patientId && r.period === targetPeriod);

    return {
      packageTotal: records.reduce((sum, r) => sum + r.packageAmount, 0),
      selfPayTotal: records.reduce((sum, r) => sum + r.selfPayAmount, 0),
      total: records.reduce((sum, r) => sum + r.amount, 0),
      completedItems: records,
      remaining: patient?.remainingQuota ?? 0
    };
  },

  getItemLoadStats: (): ItemLoadStat[] => {
    const { examItems, examRooms, queue } = get();
    const now = Date.now();

    return examItems.map(item => {
      const rooms = examRooms.filter(r => r.examItemId === item.id);
      const busyRooms = rooms.filter(r => r.status === 'busy');
      const idleRooms = rooms.filter(r => r.status === 'idle');
      const waitingList = sortQueueByPriority(
        queue.filter(q => q.examItemId === item.id && q.status === 'waiting')
      );

      let estimatedWaitMinutes = 0;
      let estimatedFinishTime = '--:--';

      if (waitingList.length > 0 && rooms.length > 0) {
        const waitPerPerson = item.duration / Math.max(1, rooms.length);
        estimatedWaitMinutes = Math.ceil(waitingList.length * waitPerPerson);

        let earliestFreeTime = now;
        if (busyRooms.length > 0) {
          const remainingTimes = busyRooms.map(room => {
            if (!room.callTime) return 0;
            const elapsed = (now - room.callTime) / 60000;
            const remaining = Math.max(0, item.duration - elapsed);
            return remaining;
          });
          earliestFreeTime = now + Math.min(...remainingTimes) * 60000;
        }

        const finishTime = earliestFreeTime + estimatedWaitMinutes * 60000;
        const d = new Date(finishTime);
        estimatedFinishTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      } else if (rooms.length > 0 && idleRooms.length > 0) {
        estimatedFinishTime = '随到随检';
      }

      return {
        examItemId: item.id,
        examItemName: item.name,
        waitingCount: waitingList.length,
        busyRoomCount: busyRooms.length,
        idleRoomCount: idleRooms.length,
        totalRoomCount: rooms.length,
        avgDuration: item.duration,
        estimatedWaitMinutes,
        estimatedFinishTime
      };
    });
  }
}));
