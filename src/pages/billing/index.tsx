import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import StatusTag from '@/components/StatusTag';
import { formatCurrency } from '@/utils';

const BillingPage: React.FC = () => {
  const { patients, currentPeriod, getPatientMonthBill } = useQueueStore();
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');

  const periodLabel = useMemo(() => {
    const [year, month] = currentPeriod.split('-');
    return `${year}年${parseInt(month)}月`;
  }, [currentPeriod]);

  const bill = useMemo(() => {
    if (!selectedPatientId) return null;
    return getPatientMonthBill(selectedPatientId);
  }, [selectedPatientId, getPatientMonthBill, currentPeriod]);

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);

  const quotaPercent = useMemo(() => {
    if (!selectedPatient) return 0;
    return selectedPatient.totalQuota > 0
      ? ((selectedPatient.totalQuota - selectedPatient.remainingQuota) / selectedPatient.totalQuota) * 100
      : 0;
  }, [selectedPatient]);

  const getPaymentLabel = (type: string) => {
    switch (type) {
      case 'package': return '套餐';
      case 'self-pay': return '自费';
      case 'split': return '套餐+自费';
      default: return '';
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'vip': return 'VIP';
      case 'urgent': return '急检';
      default: return '普通';
    }
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.periodHeader}>
        <Text className={styles.periodTitle}>{periodLabel} 患者账单</Text>
        <Text className={styles.periodSub}>按患者查看当月消费与额度</Text>
      </View>

      <View className={styles.patientSelector}>
        <ScrollView scrollX className={styles.patientScroll}>
          {patients.map(patient => (
            <View
              key={patient.id}
              className={classNames(
                styles.patientChip,
                selectedPatientId === patient.id && styles.active,
                patient.level === 'vip' && styles.chipVip,
                patient.level === 'urgent' && styles.chipUrgent
              )}
              onClick={() => setSelectedPatientId(patient.id)}
            >
              <Text className={styles.patientChipName}>{patient.name}</Text>
              <Text className={styles.patientChipLevel}>{getLevelLabel(patient.level)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {bill && selectedPatient && (
        <>
          <View className={styles.patientHeader}>
            <View className={styles.patientAvatar}>
              <Text className={styles.patientAvatarText}>{selectedPatient.name.charAt(0)}</Text>
            </View>
            <View className={styles.patientInfo}>
              <Text className={styles.patientName}>{selectedPatient.name}</Text>
              <Text className={styles.patientMeta}>
                {selectedPatient.packageName} · {getLevelLabel(selectedPatient.level)}
              </Text>
            </View>
            <StatusTag
              type={selectedPatient.level === 'vip' ? 'vip' : selectedPatient.level === 'urgent' ? 'urgent' : 'normal'}
              text={getLevelLabel(selectedPatient.level)}
              size="sm"
            />
          </View>

          <View className={styles.quotaCard}>
            <View className={styles.quotaHeader}>
              <Text className={styles.quotaTitle}>额度使用情况</Text>
              <Text className={classNames(
                styles.quotaStatus,
                selectedPatient.remainingQuota === 0 && styles.quotaEmpty
              )}>
                {selectedPatient.remainingQuota === 0 ? '已用完' : '使用中'}
              </Text>
            </View>
            <View className={styles.quotaProgress}>
              <View
                className={classNames(
                  styles.quotaProgressFill,
                  quotaPercent >= 80 && styles.quotaWarning,
                  quotaPercent >= 100 && styles.quotaDanger
                )}
                style={{ width: `${Math.min(100, quotaPercent)}%` }}
              />
            </View>
            <View className={styles.quotaRow}>
              <View className={styles.quotaItem}>
                <Text className={styles.quotaItemLabel}>总额度</Text>
                <Text className={styles.quotaItemValue}>{formatCurrency(selectedPatient.totalQuota)}</Text>
              </View>
              <View className={styles.quotaItem}>
                <Text className={styles.quotaItemLabel}>已用额度</Text>
                <Text className={styles.quotaItemValue}>
                  {formatCurrency(selectedPatient.totalQuota - selectedPatient.remainingQuota)}
                </Text>
              </View>
              <View className={styles.quotaItem}>
                <Text className={styles.quotaItemLabel}>剩余额度</Text>
                <Text className={classNames(
                  styles.quotaItemValue,
                  selectedPatient.remainingQuota === 0 && styles.quotaEmpty
                )}>
                  {formatCurrency(selectedPatient.remainingQuota)}
                </Text>
              </View>
            </View>
          </View>

          <View className={styles.billSummary}>
            <View className={styles.billSummaryItem}>
              <Text className={styles.billSummaryLabel}>套餐消费</Text>
              <Text className={classNames(styles.billSummaryValue, styles.package)}>
                {formatCurrency(bill.packageTotal)}
              </Text>
            </View>
            <View className={styles.billSummaryDivider} />
            <View className={styles.billSummaryItem}>
              <Text className={styles.billSummaryLabel}>自费消费</Text>
              <Text className={classNames(styles.billSummaryValue, styles.selfPay)}>
                {formatCurrency(bill.selfPayTotal)}
              </Text>
            </View>
            <View className={styles.billSummaryDivider} />
            <View className={styles.billSummaryItem}>
              <Text className={styles.billSummaryLabel}>合计</Text>
              <Text className={styles.billSummaryValue}>{formatCurrency(bill.total)}</Text>
            </View>
          </View>

          <View className={styles.section}>
            <View className={styles.sectionHeader}>
              <Text className={styles.sectionTitle}>已完成项目</Text>
              <Text className={styles.sectionCount}>{bill.completedItems.length}项</Text>
            </View>

            {bill.completedItems.length > 0 ? (
              bill.completedItems.sort((a, b) => b.timestamp - a.timestamp).map(record => (
                <View key={record.id} className={classNames(
                  styles.billItem,
                  record.paymentType === 'split' && styles.billItemSplit
                )}>
                  <View className={styles.billItemHeader}>
                    <Text className={styles.billItemName}>{record.examItemName}</Text>
                    <View className={styles.billItemRight}>
                      <Text className={classNames(
                        styles.billItemAmount,
                        record.paymentType === 'self-pay' && styles.selfPay,
                        record.paymentType === 'split' && styles.splitColor
                      )}>
                        -{formatCurrency(record.amount)}
                      </Text>
                      <StatusTag
                        type={record.paymentType as any}
                        text={getPaymentLabel(record.paymentType)}
                        size="sm"
                      />
                    </View>
                  </View>
                  {record.paymentType === 'split' && (
                    <View className={styles.billItemSplitDetail}>
                      <Text className={styles.splitDetailText}>
                        套餐 {formatCurrency(record.packageAmount)} + 自费 {formatCurrency(record.selfPayAmount)}
                      </Text>
                    </View>
                  )}
                  <View className={styles.billItemFooter}>
                    <Text className={styles.billItemDate}>{record.date} {record.time}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View className={styles.emptyState}>
                <Text className={styles.emptyText}>本月暂无消费记录</Text>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

export default BillingPage;
