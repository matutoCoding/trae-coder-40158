import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import { formatCurrency } from '@/utils';
import type { DispatchAction } from '@/types';

const ACTION_ICONS: Record<DispatchAction, string> = {
  call: '📣',
  skip: '⏭',
  cancel: '❌',
  transfer: '↔️',
  complete: '✅',
  recall: '🔄',
  add_queue: '➕',
  insert_vip: '💎',
  insert_urgent: '🚨'
};

const ALL_TABS: { key: DispatchAction | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'call', label: '叫号' },
  { key: 'complete', label: '完成' },
  { key: 'skip', label: '跳过' },
  { key: 'cancel', label: '取消' },
  { key: 'transfer', label: '改派' },
  { key: 'recall', label: '叫回' }
];

const DispatchLogPage: React.FC = () => {
  const { getPeriodLogs, getTodayLogs, currentPeriod, quotaRecords } = useQueueStore();

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [activeTab, setActiveTab] = useState<DispatchAction | 'all'>('all');
  const [viewMode, setViewMode] = useState<'today' | 'period'>('today');

  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    periods.add(currentPeriod);
    quotaRecords.forEach(r => periods.add(r.period));
    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  }, [quotaRecords, currentPeriod]);

  const periodLabel = useMemo(() => {
    const [year, month] = selectedPeriod.split('-');
    return `${year}年${parseInt(month)}月`;
  }, [selectedPeriod]);

  const handlePrevMonth = () => {
    const idx = availablePeriods.indexOf(selectedPeriod);
    if (idx < availablePeriods.length - 1) {
      setSelectedPeriod(availablePeriods[idx + 1]);
    } else {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedPeriod(prevPeriod);
    }
  };

  const handleNextMonth = () => {
    const idx = availablePeriods.indexOf(selectedPeriod);
    if (idx > 0) {
      setSelectedPeriod(availablePeriods[idx - 1]);
    }
  };

  const logs = useMemo(() => {
    const raw = viewMode === 'today' ? getTodayLogs() : getPeriodLogs(selectedPeriod);
    if (activeTab === 'all') return raw;
    return raw.filter(l => l.action === activeTab);
  }, [viewMode, selectedPeriod, activeTab, getTodayLogs, getPeriodLogs]);

  const summary = useMemo(() => {
    const base = viewMode === 'today' ? getTodayLogs() : getPeriodLogs(selectedPeriod);
    return {
      total: base.length,
      calls: base.filter(l => l.action === 'call').length,
      completes: base.filter(l => l.action === 'complete').length,
      skips: base.filter(l => l.action === 'skip').length,
      cancels: base.filter(l => l.action === 'cancel').length,
      transfers: base.filter(l => l.action === 'transfer').length,
      recalls: base.filter(l => l.action === 'recall').length
    };
  }, [viewMode, selectedPeriod, getTodayLogs, getPeriodLogs]);

  const getPaymentLabel = (type: string) => {
    switch (type) {
      case 'package': return '套餐';
      case 'self-pay': return '自费';
      case 'split': return '套餐+自费';
      default: return type || '';
    }
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.headerSection}>
        <Text className={styles.headerTitle}>调度流水</Text>
        <Text className={styles.headerSubtitle}>叫号、跳过、完成等操作记录</Text>
      </View>

      <View className={styles.filterSection}>
        <View className={styles.filterCard}>
          <View className={styles.periodNav}>
            <Button
              className={styles.periodArrow}
              onClick={handlePrevMonth}
            >
              ‹
            </Button>
            <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
              <View
                className={classNames(
                  styles.actionTab,
                  viewMode === 'today' && styles.active,
                  styles.all
                )}
                onClick={() => setViewMode('today')}
              >
                今日
              </View>
              <View
                className={classNames(
                  styles.actionTab,
                  viewMode === 'period' && styles.active
                )}
                onClick={() => setViewMode('period')}
              >
                {periodLabel}
              </View>
            </View>
            <Button
              className={classNames(styles.periodArrow, selectedPeriod === currentPeriod && viewMode === 'period' && styles.disabled)}
              onClick={handleNextMonth}
              disabled={selectedPeriod === currentPeriod}
            >
              ›
            </Button>
          </View>

          <View className={styles.actionTabs}>
            {ALL_TABS.map(tab => (
              <View
                key={tab.key}
                className={classNames(
                  styles.actionTab,
                  activeTab === tab.key && styles.active,
                  styles[tab.key]
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </View>
            ))}
          </View>

          <View className={styles.summaryBar}>
            <View className={styles.summaryItem}>
              <Text className={styles.summaryValue}>{summary.total}</Text>
              <Text className={styles.summaryLabel}>总操作</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text className={styles.summaryValue}>{summary.calls}</Text>
              <Text className={styles.summaryLabel}>叫号</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text className={styles.summaryValue}>{summary.completes}</Text>
              <Text className={styles.summaryLabel}>完成</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text className={styles.summaryValue}>{summary.skips}</Text>
              <Text className={styles.summaryLabel}>跳过</Text>
            </View>
          </View>
        </View>
      </View>

      <View className={styles.logList}>
        {logs.length > 0 ? (
          logs.map(log => (
            <View
              key={log.id}
              className={classNames(styles.logCard, styles[log.action])}
            >
              <View className={styles.logHeader}>
                <View className={styles.logAction}>
                  <View className={classNames(styles.logIcon, styles[log.action])}>
                    {ACTION_ICONS[log.action]}
                  </View>
                  <Text className={styles.logActionLabel}>{log.actionLabel}</Text>
                </View>
                <Text className={styles.logTime}>{log.time}</Text>
              </View>

              <View className={styles.logBody}>
                {log.patientName && (
                  <View className={styles.logRow}>
                    <Text className={styles.logLabel}>患者</Text>
                    <Text className={styles.logValue}>{log.patientName}</Text>
                  </View>
                )}
                {log.examItemName && (
                  <View className={styles.logRow}>
                    <Text className={styles.logLabel}>检查项目</Text>
                    <Text className={styles.logValue}>{log.examItemName}</Text>
                  </View>
                )}
                {log.fromRoomName && (
                  <View className={styles.logRow}>
                    <Text className={styles.logLabel}>
                      {log.toRoomName ? '原检查室' : '检查室'}
                    </Text>
                    <Text className={styles.logValue}>{log.fromRoomName}</Text>
                  </View>
                )}
                {log.toRoomName && (
                  <View className={styles.logRow}>
                    <Text className={styles.logLabel}>新检查室</Text>
                    <Text className={styles.logValue}>{log.toRoomName}</Text>
                  </View>
                )}
                {log.amount && (
                  <View className={styles.logRow}>
                    <Text className={styles.logLabel}>金额</Text>
                    <Text className={classNames(styles.logValue, styles.amount)}>
                      {formatCurrency(log.amount)}
                      {log.paymentType && `（${getPaymentLabel(log.paymentType)}）`}
                    </Text>
                  </View>
                )}
                {log.note && (
                  <View className={styles.logNote}>{log.note}</View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View className={styles.emptyState}>
            <View className={styles.emptyIcon}>📋</View>
            <Text className={styles.emptyTitle}>暂无操作记录</Text>
            <Text className={styles.emptySubtitle}>叫号、完成等操作将在此显示</Text>
          </View>
        )}
      </View>

      <View style={{ height: '80rpx' }} />
    </ScrollView>
  );
};

export default DispatchLogPage;
