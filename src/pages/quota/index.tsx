import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import PatientCard from '@/components/PatientCard';
import StatusTag from '@/components/StatusTag';
import { packageQuotas } from '@/data/mockData';
import { formatCurrency } from '@/utils';

type FilterType = 'all' | 'low' | 'zero';

const QuotaPage: React.FC = () => {
  const { patients, resetQuota, quotaRecords } = useQueueStore();
  const [filter, setFilter] = useState<FilterType>('all');

  const totalQuota = useMemo(() => {
    return patients.reduce((sum, p) => sum + p.totalQuota, 0);
  }, [patients]);

  const usedQuota = useMemo(() => {
    return patients.reduce((sum, p) => sum + (p.totalQuota - p.remainingQuota), 0);
  }, [patients]);

  const remainingQuota = useMemo(() => {
    return patients.reduce((sum, p) => sum + p.remainingQuota, 0);
  }, [patients]);

  const lowQuotaCount = useMemo(() => {
    return patients.filter(p => p.remainingQuota > 0 && p.remainingQuota / p.totalQuota < 0.2).length;
  }, [patients]);

  const zeroQuotaCount = useMemo(() => {
    return patients.filter(p => p.remainingQuota <= 0).length;
  }, [patients]);

  const selfPayTotal = useMemo(() => {
    return quotaRecords
      .filter(r => r.paymentType === 'self-pay')
      .reduce((sum, r) => sum + r.amount, 0);
  }, [quotaRecords]);

  const filteredPatients = useMemo(() => {
    switch (filter) {
      case 'low':
        return patients.filter(p => p.remainingQuota > 0 && p.remainingQuota / p.totalQuota < 0.2);
      case 'zero':
        return patients.filter(p => p.remainingQuota <= 0);
      default:
        return patients;
    }
  }, [patients, filter]);

  const handleResetAll = () => {
    Taro.showModal({
      title: '确认重置',
      content: '确定要重置所有患者的本月额度吗？重置后额度将恢复至套餐总额。',
      confirmText: '确认重置',
      confirmColor: '#0fc6c2',
      success: (res) => {
        if (res.confirm) {
          patients.forEach(p => resetQuota(p.id));
          Taro.showToast({ title: '额度已重置', icon: 'success' });
        }
      }
    });
  };

  const handleResetPatient = (patientId: string, patientName: string) => {
    Taro.showModal({
      title: '确认重置',
      content: `确定要重置 ${patientName} 的本月额度吗？`,
      confirmText: '确认重置',
      confirmColor: '#0fc6c2',
      success: (res) => {
        if (res.confirm) {
          resetQuota(patientId);
          Taro.showToast({ title: '额度已重置', icon: 'success' });
        }
      }
    });
  };

  const getFilterLabel = (type: FilterType) => {
    const labels: Record<FilterType, string> = {
      all: '全部',
      low: '额度不足',
      zero: '已用完'
    };
    return labels[type];
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.headerCard}>
        <Text className={styles.headerTitle}>本月总剩余额度</Text>
        <Text className={styles.headerAmount}>{formatCurrency(remainingQuota)}</Text>
        <View className={styles.headerInfo}>
          <View className={styles.headerInfoItem}>
            <Text className={styles.headerInfoLabel}>总额度</Text>
            <Text className={styles.headerInfoValue}>{formatCurrency(totalQuota)}</Text>
          </View>
          <View className={styles.headerInfoItem}>
            <Text className={styles.headerInfoLabel}>已使用</Text>
            <Text className={styles.headerInfoValue}>{formatCurrency(usedQuota)}</Text>
          </View>
          <View className={styles.headerInfoItem}>
            <Text className={styles.headerInfoLabel}>重置周期</Text>
            <Text className={styles.headerInfoValue}>每月1日</Text>
          </View>
        </View>
      </View>

      <View className={styles.statsRow}>
        <View className={styles.statBox}>
          <Text className={styles.statBoxValue}>{patients.length}</Text>
          <Text className={styles.statBoxLabel}>总人数</Text>
        </View>
        <View className={styles.statBox}>
          <Text className={classNames(styles.statBoxValue, styles.warning)}>{lowQuotaCount}</Text>
          <Text className={styles.statBoxLabel}>额度不足</Text>
        </View>
        <View className={styles.statBox}>
          <Text className={classNames(styles.statBoxValue, styles.error)}>{zeroQuotaCount}</Text>
          <Text className={styles.statBoxLabel}>已用完</Text>
        </View>
      </View>

      {(zeroQuotaCount > 0 || selfPayTotal > 0) && (
        <View className={styles.section}>
          <View className={styles.selfPayCard}>
            <View className={styles.selfPayHeader}>
              <Text className={styles.selfPayTitle}>自费金额统计</Text>
              <Text className={styles.selfPayAmount}>{formatCurrency(selfPayTotal)}</Text>
            </View>
            <Text className={styles.selfPayDesc}>
              额度用完后自动转为自费，共 {quotaRecords.filter(r => r.paymentType === 'self-pay').length} 笔自费记录
            </Text>
          </View>
        </View>
      )}

      {lowQuotaCount > 0 && (
        <View className={styles.section}>
          <View className={styles.lowQuotaWarning}>
            <View className={styles.warningIcon}>
              <Text className={styles.warningIconText}>!</Text>
            </View>
            <Text className={styles.warningText}>
              有 {lowQuotaCount} 位患者额度不足20%，请及时提醒或办理套餐升级
            </Text>
          </View>
        </View>
      )}

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>套餐额度</Text>
          <Button className={styles.resetBtn} onClick={handleResetAll}>
            全部重置
          </Button>
        </View>

        <View className={styles.packageList}>
          {packageQuotas.map(pkg => {
            const pkgPatients = patients.filter(p => p.packageName === pkg.packageName);
            const pkgUsed = pkgPatients.reduce((sum, p) => sum + (p.totalQuota - p.remainingQuota), 0);
            const pkgTotal = pkgPatients.reduce((sum, p) => sum + p.totalQuota, 0);
            const percent = pkgTotal > 0 ? (pkgUsed / pkgTotal) * 100 : 0;

            return (
              <View key={pkg.id} className={styles.packageCard}>
                <View className={styles.packageHeader}>
                  <Text className={styles.packageName}>{pkg.packageName}</Text>
                  <Text className={styles.packagePeriod}>{pkg.period}</Text>
                </View>
                <View className={styles.packageQuotaInfo}>
                  <Text className={styles.packageQuotaLabel}>已使用 / 总额度</Text>
                  <Text className={styles.packageQuotaValue}>
                    {formatCurrency(pkgUsed)} / {formatCurrency(pkgTotal)}
                  </Text>
                </View>
                <View className={styles.packageProgress}>
                  <View
                    className={styles.packageProgressFill}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </View>
                <View className={styles.packageFooter}>
                  <Text className={styles.packageResetDate}>
                    {pkgPatients.length}人 · 重置日：{pkg.resetDate}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.patientSectionTitle}>患者额度</Text>

        <View className={styles.filterTabs}>
          {(['all', 'low', 'zero'] as FilterType[]).map(type => (
            <View
              key={type}
              className={classNames(styles.filterTab, filter === type && styles.active)}
              onClick={() => setFilter(type)}
            >
              {getFilterLabel(type)}
            </View>
          ))}
        </View>

        {filteredPatients.length > 0 ? (
          filteredPatients.map(patient => (
            <View key={patient.id} style={{ position: 'relative' }}>
              <PatientCard patient={patient} showQuota />
              <Button
                className={styles.packageResetBtn}
                style={{
                  position: 'absolute',
                  top: '24rpx',
                  right: '24rpx',
                  padding: '0 24rpx',
                  height: '48rpx',
                  borderRadius: '999rpx',
                  background: 'rgba(15, 198, 194, 0.1)',
                  color: '#0fc6c2',
                  fontSize: '22rpx',
                  fontWeight: '500'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetPatient(patient.id, patient.name);
                }}
              >
                重置额度
              </Button>
            </View>
          ))
        ) : (
          <View style={{ textAlign: 'center', padding: '80rpx 0' }}>
            <Text style={{ fontSize: '28rpx', color: '#86909c' }}>暂无符合条件的患者</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default QuotaPage;
