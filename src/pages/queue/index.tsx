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
    patients
  } = useQueueStore();

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const waitingQueue = sortQueueByPriority(
    queue.filter(item => item.status === 'waiting')
  );

  const busyRooms = getIdleRooms;
  const idleRooms = getBusyRooms;

  const handleCallForRoom = (roomId: string) => {
    const room = examRooms.find(r => r.id === roomId);
    const result = callNextForRoom(roomId);
    if (result) {
      Taro.showToast({ title: `叫号: ${result.patientName}`, icon: 'success' });
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
    Taro.showToast({ title: `${room?.name} 已完成结算`, icon: 'success' });
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

  const getElapsedMinutes = (callTime: number | null): number => {
    if (!callTime) return 0;
    return Math.floor((now - callTime) / 60000);
  };

  const getEstimatedEndTime = (callTime: number | null, duration: number): string => {
    if (!callTime) return '--:--';
    const endTime = callTime + duration * 60000;
    const d = new Date(endTime);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'vip': return 'VIP';
      case 'urgent': return '急检';
      default: return '';
    }
  };

  return (
    <ScrollView className={styles.page} scrollY>
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
            空闲 {examRooms.filter(r => r.status === 'idle').length} / 忙碌 {examRooms.filter(r => r.status === 'busy').length}
          </Text>
        </View>

        <View className={styles.roomGrid}>
          {examRooms.map(room => {
            const isBusy = room.status === 'busy';
            const waitingList = getWaitingByExamItem(room.examItemId);
            const examItem = examItems.find(e => e.id === room.examItemId);
            const elapsed = getElapsedMinutes(room.callTime);
            const estimatedEnd = getEstimatedEndTime(room.callTime, examItem?.duration || 10);
            const isOverTime = elapsed > (examItem?.duration || 10);

            return (
              <View
                key={room.id}
                className={classNames(styles.roomCard, isBusy && styles.roomBusy, isOverTime && styles.roomOverTime)}
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
                  <Text className={styles.roomItemValue}>{examItem?.name}</Text>
                </View>

                {isBusy && room.currentPatientName ? (
                  <>
                    <View className={styles.roomPatient}>
                      <View className={styles.roomPatientAvatar}>
                        <Text className={styles.roomPatientAvatarText}>
                          {room.currentPatientName.charAt(0)}
                        </Text>
                      </View>
                      <View className={styles.roomPatientInfo}>
                        <Text className={styles.roomPatientName}>{room.currentPatientName}</Text>
                        <Text className={classNames(styles.roomPatientStatus, isOverTime && styles.overtime)}>
                          {isOverTime ? `已超时 ${elapsed - (examItem?.duration || 10)}分钟` : '正在检查中...'}
                        </Text>
                      </View>
                    </View>
                    <View className={styles.roomTimeInfo}>
                      <View className={styles.roomTimeItem}>
                        <Text className={styles.roomTimeLabel}>已用时</Text>
                        <Text className={classNames(styles.roomTimeValue, isOverTime && styles.overtime)}>
                          {elapsed}分钟
                        </Text>
                      </View>
                      <View className={styles.roomTimeItem}>
                        <Text className={styles.roomTimeLabel}>预计结束</Text>
                        <Text className={styles.roomTimeValue}>{estimatedEnd}</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View className={styles.roomPatient}>
                    <View className={classNames(styles.roomPatientAvatar, styles.roomPatientAvatarIdle)}>
                      <Text className={styles.roomPatientAvatarText}>空</Text>
                    </View>
                    <View className={styles.roomPatientInfo}>
                      <Text className={styles.roomPatientIdleText}>等待叫号</Text>
                      <Text className={styles.roomPatientIdleSub}>
                        等待 {waitingList.length} 人
                      </Text>
                    </View>
                  </View>
                )}

                {waitingList.length > 0 && (
                  <View className={styles.roomWaitingList}>
                    <Text className={styles.roomWaitingTitle}>后续等待</Text>
                    {waitingList.slice(0, 3).map((item, idx) => (
                      <View key={item.id} className={styles.roomWaitingItem}>
                        <Text className={styles.roomWaitingRank}>{idx + 1}</Text>
                        <Text className={styles.roomWaitingName}>{item.patientName}</Text>
                        {item.patientLevel !== 'normal' && (
                          <Text className={classNames(
                            styles.roomWaitingLevel,
                            item.patientLevel === 'urgent' && styles.urgent,
                            item.patientLevel === 'vip' && styles.vip
                          )}>
                            {getLevelText(item.patientLevel)}
                          </Text>
                        )}
                        {item.examItemType === 'fasting' && (
                          <Text className={styles.roomWaitingFasting}>空腹</Text>
                        )}
                      </View>
                    ))}
                    {waitingList.length > 3 && (
                      <Text className={styles.roomWaitingMore}>还有 {waitingList.length - 3} 人等待</Text>
                    )}
                  </View>
                )}

                <View className={styles.roomActions}>
                  {isBusy ? (
                    <>
                      <Button
                        className={classNames(styles.roomBtn, styles.roomBtnSuccess)}
                        onClick={() => handleComplete(room.id)}
                      >
                        完成结算
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
                      disabled={waitingList.length === 0}
                    >
                      {waitingList.length > 0 ? '叫下一位' : '暂无等待'}
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
