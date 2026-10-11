import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import api from '@/api/axios';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import ReportModal from '@/components/common/ReportModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SupportAiModal from '@/components/common/SupportAiModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { FAQ_DATA } from '@/data/faqs';
import { useDarkMode } from '@/hooks/useDarkMode';

interface SubmittedReport {
  id: number;
  reference_no: string;
  report_type: string;
  subject: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  admin_notes?: string | null;
  job_id?: number | string | null;
  job_title?: string | null;
  reported_name?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
}

// Warm, eye-friendly brand crimson color matching dashboard and about screen
const ACCENT_RED = '#C53030';

export default function HelpCenterScreen() {
  const { colors, isDark } = useDarkMode();
  const ACCENT_RED_BG = isDark ? 'rgba(197, 48, 48, 0.15)' : '#FEF2F2';
  const [activeTab, setActiveTab] = useState<'faqs' | 'reports'>('faqs');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Submitted Reports state
  const [reports, setReports] = useState<SubmittedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // New report modal & AI chat modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [aiChatModalVisible, setAiChatModalVisible] = useState(false);
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof MaterialIcons.glyphMap;
    iconColor?: string;
    iconBgColor?: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));

  const openReport = async () => {
    try {
      const stored = await AsyncStorage.getItem('userData');
      const user = stored ? JSON.parse(stored) : null;
      if (user?.role === 'student' || (!user?.role && user?.student_school_name)) {
        setAiChatModalVisible(false);
        router.push({ pathname: '/students/report', params: { targetName: 'DiskarTech Platform Safety', targetType: 'user' } });
        return;
      }
      setReportModalVisible(true);
    } catch {
      setNotification({ visible: true, title: 'Unable to open report', message: 'Please try again.', iconName: 'error-outline', iconColor: '#DC2626' });
    }
  };

  const fetchMyReports = async () => {
    try {
      setLoadingReports(true);
      const res = await api.get('/reports/my-reports');
      if (res.data && res.data.status === 'success') {
        setReports(res.data.reports || []);
      }
    } catch (err) {
      console.error('Error fetching user reports:', err);
    } finally {
      setLoadingReports(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMyReports();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyReports();
  };

  // Filtered FAQs
  const filteredFaqs = FAQ_DATA.filter((faq) => {
    const matchesCategory =
      selectedFaqCategory === 'all' || faq.category === selectedFaqCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'investigating':
        return {
          label: 'Investigating',
          bg: 'bg-indigo-50',
          text: 'text-indigo-600',
          border: 'border-indigo-200',
          color: '#4F46E5',
          icon: 'search',
        };
      case 'resolved':
        return {
          label: 'Resolved',
          bg: 'bg-emerald-50',
          text: 'text-emerald-600',
          border: 'border-emerald-200',
          color: '#16A34A',
          icon: 'check-circle',
        };
      case 'dismissed':
        return {
          label: 'Closed',
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          color: '#475569',
          icon: 'close',
        };
      case 'pending':
      default:
        return {
          label: 'Pending Review',
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          color: '#B45309',
          icon: 'schedule',
        };
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'scam':
        return 'security';
      case 'underpaid':
        return 'payments';
      case 'abuse':
        return 'warning';
      case 'unsafe':
        return 'health-and-safety';
      case 'fake_job':
      default:
        return 'error-outline';
    }
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar backgroundColor={ACCENT_RED} style="light" />
      {/* Top Banner Header */}
      <View style={{ backgroundColor: ACCENT_RED }} className="pt-3 pb-5 px-6 rounded-b-[28px] shadow-sm">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center active:bg-white/30"
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-white">Help Center</Text>
          <View className="w-10" />
        </View>

        <Text className="text-white text-xl font-extrabold">How can we assist you?</Text>
        <Text className="text-red-100 text-xs mt-1">
          Explore FAQs, policy guidelines, and track submitted safety reports.
        </Text>

        {/* Tab Switcher Pills */}
        <View className="flex-row bg-white/20 rounded-2xl p-1 mt-4">
          <TouchableOpacity
            onPress={() => setActiveTab('faqs')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
              activeTab === 'faqs' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <MaterialIcons
              name="help-outline"
              size={18}
              color={activeTab === 'faqs' ? ACCENT_RED : '#FFFFFF'}
            />
            <Text
              style={{ color: activeTab === 'faqs' ? ACCENT_RED : '#FFFFFF' }}
              className="text-xs font-bold"
            >
              FAQs & Guides
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('reports')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${
              activeTab === 'reports' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <MaterialIcons
              name="outlined-flag"
              size={18}
              color={activeTab === 'reports' ? ACCENT_RED : '#FFFFFF'}
            />
            <Text
              style={{ color: activeTab === 'reports' ? ACCENT_RED : '#FFFFFF' }}
              className="text-xs font-bold"
            >
              My Reports
            </Text>
            {reports.filter((r) => r.status === 'pending' || r.status === 'investigating')
              .length > 0 && (
                <View className="bg-amber-400 px-1.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-black text-slate-900">
                    {
                      reports.filter(
                        (r) => r.status === 'pending' || r.status === 'investigating'
                      ).length
                    }
                  </Text>
                </View>
              )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {activeTab === 'faqs' ? (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          {/* Search Box */}
          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-2xl p-3.5 flex-row items-center shadow-xs border mb-4"
          >
            <MaterialIcons name="search" size={22} color={colors.textSecondary} />
            <TextInput
              placeholder="Search topics, safety guidelines, questions..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ color: colors.text }}
              className="flex-1 ml-2 text-sm"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Quick Action Tiles - Uniform Badges & Colors */}
          <View className="flex-row gap-3 mb-5">
            <TouchableOpacity
              onPress={() => setSelectedFaqCategory('safety')}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
              className="flex-1 border p-3.5 rounded-2xl shadow-xs"
            >
              <View
                style={{ backgroundColor: ACCENT_RED_BG }}
                className="w-9 h-9 rounded-xl items-center justify-center mb-2"
              >
                <MaterialIcons name="security" size={19} color={ACCENT_RED} />
              </View>
              <Text style={{ color: colors.text }} className="text-xs font-bold">Safety & Scams</Text>
              <Text style={{ color: colors.textSecondary }} className="text-[10px] mt-0.5">Protect yourself</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFaqCategory('payments')}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
              className="flex-1 border p-3.5 rounded-2xl shadow-xs"
            >
              <View
                style={{ backgroundColor: ACCENT_RED_BG }}
                className="w-9 h-9 rounded-xl items-center justify-center mb-2"
              >
                <MaterialIcons name="payments" size={19} color={ACCENT_RED} />
              </View>
              <Text style={{ color: colors.text }} className="text-xs font-bold">Wage Policies</Text>
              <Text style={{ color: colors.textSecondary }} className="text-[10px] mt-0.5">Fair rates & CoE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab('reports');
              }}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
              className="flex-1 border p-3.5 rounded-2xl shadow-xs"
            >
              <View
                style={{ backgroundColor: ACCENT_RED_BG }}
                className="w-9 h-9 rounded-xl items-center justify-center mb-2"
              >
                <MaterialIcons name="report" size={19} color={ACCENT_RED} />
              </View>
              <Text style={{ color: colors.text }} className="text-xs font-bold">Report Status</Text>
              <Text style={{ color: colors.textSecondary }} className="text-[10px] mt-0.5">Track your cases</Text>
            </TouchableOpacity>
          </View>

          {/* FAQ Category Filter Pills */}
          <View className="flex-row gap-2 mb-4 overflow-x-auto">
            {[
              { id: 'all', label: 'All Topics' },
              { id: 'safety', label: 'Safety' },
              { id: 'payments', label: 'Wages' },
              { id: 'jobs', label: 'Applications' },
              { id: 'general', label: 'Verification' },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedFaqCategory(cat.id)}
                style={{
                  backgroundColor: selectedFaqCategory === cat.id ? ACCENT_RED : colors.surface,
                  borderColor: selectedFaqCategory === cat.id ? ACCENT_RED : colors.border,
                }}
                className="px-3 py-1.5 rounded-xl border"
              >
                <Text
                  style={{
                    color: selectedFaqCategory === cat.id ? '#FFFFFF' : colors.textSecondary,
                  }}
                  className="text-xs font-semibold"
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Accordion FAQ Items */}
          <View className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="rounded-2xl p-8 items-center text-center border"
              >
                <MaterialIcons name="search-off" size={40} color={colors.textSecondary} />
                <Text style={{ color: colors.text }} className="text-sm font-bold mt-2">No matching topics found</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs mt-1">
                  Try adjusting your keywords or browse all categories.
                </Text>
              </View>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <TouchableOpacity
                    key={faq.id}
                    activeOpacity={0.8}
                    onPress={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    className="rounded-2xl p-4 border shadow-xs mb-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: colors.text }} className="text-sm font-bold flex-1 pr-3">
                        {faq.question}
                      </Text>
                      <MaterialIcons
                        name={isExpanded ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={colors.textSecondary}
                      />
                    </View>

                    {isExpanded && (
                      <View
                        style={{ borderTopColor: colors.border }}
                        className="mt-3 pt-3 border-t"
                      >
                        <Text style={{ color: colors.textSecondary }} className="text-xs leading-relaxed">
                          {faq.answer}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Direct Support Card with DARA AI */}
          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="mt-6 rounded-2xl p-5 border shadow-xs"
          >
            <View className="flex-row items-center gap-3 mb-2">
              <View
                style={{
                  backgroundColor: ACCENT_RED_BG,
                }}
                className="w-10 h-10 rounded-2xl items-center justify-center"
              >
                <MaterialIcons name="support-agent" size={22} color={ACCENT_RED} />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text }} className="text-sm font-bold">Need Immediate Help?</Text>
                <Text style={{ color: colors.textSecondary }} className="text-xs">
                  Chat with DARA for 24/7 customer support.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setAiChatModalVisible(true)}
              style={{ backgroundColor: ACCENT_RED }}
              className="mt-3 py-3.5 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80 shadow-sm"
            >
              <MaterialIcons name="chat" size={18} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">Message DARA</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* Tab 2: My Submitted Reports */
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text style={{ color: colors.text }} className="text-base font-bold">Submitted Reports</Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs">
                Track moderation review and resolution of your filed reports.
              </Text>
            </View>
          </View>

          {loadingReports && !refreshing ? (
            <View className="py-16 items-center justify-center">
              <ActivityIndicator size="large" color={ACCENT_RED} />
              <Text style={{ color: colors.textSecondary }} className="text-xs mt-2">Loading your filed reports...</Text>
            </View>
          ) : reports.length === 0 ? (
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="rounded-2xl p-8 items-center text-center border shadow-xs my-4"
            >
              <View 
                style={{ backgroundColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#ECFDF5' }}
                className="w-16 h-16 rounded-full items-center justify-center mb-3"
              >
                <MaterialIcons name="verified-user" size={32} color="#16A34A" />
              </View>
              <Text style={{ color: colors.text }} className="text-base font-bold">No Reports Filed</Text>
              <Text style={{ color: colors.textSecondary }} className="text-xs text-center max-w-xs mt-1">
                You haven&apos;t submitted any incident reports. If you ever encounter scams, fraud, or unsafe workplace conditions, you can report them anytime.
              </Text>
              <TouchableOpacity
                onPress={openReport}
                style={{ backgroundColor: ACCENT_RED }}
                className="mt-4 px-5 py-2.5 rounded-xl active:opacity-80"
              >
                <Text className="text-xs font-bold text-white">Submit Incident Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reports.map((report) => {
              const statusCfg = getStatusBadge(report.status);
              return (
                <View
                  key={report.id}
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="rounded-2xl p-5 border shadow-sm mb-4"
                >
                  {/* Card Header */}
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      <View
                        style={{
                          backgroundColor: ACCENT_RED_BG,
                        }}
                        className="w-8 h-8 rounded-xl items-center justify-center"
                      >
                        <MaterialIcons
                          name={getReportTypeIcon(report.report_type) as any}
                          size={18}
                          color={ACCENT_RED}
                        />
                      </View>
                      <View>
                        <Text style={{ color: colors.text }} className="text-xs font-bold">
                          {report.reference_no}
                        </Text>
                        <Text style={{ color: colors.textSecondary }} className="text-[10px]">{report.created_at}</Text>
                      </View>
                    </View>

                    {/* Status Pill */}
                    <View
                      className={`flex-row items-center px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.border} gap-1`}
                    >
                      <MaterialIcons
                        name={statusCfg.icon as any}
                        size={12}
                        color={statusCfg.color}
                      />
                      <Text className={`text-[11px] font-bold ${statusCfg.text}`}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Subject & Entity */}
                  <Text style={{ color: colors.text }} className="text-sm font-bold mt-1">
                    {report.subject}
                  </Text>
                  {report.reported_name && (
                    <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5">
                      <Text style={{ color: colors.text }} className="font-semibold">{report.reported_name}</Text>
                      {report.job_title && (
                        <Text style={{ color: colors.textSecondary }}> ({report.job_title})</Text>
                      )}
                    </Text>
                  )}

                  {/* Description Box */}
                  <View
                    style={{
                      backgroundColor: isDark ? colors.background : '#F8FAFC',
                      borderColor: colors.border,
                    }}
                    className="rounded-xl p-3 mt-3 border"
                  >
                    <Text style={{ color: colors.textSecondary }} className="text-[11px] font-semibold uppercase tracking-wider mb-1">
                      Details
                    </Text>
                    <Text style={{ color: colors.text }} className="text-xs leading-relaxed">
                      {report.description}
                    </Text>
                  </View>

                  {/* Admin Notes / Moderation Outcome */}
                  {report.admin_notes ? (
                    <View
                      style={{
                        backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
                        borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A',
                      }}
                      className="rounded-xl p-3 mt-2.5 border"
                    >
                      <View className="flex-row items-center gap-1.5 mb-1">
                        <MaterialIcons name="shield" size={14} color="#D97706" />
                        <Text className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                          Moderation Resolution & Action
                        </Text>
                      </View>
                      <Text style={{ color: colors.text }} className="text-xs leading-relaxed font-medium">
                        {report.admin_notes}
                      </Text>
                      {report.resolved_at && (
                        <Text className="text-[10px] text-amber-600 mt-1">
                          Resolved on {report.resolved_at}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View className="mt-2.5 flex-row items-center gap-1.5">
                      <MaterialIcons name="info-outline" size={14} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary }} className="text-[11px]">
                        {report.status === 'resolved'
                          ? 'Case has been resolved by the Admin.'
                          : 'Admin is currently investigating this incident.'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Reusable General Incident Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetName="DiskarTech Platform Safety"
        targetType="user"
        onSuccess={() => {
          fetchMyReports();
          setNotification({
            visible: true,
            title: 'Report Received',
            message:
              'Your report has been submitted to the moderation team. You can monitor its status here in the Help Center.',
            iconName: 'check-circle',
            iconColor: '#16A34A',
          });
        }}
      />

      {/* DiskarTech AI Support Chat Modal */}
      <SupportAiModal
        visible={aiChatModalVisible}
        onClose={() => setAiChatModalVisible(false)}
        onOpenFileReport={openReport}
      />

      <NotificationModal
        visible={notification.visible}
        title={notification.title}
        message={notification.message}
        iconName={notification.iconName}
        iconColor={notification.iconColor}
        iconBgColor={notification.iconBgColor}
        primaryButtonText="Got it"
        onPrimaryPress={closeNotification}
      />
    </View>
  );
}
