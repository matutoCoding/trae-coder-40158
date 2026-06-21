import type { ExamItem, Patient, QueueItem, QuotaRecord, PackageQuota, ExamRoom } from '@/types';

const getTodayStr = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getCurrentPeriod = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const makeTimestamp = (dateStr: string, timeStr: string): number => {
  return new Date(`${dateStr}T${timeStr}:00`).getTime();
};

const today = getTodayStr();
const period = getCurrentPeriod();

export const examItems: ExamItem[] = [
  { id: 'item1', name: '血常规', type: 'non-fasting', duration: 10, price: 30 },
  { id: 'item2', name: '肝功能', type: 'fasting', duration: 15, price: 80 },
  { id: 'item3', name: '肾功能', type: 'fasting', duration: 15, price: 60 },
  { id: 'item4', name: '血脂', type: 'fasting', duration: 10, price: 50 },
  { id: 'item5', name: '血糖', type: 'fasting', duration: 5, price: 10 },
  { id: 'item6', name: '心电图', type: 'non-fasting', duration: 10, price: 40 },
  { id: 'item7', name: '胸片', type: 'non-fasting', duration: 5, price: 60 },
  { id: 'item8', name: '腹部B超', type: 'fasting', duration: 15, price: 120 },
  { id: 'item9', name: '甲状腺B超', type: 'non-fasting', duration: 10, price: 100 },
  { id: 'item10', name: '尿常规', type: 'non-fasting', duration: 5, price: 20 }
];

export const patients: Patient[] = [
  {
    id: 'p1',
    name: '张明',
    phone: '138****1234',
    level: 'normal',
    packageName: '基础体检套餐',
    remainingQuota: 500,
    totalQuota: 1000,
    currentExamItemId: 'item2',
    completedItems: ['item1', 'item6'],
    queueNumber: 1001,
    priority: 3
  },
  {
    id: 'p2',
    name: '李娜',
    phone: '139****5678',
    level: 'vip',
    packageName: 'VIP尊享套餐',
    remainingQuota: 2000,
    totalQuota: 3000,
    currentExamItemId: 'item8',
    completedItems: ['item3', 'item5'],
    queueNumber: 1002,
    priority: 2
  },
  {
    id: 'p3',
    name: '王强',
    phone: '137****9012',
    level: 'urgent',
    packageName: '急检套餐',
    remainingQuota: 800,
    totalQuota: 1500,
    currentExamItemId: 'item4',
    completedItems: ['item7'],
    queueNumber: 1003,
    priority: 1
  },
  {
    id: 'p4',
    name: '赵丽',
    phone: '136****3456',
    level: 'normal',
    packageName: '基础体检套餐',
    remainingQuota: 100,
    totalQuota: 1000,
    currentExamItemId: 'item9',
    completedItems: ['item1', 'item2', 'item3', 'item6', 'item7'],
    queueNumber: 1004,
    priority: 3
  },
  {
    id: 'p5',
    name: '刘伟',
    phone: '135****7890',
    level: 'vip',
    packageName: 'VIP尊享套餐',
    remainingQuota: 500,
    totalQuota: 3000,
    currentExamItemId: 'item10',
    completedItems: ['item2', 'item4', 'item8'],
    queueNumber: 1005,
    priority: 2
  },
  {
    id: 'p6',
    name: '陈芳',
    phone: '134****1122',
    level: 'normal',
    packageName: '女性专项套餐',
    remainingQuota: 1200,
    totalQuota: 2000,
    currentExamItemId: 'item3',
    completedItems: ['item1'],
    queueNumber: 1006,
    priority: 3
  },
  {
    id: 'p7',
    name: '孙磊',
    phone: '133****3344',
    level: 'normal',
    packageName: '基础体检套餐',
    remainingQuota: 0,
    totalQuota: 1000,
    currentExamItemId: 'item5',
    completedItems: ['item1', 'item2', 'item3', 'item4', 'item6', 'item7', 'item8'],
    queueNumber: 1007,
    priority: 3
  },
  {
    id: 'p8',
    name: '周静',
    phone: '132****5566',
    level: 'urgent',
    packageName: '急检套餐',
    remainingQuota: 300,
    totalQuota: 1500,
    currentExamItemId: 'item7',
    completedItems: ['item2', 'item5'],
    queueNumber: 1008,
    priority: 1
  }
];

export const initialQueue: QueueItem[] = [
  {
    id: 'q1',
    patientId: 'p3',
    patientName: '王强',
    patientLevel: 'urgent',
    examItemId: 'item4',
    examItemName: '血脂',
    examItemType: 'fasting',
    status: 'calling',
    priority: 1,
    queueTime: '08:30',
    estimatedTime: 10
  },
  {
    id: 'q2',
    patientId: 'p2',
    patientName: '李娜',
    patientLevel: 'vip',
    examItemId: 'item8',
    examItemName: '腹部B超',
    examItemType: 'fasting',
    status: 'waiting',
    priority: 2,
    queueTime: '08:25',
    estimatedTime: 25
  },
  {
    id: 'q3',
    patientId: 'p8',
    patientName: '周静',
    patientLevel: 'urgent',
    examItemId: 'item7',
    examItemName: '胸片',
    examItemType: 'non-fasting',
    status: 'waiting',
    priority: 1,
    queueTime: '08:35',
    estimatedTime: 30
  },
  {
    id: 'q4',
    patientId: 'p5',
    patientName: '刘伟',
    patientLevel: 'vip',
    examItemId: 'item10',
    examItemName: '尿常规',
    examItemType: 'non-fasting',
    status: 'waiting',
    priority: 2,
    queueTime: '08:20',
    estimatedTime: 40
  },
  {
    id: 'q5',
    patientId: 'p1',
    patientName: '张明',
    patientLevel: 'normal',
    examItemId: 'item2',
    examItemName: '肝功能',
    examItemType: 'fasting',
    status: 'waiting',
    priority: 3,
    queueTime: '08:15',
    estimatedTime: 50
  },
  {
    id: 'q6',
    patientId: 'p4',
    patientName: '赵丽',
    patientLevel: 'normal',
    examItemId: 'item9',
    examItemName: '甲状腺B超',
    examItemType: 'non-fasting',
    status: 'waiting',
    priority: 3,
    queueTime: '08:10',
    estimatedTime: 60
  },
  {
    id: 'q7',
    patientId: 'p6',
    patientName: '陈芳',
    patientLevel: 'normal',
    examItemId: 'item3',
    examItemName: '肾功能',
    examItemType: 'fasting',
    status: 'waiting',
    priority: 3,
    queueTime: '08:05',
    estimatedTime: 75
  },
  {
    id: 'q8',
    patientId: 'p7',
    patientName: '孙磊',
    patientLevel: 'normal',
    examItemId: 'item5',
    examItemName: '血糖',
    examItemType: 'fasting',
    status: 'waiting',
    priority: 3,
    queueTime: '08:00',
    estimatedTime: 90
  }
];

export const quotaRecords: QuotaRecord[] = [
  { id: 'r1', patientId: 'p1', patientName: '张明', examItemId: 'item1', examItemName: '血常规', amount: 30, paymentType: 'package', packageAmount: 30, selfPayAmount: 0, date: today, time: '08:10', period, timestamp: makeTimestamp(today, '08:10') },
  { id: 'r2', patientId: 'p1', patientName: '张明', examItemId: 'item6', examItemName: '心电图', amount: 40, paymentType: 'package', packageAmount: 40, selfPayAmount: 0, date: today, time: '08:25', period, timestamp: makeTimestamp(today, '08:25') },
  { id: 'r3', patientId: 'p2', patientName: '李娜', examItemId: 'item3', examItemName: '肾功能', amount: 60, paymentType: 'package', packageAmount: 60, selfPayAmount: 0, date: today, time: '08:15', period, timestamp: makeTimestamp(today, '08:15') },
  { id: 'r4', patientId: 'p2', patientName: '李娜', examItemId: 'item5', examItemName: '血糖', amount: 10, paymentType: 'package', packageAmount: 10, selfPayAmount: 0, date: today, time: '08:30', period, timestamp: makeTimestamp(today, '08:30') },
  { id: 'r5', patientId: 'p3', patientName: '王强', examItemId: 'item7', examItemName: '胸片', amount: 60, paymentType: 'package', packageAmount: 60, selfPayAmount: 0, date: today, time: '08:20', period, timestamp: makeTimestamp(today, '08:20') },
  { id: 'r6', patientId: 'p4', patientName: '赵丽', examItemId: 'item1', examItemName: '血常规', amount: 30, paymentType: 'package', packageAmount: 30, selfPayAmount: 0, date: today, time: '07:50', period, timestamp: makeTimestamp(today, '07:50') },
  { id: 'r7', patientId: 'p4', patientName: '赵丽', examItemId: 'item2', examItemName: '肝功能', amount: 80, paymentType: 'package', packageAmount: 80, selfPayAmount: 0, date: today, time: '08:00', period, timestamp: makeTimestamp(today, '08:00') },
  { id: 'r8', patientId: 'p4', patientName: '赵丽', examItemId: 'item3', examItemName: '肾功能', amount: 60, paymentType: 'package', packageAmount: 60, selfPayAmount: 0, date: today, time: '08:15', period, timestamp: makeTimestamp(today, '08:15') },
  { id: 'r9', patientId: 'p4', patientName: '赵丽', examItemId: 'item6', examItemName: '心电图', amount: 40, paymentType: 'package', packageAmount: 40, selfPayAmount: 0, date: today, time: '08:35', period, timestamp: makeTimestamp(today, '08:35') },
  { id: 'r10', patientId: 'p4', patientName: '赵丽', examItemId: 'item7', examItemName: '胸片', amount: 60, paymentType: 'split', packageAmount: 10, selfPayAmount: 50, date: today, time: '08:45', period, timestamp: makeTimestamp(today, '08:45') },
  { id: 'r11', patientId: 'p7', patientName: '孙磊', examItemId: 'item1', examItemName: '血常规', amount: 30, paymentType: 'package', packageAmount: 30, selfPayAmount: 0, date: today, time: '07:30', period, timestamp: makeTimestamp(today, '07:30') },
  { id: 'r12', patientId: 'p7', patientName: '孙磊', examItemId: 'item2', examItemName: '肝功能', amount: 80, paymentType: 'package', packageAmount: 80, selfPayAmount: 0, date: today, time: '07:45', period, timestamp: makeTimestamp(today, '07:45') },
  { id: 'r13', patientId: 'p7', patientName: '孙磊', examItemId: 'item3', examItemName: '肾功能', amount: 60, paymentType: 'package', packageAmount: 60, selfPayAmount: 0, date: today, time: '08:00', period, timestamp: makeTimestamp(today, '08:00') },
  { id: 'r14', patientId: 'p7', patientName: '孙磊', examItemId: 'item4', examItemName: '血脂', amount: 50, paymentType: 'package', packageAmount: 50, selfPayAmount: 0, date: today, time: '08:15', period, timestamp: makeTimestamp(today, '08:15') },
  { id: 'r15', patientId: 'p7', patientName: '孙磊', examItemId: 'item6', examItemName: '心电图', amount: 40, paymentType: 'package', packageAmount: 40, selfPayAmount: 0, date: today, time: '08:30', period, timestamp: makeTimestamp(today, '08:30') },
  { id: 'r16', patientId: 'p7', patientName: '孙磊', examItemId: 'item7', examItemName: '胸片', amount: 60, paymentType: 'package', packageAmount: 60, selfPayAmount: 0, date: today, time: '08:45', period, timestamp: makeTimestamp(today, '08:45') },
  { id: 'r17', patientId: 'p7', patientName: '孙磊', examItemId: 'item8', examItemName: '腹部B超', amount: 120, paymentType: 'package', packageAmount: 120, selfPayAmount: 0, date: today, time: '09:00', period, timestamp: makeTimestamp(today, '09:00') },
  { id: 'r18', patientId: 'p7', patientName: '孙磊', examItemId: 'item5', examItemName: '血糖', amount: 10, paymentType: 'self-pay', packageAmount: 0, selfPayAmount: 10, date: today, time: '09:15', period, timestamp: makeTimestamp(today, '09:15') },
  { id: 'r19', patientId: 'p5', patientName: '刘伟', examItemId: 'item2', examItemName: '肝功能', amount: 80, paymentType: 'package', packageAmount: 80, selfPayAmount: 0, date: today, time: '08:05', period, timestamp: makeTimestamp(today, '08:05') },
  { id: 'r20', patientId: 'p5', patientName: '刘伟', examItemId: 'item4', examItemName: '血脂', amount: 50, paymentType: 'package', packageAmount: 50, selfPayAmount: 0, date: today, time: '08:20', period, timestamp: makeTimestamp(today, '08:20') },
  { id: 'r21', patientId: 'p5', patientName: '刘伟', examItemId: 'item8', examItemName: '腹部B超', amount: 120, paymentType: 'package', packageAmount: 120, selfPayAmount: 0, date: today, time: '08:40', period, timestamp: makeTimestamp(today, '08:40') },
  { id: 'r22', patientId: 'p6', patientName: '陈芳', examItemId: 'item1', examItemName: '血常规', amount: 30, paymentType: 'package', packageAmount: 30, selfPayAmount: 0, date: today, time: '08:10', period, timestamp: makeTimestamp(today, '08:10') },
  { id: 'r23', patientId: 'p8', patientName: '周静', examItemId: 'item2', examItemName: '肝功能', amount: 80, paymentType: 'package', packageAmount: 80, selfPayAmount: 0, date: today, time: '08:05', period, timestamp: makeTimestamp(today, '08:05') },
  { id: 'r24', patientId: 'p8', patientName: '周静', examItemId: 'item5', examItemName: '血糖', amount: 10, paymentType: 'package', packageAmount: 10, selfPayAmount: 0, date: today, time: '08:25', period, timestamp: makeTimestamp(today, '08:25') }
];

export const packageQuotas: PackageQuota[] = [
  { id: 'pkg1', packageName: '基础体检套餐', totalQuota: 1000, period: '月度', resetDate: '每月1日' },
  { id: 'pkg2', packageName: 'VIP尊享套餐', totalQuota: 3000, period: '月度', resetDate: '每月1日' },
  { id: 'pkg3', packageName: '女性专项套餐', totalQuota: 2000, period: '月度', resetDate: '每月1日' },
  { id: 'pkg4', packageName: '急检套餐', totalQuota: 1500, period: '月度', resetDate: '每月1日' }
];

export const examRooms: ExamRoom[] = [
  { id: 'room1', name: '采血室1', examItemId: 'item1', status: 'busy', currentPatientId: 'p1', currentPatientName: '张明', callTime: Date.now() - 8 * 60 * 1000 },
  { id: 'room2', name: '生化室', examItemId: 'item2', status: 'busy', currentPatientId: 'p3', currentPatientName: '王强', callTime: Date.now() - 5 * 60 * 1000 },
  { id: 'room3', name: 'B超室1', examItemId: 'item8', status: 'busy', currentPatientId: 'p2', currentPatientName: '李娜', callTime: Date.now() - 12 * 60 * 1000 },
  { id: 'room4', name: 'B超室2', examItemId: 'item9', status: 'idle', currentPatientId: null, currentPatientName: null, callTime: null },
  { id: 'room5', name: '心电图室', examItemId: 'item6', status: 'idle', currentPatientId: null, currentPatientName: null, callTime: null },
  { id: 'room6', name: '放射科', examItemId: 'item7', status: 'busy', currentPatientId: 'p8', currentPatientName: '周静', callTime: Date.now() - 3 * 60 * 1000 }
];
