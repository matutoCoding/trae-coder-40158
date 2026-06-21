import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import classNames from 'classnames';

export interface StatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'vip';
  icon?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, unit = '', color = 'primary' }) => {
  return (
    <View className={classNames(styles.card, styles[color])}>
      <View className={styles.content}>
        <Text className={styles.title}>{title}</Text>
        <View className={styles.valueWrap}>
          <Text className={styles.value}>{value}</Text>
          {unit && <Text className={styles.unit}>{unit}</Text>}
        </View>
      </View>
      <View className={styles.decoration} />
    </View>
  );
};

export default StatCard;
