import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import StatusTag from '@/components/StatusTag';
import { formatCurrency } from '@/utils';
import type { PaymentType } from '@/types';

type FilterType = 'all' | PaymentType;

const RecordsPage: React.FC = () => {
  const {
    patients,
    currentPeriod,
    getCurrentMonthRecords,
    getCurrentMonthTotal,
    getCurrentMonthPackageTotal,
    getCurrentMonthSelfPayTotal
  } = useQueueStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedPatient, setSelectedPatient] = useState<string>('all');

  const currentMonthRecords = getCurrentMonthRecords();
  const totalAmount = getCurrentMonthTotal();
  const packageAmount = getCurrentMonthPackageTotal();
  const selfPayAmount = getCurrentMonthSelfPayTotal();

  const periodLabel = useMemo(() => {
    const [year, month] = currentPeriod.split('-');
    return `${year}年${parseInt(month)}月`;
  }, [currentPeriod]);

  const filteredRecords = useMemo(() => {
    let result = [...currentMonthRecords];

    if (filter !== 'all') {
      result = result.filter(r => r.paymentType === filter);
    }

    if (selectedPatient !== 'all') {
      result = result.filter(r => r.patientId === selectedPatient);
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [currentMonthRecords, filter, selectedPatient]);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, typeof filteredRecords> = {};
    filteredRecords.forEach(record => {
      const dateStr = record.date;
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(record);
    });
    return groups;
  }, [filteredRecords]);

  const getDailyTotal = (records: typeof filteredRecords) => {
    return records.reduce((sum, r) => sum + r.amount, 0);
  };

  const getDailyPackageTotal = (records: typeof filteredRecords) => {
    return records.filter(r => r.paymentType === 'package').reduce((sum, r) => sum + r.amount, 0);
  };

  const getDailySelfPayTotal = (records: typeof filteredRecords) => {
    return records.filter(r => r.paymentType === 'self-pay').reduce((sum, r) => sum + r.amount, 0);
  };

  const handleFilterChange = (type: FilterType) => {
    setFilter(type);
  };

  const handlePatientChange = (patientId: string) => {
    setSelectedPatient(patientId);
  };

  const getFilterLabel = (type: FilterType) => {
    const labels: Record<FilterType, string> = {
      all: '全部',
      package: '套餐扣费',
      'self-pay': '自费'
    };
    return labels[type];
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.summaryCard}>
        <Text className={styles.summaryTitle}>{periodLabel}累计消费</Text>
        <Text className={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
        <View className={styles.summaryStats}>
          <View className={styles.summaryStatItem}>
            <Text className={styles.summaryStatLabel}>套餐扣费</Text>
            <Text className={classNames(styles.summaryStatValue, styles.package)}>
              {formatCurrency(packageAmount)}
            </Text>
          </View>
          <View className={styles.summaryStatDivider} />
          <View className={styles.summaryStatItem}>
            <Text className={styles.summaryStatLabel}>自费金额</Text>
            <Text className={classNames(styles.summaryStatValue, styles.selfPay)}>
              {formatCurrency(selfPayAmount)}
            </Text>
          </View>
          <View className={styles.summaryStatDivider} />
          <View className={styles.summaryStatItem}>
            <Text className={styles.summaryStatLabel}>消费笔数</Text>
            <Text className={styles.summaryStatValue}>{currentMonthRecords.length}笔</Text>
          </View>
        </View>
      </View>

      {selfPayAmount > 0 && (
        <View className={styles.section}>
          <View className={styles.selfPayTipCard}>
            <View className={styles.tipIcon}>
              <Text className={styles.tipIconText}>i</Text>
            </View>
            <Text className={styles.tipText}>
              本月自费金额 {formatCurrency(selfPayAmount)}，为套餐额度用完后自动转换
            </Text>
          </View>
        </View>
      )}

      <View className={styles.filterSection}>
        <View className={styles.filterRow}>
          {(['all', 'package', 'self-pay'] as FilterType[]).map(type => (
            <View
              key={type}
              className={classNames(styles.filterChip, filter === type && styles.active)}
              onClick={() => handleFilterChange(type)}
            >
              {getFilterLabel(type)}
            </View>
          ))}
        </View>
        <View className={styles.filterRow}>
          <View
            className={classNames(styles.filterChip, selectedPatient === 'all' && styles.active)}
            onClick={() => handlePatientChange('all')}
          >
            全部患者
          </View>
          {patients.slice(0, 5).map(patient => (
            <View
              key={patient.id}
              className={classNames(styles.filterChip, selectedPatient === patient.id && styles.active)}
              onClick={() => handlePatientChange(patient.id)}
            >
              {patient.name}
            </View>
          ))}
        </View>
      </View>

      <View className={styles.recordsSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>消费明细</Text>
          <Text className={styles.sectionCount}>共 {filteredRecords.length} 条</Text>
        </View>

        {filteredRecords.length > 0 ? (
          Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a)).map(date => {
            const dayRecords = groupedRecords[date];
            const dayPackage = getDailyPackageTotal(dayRecords);
            const daySelfPay = getDailySelfPayTotal(dayRecords);

            return (
              <View key={date} className={styles.dateGroup}>
                <View className={styles.dateGroupHeader}>
                  <View className={styles.dateGroupLeft}>
                    <Text className={styles.dateGroupTitle}>{date}</Text>
                    <Text className={styles.dateGroupCount}>
                      {dayRecords.length}笔
                    </Text>
                  </View>
                  <View className={styles.dateGroupRight}>
                    <Text className={styles.dateGroupTotal}>
                      -{formatCurrency(getDailyTotal(dayRecords))}
                    </Text>
                    {(dayPackage > 0 || daySelfPay > 0) && (
                      <View className={styles.dateGroupBreakdown}>
                        {dayPackage > 0 && (
                          <Text className={styles.dateGroupPackage}>
                            套餐{formatCurrency(dayPackage)}
                          </Text>
                        )}
                        {daySelfPay > 0 && (
                          <Text className={styles.dateGroupSelfPay}>
                            自费{formatCurrency(daySelfPay)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                {dayRecords.map(record => (
                  <View key={record.id} className={styles.recordCard}>
                    <View className={styles.recordHeader}>
                      <View className={styles.recordPatient}>
                        <View className={classNames(
                          styles.recordAvatar,
                          record.paymentType === 'self-pay' && styles.avatarSelfPay
                        )}>
                          <Text className={styles.recordAvatarText}>
                            {record.patientName.charAt(0)}
                          </Text>
                        </View>
                        <View className={styles.recordPatientInfo}>
                          <Text className={styles.recordName}>{record.patientName}</Text>
                          <Text className={styles.recordTime}>{record.time}</Text>
                        </View>
                      </View>
                      <View className={styles.recordAmountWrap}>
                        <Text className={classNames(
                          styles.recordAmount,
                          record.paymentType === 'self-pay' && styles.selfPay
                        )}>
                          -{formatCurrency(record.amount)}
                        </Text>
                        <StatusTag
                          type={record.paymentType === 'package' ? 'package' : 'self-pay'}
                          text={record.paymentType === 'package' ? '套餐' : '自费'}
                          size="sm"
                        />
                      </View>
                    </View>
                    <View className={styles.recordBody}>
                      <Text className={styles.recordItem}>{record.examItemName}</Text>
                    </View>
                    <View className={styles.recordFooter}>
                      <Text className={styles.recordPeriod}>
                        周期：{record.period}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无消费记录</Text>
            <Text className={styles.emptyDesc}>完成检查后会生成消费明细</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default RecordsPage;
