import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import classNames from 'classnames';
import StatusTag from '../StatusTag';
import type { Patient } from '@/types';
import { formatCurrency } from '@/utils';

export interface PatientCardProps {
  patient: Patient;
  onClick?: () => void;
  showQuota?: boolean;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient, onClick, showQuota = true }) => {
  const getLevelTagType = () => {
    switch (patient.level) {
      case 'vip': return 'vip';
      case 'urgent': return 'urgent';
      default: return 'normal';
    }
  };

  const getLevelText = () => {
    switch (patient.level) {
      case 'vip': return 'VIP';
      case 'urgent': return '急检';
      default: return '普通';
    }
  };

  const quotaPercent = Math.max(0, Math.min(100, (patient.remainingQuota / patient.totalQuota) * 100));
  const isLowQuota = quotaPercent < 20;
  const isZeroQuota = patient.remainingQuota <= 0;

  return (
    <View className={styles.card} onClick={onClick}>
      <View className={styles.header}>
        <View className={styles.avatar}>
          <Text className={styles.avatarText}>{patient.name.charAt(0)}</Text>
        </View>
        <View className={styles.info}>
          <View className={styles.nameRow}>
            <Text className={styles.name}>{patient.name}</Text>
            <StatusTag type={getLevelTagType()} text={getLevelText()} size="sm" />
          </View>
          <Text className={styles.packageName}>{patient.packageName}</Text>
        </View>
      </View>

      {showQuota && (
        <View className={styles.quotaSection}>
          <View className={styles.quotaHeader}>
            <Text className={styles.quotaLabel}>套餐额度</Text>
            <Text className={classNames(styles.quotaValue, isZeroQuota && styles.zero, isLowQuota && !isZeroQuota && styles.low)}>
              {formatCurrency(patient.remainingQuota)} / {formatCurrency(patient.totalQuota)}
            </Text>
          </View>
          <View className={styles.progressBar}>
            <View
              className={classNames(
                styles.progressFill,
                isZeroQuota && styles.zeroFill,
                isLowQuota && !isZeroQuota && styles.lowFill
              )}
              style={{ width: `${quotaPercent}%` }}
            />
          </View>
          {isZeroQuota && (
            <Text className={styles.quotaWarning}>额度已用完，将转自费</Text>
          )}
          {isLowQuota && !isZeroQuota && (
            <Text className={styles.quotaWarning}>额度不足20%，请注意</Text>
          )}
        </View>
      )}

      <View className={styles.footer}>
        <View className={styles.metaItem}>
          <Text className={styles.metaLabel}>排队号</Text>
          <Text className={styles.metaValue}>{patient.queueNumber}</Text>
        </View>
        <View className={styles.metaItem}>
          <Text className={styles.metaLabel}>已完成</Text>
          <Text className={styles.metaValue}>{patient.completedItems.length}项</Text>
        </View>
        <View className={styles.metaItem}>
          <Text className={styles.metaLabel}>优先级</Text>
          <Text className={styles.metaValue}>P{patient.priority}</Text>
        </View>
      </View>
    </View>
  );
};

export default PatientCard;
