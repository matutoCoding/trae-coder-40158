import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import classNames from 'classnames';

export interface StatusTagProps {
  type?: 'normal' | 'vip' | 'urgent' | 'fasting' | 'self-pay' | 'package' | 'calling' | 'waiting' | 'completed' | 'split';
  text: string;
  size?: 'sm' | 'md';
}

const StatusTag: React.FC<StatusTagProps> = ({ type = 'normal', text, size = 'md' }) => {
  return (
    <View className={classNames(styles.tag, styles[type], styles[size])}>
      <Text className={styles.text}>{text}</Text>
    </View>
  );
};

export default StatusTag;
