import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import StatusTag from '@/components/StatusTag';
import { formatCurrency } from '@/utils';
import type { PaymentType, QuotaRecord } from '@/types';

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
      if (filter === 'split') {
        result = result.filter(r => r.paymentType === 'split');
      } else {
        result = result.filter(r => r.paymentType === filter);
      }
    }

    if (selectedPatient !== 'all') {
      result = result.filter(r => r.patientId === selectedPatient);
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [currentMonthRecords, filter, selectedPatient]);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, QuotaRecord[]> = {};
    filteredRecords.forEach(record => {
      const dateStr = record.date;
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(record);
    });
    return groups;
  }, [filteredRecords]);

  const getDailyTotal = (records: QuotaRecord[]) => {
    return records.reduce((sum, r) => sum + r.amount, 0);
  };

  const getDailyPackageTotal = (records: QuotaRecord[]) => {
    return records.reduce((sum, r) => sum + r.packageAmount, 0);
  };

  const getDailySelfPayTotal = (records: QuotaRecord[]) => {
    return records.reduce((sum, r) => sum + r.selfPayAmount, 0);
  };

  const handleFilterChange = (type: FilterType) => {
    setFilter(type);
  };

  const handlePatientChange = (patientId: string) => {
    setSelectedPatient(patientId);
  };

  const getPaymentLabel = (record: QuotaRecord) => {
    switch (record.paymentType) {
      case 'package': return '套餐';
      case 'self-pay': return '自费';
      case 'split': return '套餐+自费';
      default: return '';
    }
  };

  const getPaymentTagType = (record: QuotaRecord): string => {
    switch (record.paymentType) {
      case 'package': return 'package';
      case 'self-pay': return 'self-pay';
      case 'split': return 'split';
      default: return 'package';
    }
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
          {(['all', 'package', 'self-pay', 'split'] as FilterType[]).map(type => (
            <View
              key={type}
              className={classNames(styles.filterChip, filter === type && styles.active)}
              onClick={() => handleFilterChange(type)}
            >
              {type === 'all' ? '全部' : type === 'package' ? '套餐扣费' : type === 'self-pay' ? '自费' : '套餐+自费'}
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
          <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
            <Text className={styles.sectionTitle}>消费明细</Text>
            <Text className={styles.sectionCount}>共 {filteredRecords.length} 条</Text>
          </View>
          <Button
            className={styles.billingBtn}
            onClick={() => Taro.navigateTo({ url: '/pages/billing/index' })}
          >
            患者账单
          </Button>
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
                  <View key={record.id} className={classNames(
                    styles.recordCard,
                    record.paymentType === 'split' && styles.recordCardSplit
                  )}>
                    <View className={styles.recordHeader}>
                      <View className={styles.recordPatient}>
                        <View className={classNames(
                          styles.recordAvatar,
                          record.paymentType === 'self-pay' && styles.avatarSelfPay,
                          record.paymentType === 'split' && styles.avatarSplit
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
                          record.paymentType === 'self-pay' && styles.selfPay,
                          record.paymentType === 'split' && styles.splitColor
                        )}>
                          -{formatCurrency(record.amount)}
                        </Text>
                        <StatusTag
                          type={getPaymentTagType(record) as any}
                          text={getPaymentLabel(record)}
                          size="sm"
                        />
                      </View>
                    </View>
                    <View className={styles.recordBody}>
                      <Text className={styles.recordItem}>{record.examItemName}</Text>
                    </View>
                    {record.paymentType === 'split' && (
                      <View className={styles.recordSplitDetail}>
                        <View className={styles.splitRow}>
                          <Text className={styles.splitLabel}>套餐扣费</Text>
                          <Text className={styles.splitPackageValue}>
                            -{formatCurrency(record.packageAmount)}
                          </Text>
                        </View>
                        <View className={styles.splitRow}>
                          <Text className={styles.splitLabel}>自费补缴</Text>
                          <Text className={styles.splitSelfPayValue}>
                            -{formatCurrency(record.selfPayAmount)}
                          </Text>
                        </View>
                      </View>
                    )}
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
