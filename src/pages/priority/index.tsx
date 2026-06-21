import React, { useState } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import QueueCard from '@/components/QueueCard';
import StatusTag from '@/components/StatusTag';
import { sortQueueByPriority } from '@/utils';

type TabType = 'all' | 'urgent' | 'vip' | 'normal';

const PriorityPage: React.FC = () => {
  const { queue, patients, examItems, insertVip, insertUrgent, getUrgentCount, getVipCount, getWaitingCount } = useQueueStore();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [showInsertPanel, setShowInsertPanel] = useState<'none' | 'vip' | 'urgent'>('none');

  const waitingQueue = sortQueueByPriority(
    queue.filter(item => item.status === 'waiting' || item.status === 'calling')
  );

  const filteredQueue = waitingQueue.filter(item => {
    if (activeTab === 'all') return true;
    return item.patientLevel === activeTab;
  });

  const availablePatients = patients.filter(
    p => !queue.some(q => q.patientId === p.id && (q.status === 'waiting' || q.status === 'calling'))
  );

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleOpenInsert = (type: 'vip' | 'urgent') => {
    setShowInsertPanel(type);
    setSelectedPatientId('');
    setSelectedExamId('');
  };

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
  };

  const handleExamSelect = (examId: string) => {
    setSelectedExamId(examId);
  };

  const handleConfirmInsert = () => {
    if (!selectedPatientId || !selectedExamId) {
      Taro.showToast({ title: '请选择患者和检查项目', icon: 'none' });
      return;
    }

    if (showInsertPanel === 'vip') {
      insertVip(selectedPatientId, selectedExamId);
      Taro.showToast({ title: 'VIP插队成功', icon: 'success' });
    } else if (showInsertPanel === 'urgent') {
      insertUrgent(selectedPatientId, selectedExamId);
      Taro.showToast({ title: '急检插队成功', icon: 'success' });
    }

    setShowInsertPanel('none');
    setSelectedPatientId('');
    setSelectedExamId('');
  };

  const getTabLabel = (tab: TabType) => {
    const labels: Record<TabType, string> = {
      all: '全部',
      urgent: '急检',
      vip: 'VIP',
      normal: '普通'
    };
    return labels[tab];
  };

  const getTabCount = (tab: TabType) => {
    if (tab === 'all') return getWaitingCount();
    if (tab === 'urgent') return getUrgentCount();
    if (tab === 'vip') return getVipCount();
    return getWaitingCount() - getUrgentCount() - getVipCount();
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>快速操作</Text>
        <View className={styles.actionCards}>
          <View
            className={classNames(styles.actionCard, styles.urgent)}
            onClick={() => handleOpenInsert('urgent')}
          >
            <View className={styles.actionIcon}>
              <Text className={styles.actionIconText}>急</Text>
            </View>
            <Text className={styles.actionName}>急检插队</Text>
            <Text className={styles.actionDesc}>最高优先级优先处理</Text>
          </View>
          <View
            className={classNames(styles.actionCard, styles.vip)}
            onClick={() => handleOpenInsert('vip')}
          >
            <View className={styles.actionIcon}>
              <Text className={styles.actionIconText}>V</Text>
            </View>
            <Text className={styles.actionName}>VIP插队</Text>
            <Text className={styles.actionDesc}>贵宾客户优先安排</Text>
          </View>
        </View>
      </View>

      {showInsertPanel !== 'none' && (
        <View className={styles.section}>
          <View className={styles.patientSelect}>
            <Text className={styles.selectTitle}>
              选择{showInsertPanel === 'urgent' ? '急检' : 'VIP'}患者
            </Text>
            <View className={styles.patientOptions}>
              {availablePatients.length > 0 ? (
                availablePatients.map(patient => (
                  <View
                    key={patient.id}
                    className={classNames(
                      styles.patientOption,
                      selectedPatientId === patient.id && styles.selected
                    )}
                    onClick={() => handlePatientSelect(patient.id)}
                  >
                    <View className={styles.patientOptionAvatar}>
                      <Text className={styles.patientOptionAvatarText}>
                        {patient.name.charAt(0)}
                      </Text>
                    </View>
                    <View className={styles.patientOptionInfo}>
                      <Text className={styles.patientOptionName}>{patient.name}</Text>
                      <Text className={styles.patientOptionPackage}>{patient.packageName}</Text>
                    </View>
                    <StatusTag type={patient.level} text={patient.level === 'vip' ? 'VIP' : patient.level === 'urgent' ? '急检' : '普通'} size="sm" />
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: '26rpx', color: '#86909c', textAlign: 'center', padding: '32rpx 0' }}>
                  暂无可添加的患者
                </Text>
              )}
            </View>

            <View className={styles.examSelect}>
              <Text className={styles.selectTitle}>选择检查项目</Text>
              <View className={styles.examGrid}>
                {examItems.map(item => (
                  <View
                    key={item.id}
                    className={classNames(
                      styles.examChip,
                      selectedExamId === item.id && styles.selected,
                      item.type === 'fasting' && selectedExamId === item.id && styles.fasting
                    )}
                    onClick={() => handleExamSelect(item.id)}
                  >
                    {item.name}
                    {item.type === 'fasting' && ' · 空腹'}
                  </View>
                ))}
              </View>
            </View>

            <Button
              className={classNames(
                styles.confirmBtn,
                showInsertPanel === 'urgent' && styles.urgent,
                showInsertPanel === 'vip' && styles.vip,
                (!selectedPatientId || !selectedExamId) && styles.disabled
              )}
              onClick={handleConfirmInsert}
            >
              确认插队
            </Button>
          </View>
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>优先级队列</Text>

        <View className={styles.priorityLegend}>
          <View className={styles.legendItem}>
            <View className={styles.legendDot} style={{ background: '#f53f3f' }} />
            <Text className={styles.legendText}>急检 P1</Text>
          </View>
          <View className={styles.legendItem}>
            <View className={styles.legendDot} style={{ background: '#ffb100' }} />
            <Text className={styles.legendText}>VIP P2</Text>
          </View>
          <View className={styles.legendItem}>
            <View className={styles.legendDot} style={{ background: '#4e5969' }} />
            <Text className={styles.legendText}>普通 P3</Text>
          </View>
          <View className={styles.legendItem}>
            <View className={styles.legendDot} style={{ background: '#ff7d00' }} />
            <Text className={styles.legendText}>空腹优先</Text>
          </View>
        </View>

        <View className={styles.tabs}>
          {(['all', 'urgent', 'vip', 'normal'] as TabType[]).map(tab => (
            <View
              key={tab}
              className={classNames(styles.tabItem, activeTab === tab && styles.active)}
              onClick={() => handleTabChange(tab)}
            >
              {getTabLabel(tab)} ({getTabCount(tab)})
            </View>
          ))}
        </View>

        <View className={styles.queueList}>
          <View className={styles.listTitle}>
            <Text className={styles.listName}>{getTabLabel(activeTab)}队列</Text>
            <Text className={styles.listCount}>共 {filteredQueue.filter(i => i.status === 'waiting').length} 人</Text>
          </View>

          {filteredQueue.length > 0 ? (
            filteredQueue.map((item, index) => (
              <QueueCard key={item.id} item={item} rank={index + 1} />
            ))
          ) : (
            <View style={{ textAlign: 'center', padding: '80rpx 0' }}>
              <Text style={{ fontSize: '28rpx', color: '#86909c' }}>暂无等待人员</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default PriorityPage;
