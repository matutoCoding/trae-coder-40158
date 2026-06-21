import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import classNames from 'classnames';
import { useQueueStore } from '@/store/useQueueStore';
import StatusTag from '@/components/StatusTag';
import { formatCurrency } from '@/utils';
import type { ExamItemSummary, QuotaRecord } from '@/types';

type ViewMode = 'patient' | 'summary';

const BillingPage: React.FC = () => {
  const { patients, currentPeriod, getPatientMonthBill, getExamItemSummaries, quotaRecords } = useQueueStore();
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentPeriod);
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('patient');
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

  const availablePeriods = useMemo(() => {
    const periods = new Set<string>();
    periods.add(currentPeriod);
    quotaRecords.forEach(r => periods.add(r.period));
    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  }, [quotaRecords, currentPeriod]);

  const periodLabel = useMemo(() => {
    const [year, month] = selectedPeriod.split('-');
    return `${year}年${parseInt(month)}月`;
  }, [selectedPeriod]);

  const bill = useMemo(() => {
    if (!selectedPatientId) return null;
    return getPatientMonthBill(selectedPatientId, selectedPeriod);
  }, [selectedPatientId, selectedPeriod, getPatientMonthBill]);

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);

  const itemSummaries = useMemo(() => {
    return getExamItemSummaries(selectedPeriod);
  }, [selectedPeriod, getExamItemSummaries]);

  const summaryTotals = useMemo(() => {
    return itemSummaries.reduce((acc, s) => ({
      patientCount: acc.patientCount + s.patientCount,
      packageTotal: acc.packageTotal + s.packageTotal,
      selfPayTotal: acc.selfPayTotal + s.selfPayTotal,
      totalAmount: acc.totalAmount + s.totalAmount
    }), { patientCount: 0, packageTotal: 0, selfPayTotal: 0, totalAmount: 0 });
  }, [itemSummaries]);

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

  const handlePrevMonth = () => {
    const idx = availablePeriods.indexOf(selectedPeriod);
    if (idx < availablePeriods.length - 1) {
      setSelectedPeriod(availablePeriods[idx + 1]);
    } else {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedPeriod(prevPeriod);
    }
  };

  const handleNextMonth = () => {
    const idx = availablePeriods.indexOf(selectedPeriod);
    if (idx > 0) {
      setSelectedPeriod(availablePeriods[idx - 1]);
    }
  };

  const handleGenerateChecklist = () => {
    setShowChecklist(true);
  };

  const handleExportChecklist = () => {
    if (!bill || !selectedPatient) return;

    const checklistText = [
      '========== 体检收费核对单 ==========',
      `患者姓名：${selectedPatient.name}`,
      `患者级别：${getLevelLabel(selectedPatient.level)}`,
      `套餐名称：${selectedPatient.packageName}`,
      `账单周期：${periodLabel}`,
      '------------------------------------',
      `套餐总额度：${formatCurrency(selectedPatient.totalQuota)}`,
      `剩余套餐额度：${formatCurrency(bill.remaining)}`,
      '------------------------------------',
      `本月套餐消费：${formatCurrency(bill.packageTotal)}`,
      `本月自费消费：${formatCurrency(bill.selfPayTotal)}`,
      `本月合计消费：${formatCurrency(bill.total)}`,
      '------------------------------------',
      `已完成项目（${bill.completedItems.length}项）：`,
      ...bill.completedItems
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((r, i) => {
          const typeLabel = getPaymentLabel(r.paymentType);
          const roomStr = r.roomName ? `[${r.roomName}]` : '';
          if (r.paymentType === 'split') {
            return `  ${i + 1}. ${r.examItemName} ${roomStr} ${r.date} ${r.time}\n     合计 ${formatCurrency(r.amount)}（套餐${formatCurrency(r.packageAmount)}+自费${formatCurrency(r.selfPayAmount)}） [${typeLabel}]`;
          }
          return `  ${i + 1}. ${r.examItemName} ${roomStr} ${r.date} ${r.time}  ${formatCurrency(r.amount)} [${typeLabel}]`;
        }),
      '====================================',
      `生成时间：${new Date().toLocaleString('zh-CN')}`,
    ].join('\n');

    Taro.setClipboardData({
      data: checklistText,
      success: () => {
        Taro.showToast({ title: '核对单已复制', icon: 'success' });
      }
    });
  };

  const toggleSummary = (id: string) => {
    setExpandedSummaryId(expandedSummaryId === id ? null : id);
  };

  const renderPatientView = () => (
    <>
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

          <View className={styles.actionBar}>
            <Button
              className={styles.primaryBtn}
              onClick={handleGenerateChecklist}
            >
              生成收费核对单
            </Button>
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
                    <Text className={styles.billItemDate}>
                      {record.date} {record.time}
                      {record.roomName && ` · ${record.roomName}`}
                    </Text>
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
    </>
  );

  const renderRecord = (record: QuotaRecord) => (
    <View key={record.id} className={classNames(
      styles.summaryRecord,
      record.paymentType === 'split' && styles.summaryRecordSplit
    )}>
      <View className={styles.summaryRecordRow}>
        <Text className={styles.summaryRecordPatient}>{record.patientName}</Text>
        <View className={styles.summaryRecordRight}>
          <Text className={classNames(
            styles.summaryRecordAmount,
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
        <Text className={styles.summaryRecordSplitText}>
          套餐{formatCurrency(record.packageAmount)} + 自费{formatCurrency(record.selfPayAmount)}
        </Text>
      )}
      <Text className={styles.summaryRecordDate}>
        {record.date} {record.time}
        {record.roomName && ` · ${record.roomName}`}
      </Text>
    </View>
  );

  const renderSummaryView = () => (
    <>
      <View className={styles.summaryOverviewCard}>
        <View className={styles.summaryOverviewRow}>
          <View className={styles.summaryOverviewItem}>
            <Text className={styles.summaryOverviewLabel}>覆盖项目</Text>
            <Text className={styles.summaryOverviewValue}>{itemSummaries.length}项</Text>
          </View>
          <View className={styles.summaryOverviewItem}>
            <Text className={styles.summaryOverviewLabel}>服务人次</Text>
            <Text className={styles.summaryOverviewValue}>{summaryTotals.patientCount}</Text>
          </View>
          <View className={styles.summaryOverviewItem}>
            <Text className={styles.summaryOverviewLabel}>总额</Text>
            <Text className={classNames(styles.summaryOverviewValue, styles.bold)}>
              {formatCurrency(summaryTotals.totalAmount)}
            </Text>
          </View>
        </View>
        <View className={styles.summaryOverviewRow}>
          <View className={styles.summaryOverviewSubItem}>
            <Text className={styles.summaryOverviewSubLabel}>套餐合计</Text>
            <Text className={classNames(styles.summaryOverviewSubValue, styles.package)}>
              {formatCurrency(summaryTotals.packageTotal)}
            </Text>
          </View>
          <View className={styles.summaryOverviewSubItem}>
            <Text className={styles.summaryOverviewSubLabel}>自费合计</Text>
            <Text className={classNames(styles.summaryOverviewSubValue, styles.selfPay)}>
              {formatCurrency(summaryTotals.selfPayTotal)}
            </Text>
          </View>
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>按项目汇总</Text>
          <Text className={styles.sectionCount}>共{itemSummaries.length}项</Text>
        </View>

        {itemSummaries.length > 0 ? (
          itemSummaries.map((summary: ExamItemSummary) => {
            const isExpanded = expandedSummaryId === summary.examItemId;
            return (
              <View key={summary.examItemId} className={styles.summaryCard}>
                <View
                  className={styles.summaryCardHeader}
                  onClick={() => toggleSummary(summary.examItemId)}
                >
                  <View className={styles.summaryCardLeft}>
                    <Text className={styles.summaryCardName}>{summary.examItemName}</Text>
                    <Text className={styles.summaryCardCount}>
                      {summary.patientCount}人次
                    </Text>
                  </View>
                  <View className={styles.summaryCardRight}>
                    <View className={styles.summaryCardAmountRow}>
                      <Text className={styles.summaryCardPackage}>
                        套餐 {formatCurrency(summary.packageTotal)}
                      </Text>
                      <Text className={styles.summaryCardSelfPay}>
                        自费 {formatCurrency(summary.selfPayTotal)}
                      </Text>
                    </View>
                    <View className={styles.summaryCardFooterRow}>
                      <Text className={styles.summaryCardTotal}>
                        合计 {formatCurrency(summary.totalAmount)}
                      </Text>
                      <Text className={styles.summaryCardArrow}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                  </View>
                </View>

                {isExpanded && (
                  <View className={styles.summaryCardBody}>
                    <View className={styles.summaryCardBodyHeader}>
                      <Text className={styles.summaryCardBodyTitle}>
                        明细（{summary.records.length}条）
                      </Text>
                    </View>
                    <View className={styles.summaryRecordList}>
                      {summary.records
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map(renderRecord)}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyText}>本月暂无消费记录</Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.periodHeader}>
        <View className={styles.periodNav}>
          <Button
            className={styles.periodArrow}
            onClick={handlePrevMonth}
          >
            ‹
          </Button>
          <View className={styles.periodInfo}>
            <Text className={styles.periodTitle}>{periodLabel} 对账</Text>
            <Text className={styles.periodSub}>
              {viewMode === 'patient' ? '按患者查看当月消费与额度' : '按检查项目汇总当月消费'}
            </Text>
          </View>
          <Button
            className={classNames(styles.periodArrow, selectedPeriod === currentPeriod && styles.disabled)}
            onClick={handleNextMonth}
            disabled={selectedPeriod === currentPeriod}
          >
            ›
          </Button>
        </View>

        <View className={styles.periodTabs}>
          {availablePeriods.map(p => {
            const [y, m] = p.split('-');
            return (
              <View
                key={p}
                className={classNames(styles.periodTab, selectedPeriod === p && styles.active)}
                onClick={() => setSelectedPeriod(p)}
              >
                <Text className={styles.periodTabText}>{m}月</Text>
              </View>
            );
          })}
        </View>

        <View className={styles.viewModeTabs}>
          <View
            className={classNames(styles.viewModeTab, viewMode === 'patient' && styles.active)}
            onClick={() => setViewMode('patient')}
          >
            <Text className={styles.viewModeTabText}>患者账单</Text>
          </View>
          <View
            className={classNames(styles.viewModeTab, viewMode === 'summary' && styles.active)}
            onClick={() => setViewMode('summary')}
          >
            <Text className={styles.viewModeTabText}>项目汇总</Text>
          </View>
        </View>
      </View>

      {viewMode === 'patient' ? renderPatientView() : renderSummaryView()}

      {showChecklist && bill && selectedPatient && (
        <View className={styles.checklistModal} onClick={() => setShowChecklist(false)}>
          <View className={styles.checklistContent} onClick={e => e.stopPropagation()}>
            <View className={styles.checklistHeader}>
              <Text className={styles.checklistTitle}>收费核对单</Text>
              <Button className={styles.closeBtn} onClick={() => setShowChecklist(false)}>×</Button>
            </View>

            <ScrollView className={styles.checklistBody} scrollY>
              <View className={styles.checklistSection}>
                <Text className={styles.checklistSectionTitle}>患者信息</Text>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>姓名</Text>
                  <Text className={styles.checklistValue}>{selectedPatient.name}</Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>级别</Text>
                  <Text className={styles.checklistValue}>{getLevelLabel(selectedPatient.level)}</Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>套餐</Text>
                  <Text className={styles.checklistValue}>{selectedPatient.packageName}</Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>周期</Text>
                  <Text className={styles.checklistValue}>{periodLabel}</Text>
                </View>
              </View>

              <View className={styles.checklistSection}>
                <Text className={styles.checklistSectionTitle}>额度情况</Text>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>总额度</Text>
                  <Text className={styles.checklistValue}>{formatCurrency(selectedPatient.totalQuota)}</Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>已用</Text>
                  <Text className={styles.checklistValue}>{formatCurrency(selectedPatient.totalQuota - selectedPatient.remainingQuota)}</Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>剩余</Text>
                  <Text className={classNames(styles.checklistValue, styles.bold)}>
                    {formatCurrency(bill.remaining)}
                  </Text>
                </View>
              </View>

              <View className={styles.checklistSection}>
                <Text className={styles.checklistSectionTitle}>本月消费汇总</Text>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>套餐消费</Text>
                  <Text className={classNames(styles.checklistValue, styles.packageColor)}>
                    {formatCurrency(bill.packageTotal)}
                  </Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>自费消费</Text>
                  <Text className={classNames(styles.checklistValue, styles.selfPayColor)}>
                    {formatCurrency(bill.selfPayTotal)}
                  </Text>
                </View>
                <View className={styles.checklistRow}>
                  <Text className={styles.checklistLabel}>合计</Text>
                  <Text className={classNames(styles.checklistValue, styles.bold)}>
                    {formatCurrency(bill.total)}
                  </Text>
                </View>
              </View>

              <View className={styles.checklistSection}>
                <Text className={styles.checklistSectionTitle}>
                  已完成项目（{bill.completedItems.length}项）
                </Text>
                {bill.completedItems
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((record, idx) => (
                    <View key={record.id} className={styles.checklistItem}>
                      <View className={styles.checklistItemHeader}>
                        <Text className={styles.checklistItemName}>
                          {idx + 1}. {record.examItemName}
                        </Text>
                        <Text className={styles.checklistItemAmount}>
                          {formatCurrency(record.amount)}
                        </Text>
                      </View>
                      <View className={styles.checklistItemMeta}>
                        <Text className={styles.checklistItemDate}>
                          {record.date} {record.time}
                          {record.roomName && ` · ${record.roomName}`}
                        </Text>
                        <StatusTag
                          type={record.paymentType as any}
                          text={getPaymentLabel(record.paymentType)}
                          size="sm"
                        />
                      </View>
                      {record.paymentType === 'split' && (
                        <View className={styles.checklistItemSplit}>
                          <Text className={styles.splitText}>
                            套餐 {formatCurrency(record.packageAmount)} + 自费 {formatCurrency(record.selfPayAmount)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
              </View>
            </ScrollView>

            <View className={styles.checklistFooter}>
              <Button
                className={styles.checklistBtnOutline}
                onClick={() => setShowChecklist(false)}
              >
                关闭
              </Button>
              <Button
                className={styles.checklistBtnPrimary}
                onClick={handleExportChecklist}
              >
                复制核对单
              </Button>
            </View>
          </View>
        </View>
      )}

      <View style={{ height: '80rpx' }} />
    </ScrollView>
  );
};

export default BillingPage;
