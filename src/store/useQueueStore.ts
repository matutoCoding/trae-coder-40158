import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type {
  QueueItem,
  Patient,
  QuotaRecord,
  ExamRoom,
  PatientLevel,
  ExamItem,
  SplitDetail,
  ItemLoadStat,
  DispatchLog,
  DispatchAction,
  ExamItemSummary
} from '@/types';
import {
  initialQueue,
  patients as mockPatients,
  quotaRecords as mockRecords,
  examRooms as mockRooms,
  examItems as mockExamItems
} from '@/data/mockData';
import { sortQueueByPriority, generateId } from '@/utils';

const STORAGE_KEY = 'health_check_queue_store_v3';

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

const ACTION_LABELS: Record<DispatchAction, string> = {
  call: '叫号',
  skip: '跳过',
  cancel: '取消检查',
  transfer: '改派检查室',
  complete: '完成结算',
  recall: '重新叫回',
  add_queue: '取号排队',
  insert_vip: 'VIP插队',
  insert_urgent: '急检插队'
};

interface QueueState {
  queue: QueueItem[];
  patients: Patient[];
  quotaRecords: QuotaRecord[];
  examRooms: ExamRoom[];
  examItems: ExamItem[];
  dispatchLogs: DispatchLog[];
  currentPeriod: string;
  isInitialized: boolean;

  initStore: () => void;
  persist: () => void;
  restore: () => boolean;
  checkAndResetPeriod: () => void;
  addDispatchLog: (log: Omit<DispatchLog, 'id' | 'timestamp' | 'date' | 'time' | 'actionLabel'> & { action: DispatchAction }) => void;

  addToQueue: (patientId: string, examItemId: string) => void;
  callNextForRoom: (roomId: string) => QueueItem | null;
  completeExam: (roomId: string) => { success: boolean; record?: QuotaRecord };
  skipCurrent: (roomId: string) => void;
  cancelExam: (roomId: string) => void;
  transferRoom: (fromRoomId: string, toRoomId: string) => boolean;
  recallSkipped: (queueItemId: string, roomId?: string) => boolean;
  returnSkippedToQueue: (queueItemId: string) => boolean;

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
  getAllSkipped: () => QueueItem[];
  hasActiveQueueItem: (patientId: string, examItemId: string) => boolean;
  getTodayLogs: () => DispatchLog[];
  getPeriodLogs: (period?: string) => DispatchLog[];
  getCurrentMonthRecords: () => QuotaRecord[];
  getCurrentMonthTotal: () => number;
  getCurrentMonthPackageTotal: () => number;
  getCurrentMonthSelfPayTotal: () => number;
  getPatientQuotaStatus: (patientId: string) => { remaining: number; total: number; percent: number };
  getPatientMonthBill: (patientId: string, period?: string) => { packageTotal: number; selfPayTotal: number; total: number; completedItems: QuotaRecord[]; remaining: number };
  getItemLoadStats: () => ItemLoadStat[];
  getExamItemSummaries: (period?: string) => ExamItemSummary[];
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: sortQueueByPriority(initialQueue),
  patients: mockPatients,
  quotaRecords: mockRecords,
  examRooms: mockRooms,
  examItems: mockExamItems,
  dispatchLogs: [],
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
    const { queue, patients, quotaRecords, examRooms, dispatchLogs, currentPeriod } = get();
    const data = {
      queue,
      patients,
      quotaRecords,
      examRooms,
      dispatchLogs,
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
          dispatchLogs: data.dispatchLogs || [],
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

  addDispatchLog: (partial) => {
    const now = Date.now();
    const log: DispatchLog = {
      id: generateId(),
      actionLabel: ACTION_LABELS[partial.action],
      timestamp: now,
      date: getTodayStr(),
      time: getNowTimeStr(),
      patientId: null,
      patientName: null,
      examItemId: null,
      examItemName: null,
      fromRoomId: null,
      fromRoomName: null,
      toRoomId: null,
      toRoomName: null,
      amount: null,
      paymentType: null,
      note: null,
      ...partial
    };
    set(state => ({
      dispatchLogs: [log, ...state.dispatchLogs]
    }));
  },

  hasActiveQueueItem: (patientId: string, examItemId: string) => {
    return get().queue.some(
      q => q.patientId === patientId &&
           q.examItemId === examItemId &&
           (q.status === 'waiting' || q.status === 'calling' || q.status === 'skipped')
    );
  },

  addToQueue: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    if (get().hasActiveQueueItem(patientId, examItemId)) {
      return;
    }

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
      estimatedTime: sameItemQueue.length * examItem.duration + examItem.duration,
      skippedFromRoomId: null,
      skippedFromRoomName: null,
      skippedAt: null
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    get().addDispatchLog({
      action: 'add_queue',
      patientId,
      patientName: patient.name,
      examItemId,
      examItemName: examItem.name,
      note: '取号加入等待队列'
    });
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
    get().addDispatchLog({
      action: 'call',
      patientId: nextItem.patientId,
      patientName: nextItem.patientName,
      examItemId: nextItem.examItemId,
      examItemName: nextItem.examItemName,
      toRoomId: roomId,
      toRoomName: room.name,
      note: `${room.name} 叫号`
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

    const existingRecord = quotaRecords.find(
      r => r.patientId === patientId &&
           r.examItemId === examItemId &&
           r.period === currentPeriod &&
           r.roomId === roomId
    );
    if (existingRecord) {
      return { success: false };
    }

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
      timestamp: Date.now(),
      roomId,
      roomName: room.name
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
      if (
        item.patientId === patientId &&
        item.examItemId === examItemId &&
        item.status !== 'completed'
      ) {
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
    get().addDispatchLog({
      action: 'complete',
      patientId,
      patientName: patientName || patient.name,
      examItemId,
      examItemName: examItem.name,
      fromRoomId: roomId,
      fromRoomName: room.name,
      amount: examItem.price,
      paymentType,
      note: `${room.name} 完成结算 ${paymentType === 'split' ? `(套餐${splitDetail.packageAmount}+自费${splitDetail.selfPayAmount})` : paymentType === 'package' ? '套餐支付' : '自费'}`
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

    const now = Date.now();
    let newQueue = [...queue];
    if (callingItem) {
      newQueue = queue.map(item => {
        if (item.id === callingItem.id) {
          return {
            ...item,
            status: 'skipped' as const,
            skippedFromRoomId: roomId,
            skippedFromRoomName: room.name,
            skippedAt: now
          };
        }
        return item;
      });
    } else if (room.currentPatientId) {
      const patient = get().patients.find(p => p.id === room.currentPatientId);
      const examItem = get().examItems.find(e => e.id === room.examItemId);
      if (patient && examItem) {
        const priorityMap: Record<PatientLevel, number> = {
          normal: 3,
          vip: 2,
          urgent: 1
        };
        const newSkippedItem: QueueItem = {
          id: generateId(),
          patientId: patient.id,
          patientName: patient.name,
          patientLevel: patient.level,
          examItemId: examItem.id,
          examItemName: examItem.name,
          examItemType: examItem.type,
          status: 'skipped',
          priority: priorityMap[patient.level],
          queueTime: getNowTimeStr(),
          estimatedTime: examItem.duration,
          skippedFromRoomId: roomId,
          skippedFromRoomName: room.name,
          skippedAt: now
        };
        newQueue = [...queue, newSkippedItem];
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
      queue: sortQueueByPriority(newQueue),
      examRooms: newRooms
    });
    get().addDispatchLog({
      action: 'skip',
      patientId: room.currentPatientId,
      patientName: room.currentPatientName,
      examItemId: room.examItemId,
      examItemName: get().examItems.find(e => e.id === room.examItemId)?.name || null,
      fromRoomId: roomId,
      fromRoomName: room.name,
      note: `从 ${room.name} 跳过`
    });
    get().persist();
  },

  cancelExam: (roomId: string) => {
    const { queue, examRooms } = get();
    const room = examRooms.find(r => r.id === roomId);
    if (!room || room.status !== 'busy' || !room.currentPatientId) return;

    const patientId = room.currentPatientId;
    const examItemId = room.examItemId;

    if (get().queue.some(
      q => q.patientId === patientId && q.examItemId === examItemId && q.status === 'waiting'
    )) {
      // 如果已经有waiting了，只把calling恢复成waiting就好，下面逻辑会处理
    }

    const callingItem = queue.find(
      q => q.patientId === patientId &&
           q.examItemId === examItemId &&
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
      const patient = get().patients.find(p => p.id === patientId);
      const examItem = get().examItems.find(e => e.id === examItemId);
      if (patient && examItem) {
        const priorityMap: Record<PatientLevel, number> = {
          normal: 3,
          vip: 2,
          urgent: 1
        };
        const hasWaiting = newQueue.some(
          q => q.patientId === patientId && q.examItemId === examItemId && q.status === 'waiting'
        );
        if (!hasWaiting) {
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
            estimatedTime: examItem.duration,
            skippedFromRoomId: null,
            skippedFromRoomName: null,
            skippedAt: null
          };
          newQueue = sortQueueByPriority([...newQueue, newItem]);
        }
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
    get().addDispatchLog({
      action: 'cancel',
      patientId: room.currentPatientId,
      patientName: room.currentPatientName,
      examItemId: room.examItemId,
      examItemName: get().examItems.find(e => e.id === room.examItemId)?.name || null,
      fromRoomId: roomId,
      fromRoomName: room.name,
      note: `${room.name} 取消检查，已返回等待队列`
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
    get().addDispatchLog({
      action: 'transfer',
      patientId: fromRoom.currentPatientId,
      patientName: fromRoom.currentPatientName,
      examItemId: fromRoom.examItemId,
      examItemName: get().examItems.find(e => e.id === fromRoom.examItemId)?.name || null,
      fromRoomId,
      fromRoomName: fromRoom.name,
      toRoomId,
      toRoomName: toRoom.name,
      note: `从 ${fromRoom.name} 改派到 ${toRoom.name}`
    });
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
          return {
            ...item,
            status: 'calling' as const,
            skippedFromRoomId: null,
            skippedFromRoomName: null,
            skippedAt: null
          };
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
      get().addDispatchLog({
        action: 'recall',
        patientId: skippedItem.patientId,
        patientName: skippedItem.patientName,
        examItemId: skippedItem.examItemId,
        examItemName: skippedItem.examItemName,
        toRoomId: roomId,
        toRoomName: room.name,
        note: `重新叫回 ${skippedItem.patientName} 到 ${room.name}`
      });
      get().persist();
      return true;
    }

    return false;
  },

  returnSkippedToQueue: (queueItemId: string): boolean => {
    const { queue } = get();
    const skippedItem = queue.find(q => q.id === queueItemId && q.status === 'skipped');
    if (!skippedItem) return false;

    const hasDuplicate = queue.some(
      q => q.patientId === skippedItem.patientId &&
           q.examItemId === skippedItem.examItemId &&
           q.status === 'waiting'
    );
    if (hasDuplicate) {
      const newQueue = queue.filter(q => q.id !== queueItemId);
      set({ queue: sortQueueByPriority(newQueue) });
      get().persist();
      return true;
    }

    const newQueue = queue.map(item => {
      if (item.id === queueItemId) {
        return {
          ...item,
          status: 'waiting' as const,
          queueTime: getNowTimeStr(),
          skippedFromRoomId: null,
          skippedFromRoomName: null,
          skippedAt: null
        };
      }
      return item;
    });

    set({ queue: sortQueueByPriority(newQueue) });
    get().addDispatchLog({
      action: 'recall',
      patientId: skippedItem.patientId,
      patientName: skippedItem.patientName,
      examItemId: skippedItem.examItemId,
      examItemName: skippedItem.examItemName,
      note: `${skippedItem.patientName} 退回普通等待队列`
    });
    get().persist();
    return true;
  },

  insertVip: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    if (get().hasActiveQueueItem(patientId, examItemId)) {
      return;
    }

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
        : examItem.duration,
      skippedFromRoomId: null,
      skippedFromRoomName: null,
      skippedAt: null
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    get().addDispatchLog({
      action: 'insert_vip',
      patientId,
      patientName: patient.name,
      examItemId,
      examItemName: examItem.name,
      note: 'VIP 插队加入队列'
    });
    get().persist();
  },

  insertUrgent: (patientId: string, examItemId: string) => {
    const { patients, examItems, queue } = get();
    const patient = patients.find(p => p.id === patientId);
    const examItem = examItems.find(e => e.id === examItemId);
    if (!patient || !examItem) return;

    if (get().hasActiveQueueItem(patientId, examItemId)) {
      return;
    }

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
      estimatedTime: examItem.duration,
      skippedFromRoomId: null,
      skippedFromRoomName: null,
      skippedAt: null
    };

    const newQueue = sortQueueByPriority([...queue, newItem]);
    set({ queue: newQueue });
    get().addDispatchLog({
      action: 'insert_urgent',
      patientId,
      patientName: patient.name,
      examItemId,
      examItemName: examItem.name,
      note: '急检插队加入队列'
    });
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

  getFastingCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.examItemType === 'fasting').length;
  },

  getVipCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.patientLevel === 'vip').length;
  },

  getUrgentCount: () => {
    return get().queue.filter(item => item.status === 'waiting' && item.patientLevel === 'urgent').length;
  },

  getSkippedByExamItem: (examItemId: string) => {
    return get().queue.filter(
      item => item.examItemId === examItemId && item.status === 'skipped'
    );
  },

  getAllSkipped: () => {
    return get().queue.filter(item => item.status === 'skipped');
  },

  getTodayLogs: () => {
    const today = getTodayStr();
    return get().dispatchLogs.filter(l => l.date === today).sort((a, b) => b.timestamp - a.timestamp);
  },

  getPeriodLogs: (period?: string) => {
    const target = period || get().currentPeriod;
    return get().dispatchLogs
      .filter(l => l.date.startsWith(target))
      .sort((a, b) => b.timestamp - a.timestamp);
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
  },

  getExamItemSummaries: (period?: string): ExamItemSummary[] => {
    const target = period || get().currentPeriod;
    const records = get().quotaRecords.filter(r => r.period === target);
    const { examItems } = get();

    const summaryMap = new Map<string, ExamItemSummary>();

    for (const item of examItems) {
      summaryMap.set(item.id, {
        examItemId: item.id,
        examItemName: item.name,
        patientCount: 0,
        packageTotal: 0,
        selfPayTotal: 0,
        totalAmount: 0,
        records: []
      });
    }

    const patientItemSet = new Set<string>();
    for (const r of records) {
      let summary = summaryMap.get(r.examItemId);
      if (!summary) {
        summary = {
          examItemId: r.examItemId,
          examItemName: r.examItemName,
          patientCount: 0,
          packageTotal: 0,
          selfPayTotal: 0,
          totalAmount: 0,
          records: []
        };
        summaryMap.set(r.examItemId, summary);
      }
      summary.packageTotal += r.packageAmount;
      summary.selfPayTotal += r.selfPayAmount;
      summary.totalAmount += r.amount;
      summary.records.push(r);

      const key = `${r.patientId}_${r.examItemId}`;
      if (!patientItemSet.has(key)) {
        patientItemSet.add(key);
        summary.patientCount += 1;
      }
    }

    return Array.from(summaryMap.values())
      .filter(s => s.records.length > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }
}));
