import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import classNames from 'classnames';
import StatusTag from '../StatusTag';
import type { QueueItem } from '@/types';
import { formatTime } from '@/utils';

export interface QueueCardProps {
  item: QueueItem;
  rank?: number;
  onClick?: () => void;
}

const QueueCard: React.FC<QueueCardProps> = ({ item, rank, onClick }) => {
  const getLevelTagType = () => {
    switch (item.patientLevel) {
      case 'vip': return 'vip';
      case 'urgent': return 'urgent';
      default: return 'normal';
    }
  };

  const getLevelText = () => {
    switch (item.patientLevel) {
      case 'vip': return 'VIP';
      case 'urgent': return '急检';
      default: return '普通';
    }
  };

  return (
    <View
      className={classNames(styles.card, item.status === 'calling' && styles.calling)}
      onClick={onClick}
    >
      {rank !== undefined && (
        <View className={classNames(styles.rank, rank <= 3 && styles.topRank)}>
          <Text className={styles.rankText}>{rank}</Text>
        </View>
      )}

      <View className={styles.mainContent}>
        <View className={styles.header}>
          <Text className={styles.patientName}>{item.patientName}</Text>
          <View className={styles.tags}>
            <StatusTag type={getLevelTagType()} text={getLevelText()} size="sm" />
            {item.examItemType === 'fasting' && (
              <StatusTag type="fasting" text="空腹" size="sm" />
            )}
          </View>
        </View>

        <View className={styles.body}>
          <View className={styles.itemInfo}>
            <Text className={styles.itemLabel}>检查项目</Text>
            <Text className={styles.itemName}>{item.examItemName}</Text>
          </View>
        </View>

        <View className={styles.footer}>
          <View className={styles.infoItem}>
            <Text className={styles.infoLabel}>排队时间</Text>
            <Text className={styles.infoValue}>{item.queueTime}</Text>
          </View>
          <View className={styles.infoItem}>
            <Text className={styles.infoLabel}>预计等待</Text>
            <Text className={styles.infoValue}>{formatTime(item.estimatedTime)}</Text>
          </View>
          <View className={styles.infoItem}>
            <Text className={styles.infoLabel}>状态</Text>
            <StatusTag
              type={item.status === 'calling' ? 'calling' : item.status === 'completed' ? 'completed' : 'waiting'}
              text={item.status === 'calling' ? '叫号中' : item.status === 'completed' ? '已完成' : '等待中'}
              size="sm"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default QueueCard;
