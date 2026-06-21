import React, { useState } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import QueueCard from '@/components/QueueCard';
import StatusTag from '@/components/StatusTag';
import { sortQueueByPriority } from '@/utils';
import dayjs from 'dayjs';

const QueuePage: React.FC = () => {
  const {
    queue,
    currentCalling,
    getWaitingCount,
    getFastingCount,
    getVipCount,
    getUrgentCount,
    callNext,
    completeCurrent,
    skipCurrent,
    addToQueue,
    patients,
    examItems
  } = useQueueStore();

  const [refreshing, setRefreshing] = useState(false);

  const waitingQueue = sortQueueByPriority(
    queue.filter(item => item.status === 'waiting' || item.status === 'calling')
  );

  const handleCallNext = () => {
    callNext();
    Taro.showToast({ title: '已叫号', icon: 'success' });
  };

  const handleComplete = () => {
    completeCurrent();
    Taro.showToast({ title: '已完成', icon: 'success' });
  };

  const handleSkip = () => {
    skipCurrent();
    Taro.showToast({ title: '已跳过', icon: 'none' });
  };

  const handleTakeNumber = () => {
    const availablePatients = patients.filter(
      p => !queue.some(q => q.patientId === p.id && (q.status === 'waiting' || q.status === 'calling'))
    );
    if (availablePatients.length === 0) {
      Taro.showToast({ title: '暂无可排队患者', icon: 'none' });
      return;
    }
    const randomPatient = availablePatients[Math.floor(Math.random() * availablePatients.length)];
    const randomItem = examItems[Math.floor(Math.random() * examItems.length)];
    addToQueue(randomPatient.id, randomItem.id);
    Taro.showToast({ title: '取号成功', icon: 'success' });
  };

  const handlePullDownRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      Taro.stopPullDownRefresh();
    }, 1000);
  };

  React.useEffect(() => {
    Taro.eventCenter.on('__taroPullDownRefresh', handlePullDownRefresh);
    return () => {
      Taro.eventCenter.off('__taroPullDownRefresh', handlePullDownRefresh);
    };
  }, []);

  const getLevelTagType = (level: string) => {
    switch (level) {
      case 'vip': return 'vip';
      case 'urgent': return 'urgent';
      default: return 'normal';
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'vip': return 'VIP';
      case 'urgent': return '急检';
      default: return '普通';
    }
  };

  return (
    <ScrollView
      className={styles.page}
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handlePullDownRefresh}
    >
      <View className={styles.headerSection}>
        <Text className={styles.headerTitle}>体检排队叫号</Text>
        <Text className={styles.headerSubtitle}>{dayjs().format('YYYY年MM月DD日 dddd')}</Text>
      </View>

      <View className={styles.currentCalling}>
        <Text className={styles.callingLabel}>当前叫号</Text>
        {currentCalling ? (
          <>
            <View className={styles.callingPatient}>
              <View className={styles.callingAvatar}>
                <Text className={styles.callingAvatarText}>{currentCalling.patientName.charAt(0)}</Text>
              </View>
              <View className={styles.callingInfo}>
                <Text className={styles.callingName}>{currentCalling.patientName}</Text>
                <Text className={styles.callingItem}>{currentCalling.examItemName}</Text>
              </View>
            </View>
            <View className={styles.callingTags}>
              <StatusTag type={getLevelTagType(currentCalling.patientLevel)} text={getLevelText(currentCalling.patientLevel)} size="md" />
              {currentCalling.examItemType === 'fasting' && (
                <StatusTag type="fasting" text="空腹项目" size="md" />
              )}
              <StatusTag type="calling" text="叫号中" size="md" />
            </View>
            <View className={styles.callingActions}>
              <Button className={classNames(styles.actionBtn, styles.success)} onClick={handleComplete}>
                完成检查
              </Button>
              <Button className={classNames(styles.actionBtn, styles.warning)} onClick={handleSkip}>
                跳过
              </Button>
            </View>
          </>
        ) : (
          <View style={{ textAlign: 'center', padding: '40rpx 0' }}>
            <Text style={{ fontSize: '28rpx', color: '#86909c' }}>暂无叫号</Text>
          </View>
        )}
      </View>

      <View className={styles.statsSection}>
        <View className={styles.statItem}>
          <Text className={classNames(styles.statValue, styles.primary)}>{getWaitingCount()}</Text>
          <Text className={styles.statLabel}>等待人数</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={classNames(styles.statValue, styles.warning)}>{getFastingCount()}</Text>
          <Text className={styles.statLabel}>空腹项目</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={classNames(styles.statValue, styles.vip)}>{getVipCount()}</Text>
          <Text className={styles.statLabel}>VIP</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={classNames(styles.statValue, styles.error)}>{getUrgentCount()}</Text>
          <Text className={styles.statLabel}>急检</Text>
        </View>
      </View>

      <View className={styles.queueSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>排队列表</Text>
          <Text className={styles.sectionCount}>共 {getWaitingCount()} 人等待</Text>
        </View>

        {waitingQueue.filter(item => item.status === 'waiting').length > 0 ? (
          waitingQueue
            .filter(item => item.status === 'waiting')
            .map((item, index) => (
              <QueueCard key={item.id} item={item} rank={index + 1} />
            ))
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyText}>暂无等待人员</Text>
          </View>
        )}
      </View>

      <View style={{ height: '160rpx' }} />

      <View className={styles.bottomActions}>
        <Button className={styles.takeNumberBtn} onClick={handleTakeNumber}>
          取号排队
        </Button>
        <Button
          className={classNames(styles.actionBtn, styles.primary)}
          style={{ flex: 'none', width: '200rpx' }}
          onClick={handleCallNext}
        >
          下一位
        </Button>
      </View>
    </ScrollView>
  );
};

export default QueuePage;
