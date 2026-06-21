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
import type { QueueItem } from '@/types';

type ViewType = 'rooms' | 'load';

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
    getRoomsByExamItem,
    getSkippedByExamItem,
    getItemLoadStats,
    getAllSkipped,
    callNextForRoom,
    completeExam,
    skipCurrent,
    cancelExam,
    transferRoom,
    recallSkipped,
    returnSkippedToQueue,
    addToQueue,
    patients
  } = useQueueStore();

  const [now, setNow] = useState(Date.now());
  const [viewType, setViewType] = useState<ViewType>('rooms');
  const [showActionSheet, setShowActionSheet] = useState<string | null>(null);
  const [showTransferSheet, setShowTransferSheet] = useState<string | null>(null);
  const [showRecallSheet, setShowRecallSheet] = useState<string | null>(null);
  const [showSkippedActionSheet, setShowSkippedActionSheet] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const waitingQueue = sortQueueByPriority(
    queue.filter(item => item.status === 'waiting')
  );

  const skippedList = getAllSkipped();
  const loadStats = getItemLoadStats();

  const getElapsedMinutes = (callTime: number | null): number => {
    if (!callTime) return 0;
    return Math.floor((now - callTime) / 60000);
  };

  const getSkippedMinutes = (skippedAt: number | null | undefined): number => {
    if (!skippedAt) return 0;
    return Math.floor((now - skippedAt) / 60000);
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
    const result = completeExam(roomId);
    if (result.success) {
      Taro.showToast({ title: `${room?.name} 已完成结算`, icon: 'success' });
    } else {
      Taro.showToast({ title: '结算失败或已结算', icon: 'none' });
    }
    setShowActionSheet(null);
  };

  const handleSkip = (roomId: string) => {
    skipCurrent(roomId);
    Taro.showToast({ title: '已跳过', icon: 'none' });
    setShowActionSheet(null);
  };

  const handleCancel = (roomId: string) => {
    Taro.showModal({
      title: '确认取消',
      content: '取消后患者将回到等待队列，不扣减额度',
      success: (res) => {
        if (res.confirm) {
          cancelExam(roomId);
          Taro.showToast({ title: '已取消检查', icon: 'none' });
        }
      }
    });
    setShowActionSheet(null);
  };

  const handleShowTransfer = (roomId: string) => {
    setShowActionSheet(null);
    setShowTransferSheet(roomId);
  };

  const handleTransfer = (fromRoomId: string, toRoomId: string) => {
    const success = transferRoom(fromRoomId, toRoomId);
    if (success) {
      Taro.showToast({ title: '改派成功', icon: 'success' });
    } else {
      Taro.showToast({ title: '改派失败', icon: 'none' });
    }
    setShowTransferSheet(null);
  };

  const handleRecall = (queueItemId: string, roomId: string) => {
    const success = recallSkipped(queueItemId, roomId);
    if (success) {
      Taro.showToast({ title: '已重新叫回', icon: 'success' });
    } else {
      Taro.showToast({ title: '叫回失败', icon: 'none' });
    }
    setShowRecallSheet(null);
    setShowSkippedActionSheet(null);
  };

  const handleReturnToQueue = (queueItemId: string) => {
    const success = returnSkippedToQueue(queueItemId);
    if (success) {
      Taro.showToast({ title: '已退回等待队列', icon: 'success' });
    }
    setShowSkippedActionSheet(null);
  };

  const handleSkippedCallDirect = (item: QueueItem) => {
    const idleRooms = getRoomsByExamItem(item.examItemId).filter(r => r.status === 'idle');
    if (idleRooms.length === 1) {
      handleRecall(item.id, idleRooms[0].id);
    } else if (idleRooms.length > 1) {
      setShowRecallSheet(`multi:${item.id}`);
    } else {
      Taro.showToast({ title: '暂无可分配房间', icon: 'none' });
    }
    setShowSkippedActionSheet(null);
  };

  const handleTakeNumber = () => {
    const availablePatients = patients.filter(
      p => !queue.some(q => q.patientId === p.id && (q.status === 'waiting' || q.status === 'calling' || q.status === 'skipped'))
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

  const renderRoomsView = () => (
    <View className={styles.roomGrid}>
      {examRooms.map(room => {
        const isBusy = room.status === 'busy';
        const waitingList = getWaitingByExamItem(room.examItemId);
        const skippedListForRoom = getSkippedByExamItem(room.examItemId);
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

            {isBusy ? (
              <View className={styles.roomActions}>
                <Button
                  className={classNames(styles.roomBtn, styles.roomBtnSuccess)}
                  onClick={() => handleComplete(room.id)}
                >
                  完成结算
                </Button>
                <Button
                  className={classNames(styles.roomBtn, styles.roomBtnOutline)}
                  onClick={() => setShowActionSheet(room.id)}
                >
                  更多
                </Button>
              </View>
            ) : (
              <View className={styles.roomActions}>
                <Button
                  className={classNames(styles.roomBtn, styles.roomBtnPrimary)}
                  onClick={() => handleCallForRoom(room.id)}
                  disabled={waitingList.length === 0}
                >
                  {waitingList.length > 0 ? '叫下一位' : '暂无等待'}
                </Button>
                {skippedListForRoom.length > 0 && (
                  <Button
                    className={classNames(styles.roomBtn, styles.roomBtnWarning)}
                    onClick={() => setShowRecallSheet(room.id)}
                  >
                    叫回
                  </Button>
                )}
              </View>
            )}

            {showActionSheet === room.id && (
              <View className={styles.actionSheetMask} onClick={() => setShowActionSheet(null)}>
                <View className={styles.actionSheet} onClick={e => e.stopPropagation()}>
                  <View className={styles.actionSheetTitle}>
                    <Text>更多操作</Text>
                  </View>
                  <Button className={styles.actionSheetItem} onClick={() => handleSkip(room.id)}>
                    跳过当前
                  </Button>
                  <Button className={styles.actionSheetItem} onClick={() => handleShowTransfer(room.id)}>
                    改派检查室
                  </Button>
                  <Button
                    className={classNames(styles.actionSheetItem, styles.danger)}
                    onClick={() => handleCancel(room.id)}
                  >
                    取消检查
                  </Button>
                  <Button className={styles.actionSheetCancel} onClick={() => setShowActionSheet(null)}>
                    取消
                  </Button>
                </View>
              </View>
            )}

            {showTransferSheet === room.id && (
              <View className={styles.actionSheetMask} onClick={() => setShowTransferSheet(null)}>
                <View className={styles.actionSheet} onClick={e => e.stopPropagation()}>
                  <View className={styles.actionSheetTitle}>
                    <Text>改派到检查室</Text>
                  </View>
                  {getRoomsByExamItem(room.examItemId)
                    .filter(r => r.id !== room.id && r.status === 'idle')
                    .length > 0 ? (
                    getRoomsByExamItem(room.examItemId)
                      .filter(r => r.id !== room.id && r.status === 'idle')
                      .map(r => (
                        <Button
                          key={r.id}
                          className={styles.actionSheetItem}
                          onClick={() => handleTransfer(room.id, r.id)}
                        >
                          {r.name}
                        </Button>
                      ))
                  ) : (
                    <View className={styles.actionSheetEmpty}>
                      <Text>暂无空闲检查室</Text>
                    </View>
                  )}
                  <Button className={styles.actionSheetCancel} onClick={() => setShowTransferSheet(null)}>
                    取消
                  </Button>
                </View>
              </View>
            )}

            {showRecallSheet === room.id && (
              <View className={styles.actionSheetMask} onClick={() => setShowRecallSheet(null)}>
                <View className={styles.actionSheet} onClick={e => e.stopPropagation()}>
                  <View className={styles.actionSheetTitle}>
                    <Text>重新叫回跳过的患者</Text>
                  </View>
                  {skippedListForRoom.length > 0 ? (
                    skippedListForRoom.map(item => (
                      <Button
                        key={item.id}
                        className={styles.actionSheetItem}
                        onClick={() => handleRecall(item.id, room.id)}
                      >
                        {item.patientName}
                        {item.patientLevel !== 'normal' && ` (${getLevelText(item.patientLevel)})`}
                      </Button>
                    ))
                  ) : (
                    <View className={styles.actionSheetEmpty}>
                      <Text>暂无跳过的患者</Text>
                    </View>
                  )}
                  <Button className={styles.actionSheetCancel} onClick={() => setShowRecallSheet(null)}>
                    取消
                  </Button>
                </View>
              </View>
            )}

            {showRecallSheet && showRecallSheet.startsWith('multi:') && (
              <View className={styles.actionSheetMask} onClick={() => setShowRecallSheet(null)}>
                <View className={styles.actionSheet} onClick={e => e.stopPropagation()}>
                  <View className={styles.actionSheetTitle}>
                    <Text>选择检查室</Text>
                  </View>
                  {(() => {
                    const itemId = showRecallSheet.split(':')[1];
                    const item = queue.find(q => q.id === itemId);
                    if (!item) return null;
                    return getRoomsByExamItem(item.examItemId)
                      .filter(r => r.status === 'idle')
                      .map(r => (
                        <Button
                          key={r.id}
                          className={styles.actionSheetItem}
                          onClick={() => handleRecall(itemId, r.id)}
                        >
                          {r.name}
                        </Button>
                      ));
                  })()}
                  <Button className={styles.actionSheetCancel} onClick={() => setShowRecallSheet(null)}>
                    取消
                  </Button>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderLoadView = () => (
    <View className={styles.loadGrid}>
      {loadStats.map(stat => (
        <View key={stat.examItemId} className={styles.loadCard}>
          <View className={styles.loadCardHeader}>
            <Text className={styles.loadCardTitle}>{stat.examItemName}</Text>
            <Text className={styles.loadCardDuration}>{stat.avgDuration}分钟/人</Text>
          </View>

          <View className={styles.loadStatsRow}>
            <View className={styles.loadStatItem}>
              <Text className={classNames(styles.loadStatValue, styles.waiting)}>{stat.waitingCount}</Text>
              <Text className={styles.loadStatLabel}>等待中</Text>
            </View>
            <View className={styles.loadStatItem}>
              <Text className={classNames(styles.loadStatValue, styles.busy)}>{stat.busyRoomCount}</Text>
              <Text className={styles.loadStatLabel}>检查中</Text>
            </View>
            <View className={styles.loadStatItem}>
              <Text className={classNames(styles.loadStatValue, styles.idle)}>{stat.idleRoomCount}</Text>
              <Text className={styles.loadStatLabel}>空闲室</Text>
            </View>
          </View>

          <View className={styles.loadProgress}>
            <View
              className={styles.loadProgressFill}
              style={{
                width: `${Math.min(100, stat.totalRoomCount > 0 ? (stat.busyRoomCount / stat.totalRoomCount) * 100 : 0)}%`
              }}
            />
          </View>

          <View className={styles.loadEstimate}>
            <View className={styles.loadEstimateItem}>
              <Text className={styles.loadEstimateLabel}>预计等待</Text>
              <Text className={styles.loadEstimateValue}>
                {stat.waitingCount > 0 ? `${stat.estimatedWaitMinutes}分钟` : '无等待'}
              </Text>
            </View>
            <View className={styles.loadEstimateItem}>
              <Text className={styles.loadEstimateLabel}>预计排到</Text>
              <Text className={styles.loadEstimateValue}>{stat.estimatedFinishTime}</Text>
            </View>
          </View>

          {stat.idleRoomCount > 0 && (
            <View className={styles.loadIdleRooms}>
              <Text className={styles.loadIdleRoomsTitle}>空闲检查室：</Text>
              <View className={styles.loadIdleRoomList}>
                {getRoomsByExamItem(stat.examItemId)
                  .filter(r => r.status === 'idle')
                  .map(r => (
                    <View key={r.id} className={styles.loadIdleRoomChip}>
                      <Text className={styles.loadIdleRoomText}>{r.name}</Text>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.headerSection}>
        <Text className={styles.headerTitle}>体检排队叫号</Text>
        <View className={styles.headerRow}>
          <Text className={styles.headerSubtitle}>{dayjs().format('YYYY年MM月DD日 dddd')}</Text>
          <Button
            className={styles.headerLogBtn}
            onClick={() => Taro.navigateTo({ url: '/pages/dispatch-log/index' })}
          >
            调度流水
          </Button>
        </View>
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

      <View className={styles.viewTabs}>
        <View
          className={classNames(styles.viewTab, viewType === 'rooms' && styles.active)}
          onClick={() => setViewType('rooms')}
        >
          <Text className={styles.viewTabText}>检查室</Text>
        </View>
        <View
          className={classNames(styles.viewTab, viewType === 'load' && styles.active)}
          onClick={() => setViewType('load')}
        >
          <Text className={styles.viewTabText}>负载视图</Text>
        </View>
      </View>

      {skippedList.length > 0 && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={classNames(styles.sectionTitle, styles.skippedTitle)}>
              ⚠ 待处理（跳过 {skippedList.length}人）
            </Text>
          </View>

          <View className={styles.skippedList}>
            {skippedList.map(item => {
              const minutesSkipped = getSkippedMinutes(item.skippedAt);
              return (
                <View key={item.id} className={styles.skippedCard}>
                  <View className={styles.skippedAvatar}>
                    <Text className={styles.skippedAvatarText}>{item.patientName.charAt(0)}</Text>
                  </View>
                  <View className={styles.skippedInfo}>
                    <View className={styles.skippedRow1}>
                      <Text className={styles.skippedName}>{item.patientName}</Text>
                      {item.patientLevel !== 'normal' && (
                        <StatusTag
                          type={item.patientLevel as any}
                          text={getLevelText(item.patientLevel)}
                          size="sm"
                        />
                      )}
                    </View>
                    <View className={styles.skippedRow2}>
                      <Text className={styles.skippedItem}>{item.examItemName}</Text>
                      <Text className={styles.skippedRoom}>
                        来自 {item.skippedFromRoomName || '未知房间'}
                      </Text>
                    </View>
                    <View className={styles.skippedRow3}>
                      <Text className={styles.skippedTime}>已跳过 {minutesSkipped}分钟</Text>
                      {item.examItemType === 'fasting' && (
                        <Text className={styles.roomWaitingFasting}>空腹</Text>
                      )}
                    </View>
                  </View>
                  <View className={styles.skippedActions}>
                    <Button
                      className={classNames(styles.skippedBtn, styles.skippedBtnPrimary)}
                      onClick={() => handleSkippedCallDirect(item)}
                    >
                      立即叫回
                    </Button>
                    <Button
                      className={classNames(styles.skippedBtn, styles.skippedBtnOutline)}
                      onClick={() => setShowSkippedActionSheet(item.id)}
                    >
                      更多
                    </Button>
                  </View>

                  {showSkippedActionSheet === item.id && (
                    <View className={styles.actionSheetMask} onClick={() => setShowSkippedActionSheet(null)}>
                      <View className={styles.actionSheet} onClick={e => e.stopPropagation()}>
                        <View className={styles.actionSheetTitle}>
                          <Text>处理跳过患者</Text>
                        </View>
                        <Button
                          className={styles.actionSheetItem}
                          onClick={() => handleSkippedCallDirect(item)}
                        >
                          立即叫回（分配空闲房间）
                        </Button>
                        <Button
                          className={styles.actionSheetItem}
                          onClick={() => handleReturnToQueue(item.id)}
                        >
                          退回普通等待队列
                        </Button>
                        <Button
                          className={classNames(styles.actionSheetItem, styles.danger)}
                          onClick={() => handleReturnToQueue(item.id)}
                        >
                          移除队列
                        </Button>
                        <Button className={styles.actionSheetCancel} onClick={() => setShowSkippedActionSheet(null)}>
                          取消
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>
            {viewType === 'rooms' ? '检查室状态' : '项目负载'}
          </Text>
          <Text className={styles.sectionSubtitle}>
            {viewType === 'rooms'
              ? `空闲 ${examRooms.filter(r => r.status === 'idle').length} / 忙碌 ${examRooms.filter(r => r.status === 'busy').length}`
              : `共 ${examItems.length} 个检查项目`}
          </Text>
        </View>

        {viewType === 'rooms' ? renderRoomsView() : renderLoadView()}
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
