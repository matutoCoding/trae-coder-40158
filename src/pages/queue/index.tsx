import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import QueueCard from '@/components/QueueCard';
import StatusTag from '@/components/StatusTag';
import { sortQueueByPriority, formatCurrency } from '@/utils';
import dayjs from 'dayjs';

const QueuePage: React.FC = () => {
  const {
    queue,
    examRooms,
    examItems,
    getWaitingCount,
    getFastingCount,
    getVipCount,
    getUrgentCount,
    getIdleRooms,
    getBusyRooms,
    getWaitingByExamItem,
    callNextForRoom,
    completeExam,
    skipCurrent,
    addToQueue,
    patients,
    getCurrentMonthTotal
  } = useQueueStore();

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const waitingQueue = sortQueueByPriority(
    queue.filter(item => item.status === 'waiting')
  );

  const busyRooms = getBusyRooms();
  const idleRooms = getIdleRooms();

  const handleCallForRoom = (roomId: string) => {
    const room = examRooms.find(r => r.id === roomId);
    const result = callNextForRoom(roomId);
    if (result) {
      Taro.showToast({
        title: `叫号: ${result.patientName}`,
        icon: 'success'
      });
    } else {
      const waitingCount = getWaitingByExamItem(room?.examItemId || '').length;
      Taro.showToast({
        title: waitingCount > 0 ? '检查室忙碌中' : '该项目无等待者',
        icon: 'none'
      });
    }
  };

  const handleComplete = (roomId: string) => {
    const room = examRooms.find(r => r.id === roomId);
    completeExam(roomId);
    Taro.showToast({
      title: `${room?.name} 已完成`,
      icon: 'success'
    });
  };

  const handleSkip = (roomId: string) => {
    skipCurrent(roomId);
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
    }, 800);
  };

  useEffect(() => {
    if (idleRooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(idleRooms[0].id);
    }
  }, [idleRooms, selectedRoomId]);

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

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>检查室状态</Text>
          <Text className={styles.sectionSubtitle}>
            空闲 {idleRooms.length} / 忙碌 {busyRooms.length}
          </Text>
        </View>

        <View className={styles.roomGrid}>
          {examRooms.map(room => {
            const isBusy = room.status === 'busy';
            const waitingCount = getWaitingByExamItem(room.examItemId).length;

            return (
              <View
                key={room.id}
                className={classNames(styles.roomCard, isBusy && styles.roomBusy)}
              >
                <View className={styles.roomHeader}>
                  <Text className={styles.roomName}>{room.name}</Text>
                  <StatusTag
                    type={isBusy ? 'calling' : 'completed'}
                    text={isBusy ? '检查中' : '空闲'}
                    size="sm"
                  />
                </View>

                <View className={styles.roomItem}>
                  <Text className={styles.roomItemLabel}>检查项目</Text>
                  <Text className={styles.roomItemValue}>
                    {examItems.find(e => e.id === room.examItemId)?.name}
                  </Text>
                </View>

                {isBusy && room.currentPatientName ? (
                  <View className={styles.roomPatient}>
                    <View className={styles.roomPatientAvatar}>
                      <Text className={styles.roomPatientAvatarText}>
                        {room.currentPatientName.charAt(0)}
                      </Text>
                    </View>
                    <View className={styles.roomPatientInfo}>
                      <Text className={styles.roomPatientName}>{room.currentPatientName}</Text>
                      <Text className={styles.roomPatientStatus}>正在检查中...</Text>
                    </View>
                  </View>
                ) : (
                  <View className={styles.roomPatient}>
                    <View className={classNames(styles.roomPatientAvatar, styles.roomPatientAvatarIdle)}>
                      <Text className={styles.roomPatientAvatarText}>空</Text>
                    </View>
                    <View className={styles.roomPatientInfo}>
                      <Text className={styles.roomPatientIdleText}>等待叫号</Text>
                      <Text className={styles.roomPatientIdleSub}>
                        等待 {waitingCount} 人
                      </Text>
                    </View>
                  </View>
                )}

                <View className={styles.roomActions}>
                  {isBusy ? (
                    <>
                      <Button
                        className={classNames(styles.roomBtn, styles.roomBtnSuccess)}
                        onClick={() => handleComplete(room.id)}
                      >
                        完成
                      </Button>
                      <Button
                        className={classNames(styles.roomBtn, styles.roomBtnOutline)}
                        onClick={() => handleSkip(room.id)}
                      >
                        跳过
                      </Button>
                    </>
                  ) : (
                    <Button
                      className={classNames(styles.roomBtn, styles.roomBtnPrimary)}
                      onClick={() => handleCallForRoom(room.id)}
                      disabled={waitingCount === 0}
                    >
                      {waitingCount > 0 ? '叫下一位' : '暂无等待'}
                    </Button>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>全部等待队列</Text>
          <Text className={styles.sectionCount}>共 {getWaitingCount()} 人</Text>
        </View>

        {waitingQueue.length > 0 ? (
          waitingQueue.map((item, index) => (
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
      </View>
    </ScrollView>
  );
};

export default QueuePage;
