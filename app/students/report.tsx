import api from '@/api/axios';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { buildReportPayload, REPORT_REASONS, ReportReason } from '@/utils/reportForm';
import { sanitizePlainText } from '@/utils/plainTextInput';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StudentReportScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const routeParams = useLocalSearchParams<{ targetName?: string; targetType?: string; jobId?: string; reportedUserId?: string }>();
  const params = {
    targetName: typeof routeParams.targetName === 'string' ? routeParams.targetName : undefined,
    targetType: typeof routeParams.targetType === 'string' ? routeParams.targetType : undefined,
    jobId: typeof routeParams.jobId === 'string' ? routeParams.jobId : undefined,
    reportedUserId: typeof routeParams.reportedUserId === 'string' ? routeParams.reportedUserId : undefined,
  };
  const [selectedReason, setSelectedReason] = useState<ReportReason>('scam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const busy = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const explanationRef = useRef<TextInput>(null);
  const explanationFocused = useRef(false);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const [notice, setNotice] = useState<{
    title: string; message: string; success: boolean;
  } | null>(null);
  const accent = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const generalReport = params.targetType === 'user' && !params.jobId && !params.reportedUserId;
  const title = generalReport ? 'Report a concern' : params.targetType === 'job' ? 'Report job listing' : 'Report hirer';
  const targetName = sanitizePlainText(params.targetName || 'DiskarTech Platform Safety').slice(0, 255);

  const revealExplanation = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    // Measure after the keyboard animation, native resize, and text layout.
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      if (!explanationFocused.current) return;
      explanationRef.current?.measureInWindow((_x, inputY, _width, inputHeight) => {
        viewportRef.current?.measureInWindow((_left, viewportY, _w, height) => {
          if (!explanationFocused.current || height <= 0) return;
          // If a build uses keyboard overlay instead of native resize, supply
          // enough scroll range to reveal the field without a native rebuild.
          setKeyboardOverlap(keyboardTop.current === null ? 0 : Math.max(0, viewportY + height - keyboardTop.current));
          const top = viewportY + 12;
          const bottom = Math.min(viewportY + height, keyboardTop.current ?? Infinity) - 16;
          if (bottom <= top) return;
          const visibleInputHeight = Math.min(inputHeight, bottom - top);
          const delta = inputY < top ? inputY - top
            : inputY + visibleInputHeight > bottom ? inputY + visibleInputHeight - bottom : 0;
          if (Math.abs(delta) > 1) {
            // Native Android resize already makes space for the keyboard.
            // Scroll only the remaining overlap; don't add keyboard height twice.
            scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: false });
          }
        });
      });
    }, 100);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      revealExplanation();
    });
    const frame = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      if (keyboardTop.current !== null) {
        keyboardTop.current = event.endCoordinates.screenY;
        revealExplanation();
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardOverlap(0);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    });
    return () => {
      show.remove(); frame.remove(); hide.remove();
      explanationFocused.current = false;
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [revealExplanation]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => busy.current);
    return () => subscription.remove();
  }, []));

  const goBack = () => {
    if (busy.current) return;
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace('/help-center');
  };

  const handleSubmit = async () => {
    if (busy.current || submitted) return;
    let payload;
    try {
      if (Object.values(routeParams).some(Array.isArray)) throw new Error('The report target is invalid. Return to the details page and try again.');
      payload = buildReportPayload({
        reason: selectedReason, description, targetName,
        jobId: params.jobId, reportedUserId: params.reportedUserId, targetType: params.targetType,
      });
    } catch (error) {
      setNotice({ title: 'Check your report', message: error instanceof Error ? error.message : 'Please check the report details.', success: false });
      return;
    }
    busy.current = true;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      const response = await api.post('/reports', payload);
      if (response.data?.status === 'already_reported') {
        setSubmitted(true);
        setNotice({ title: 'Report already submitted', message: response.data.message || 'Your existing report is being reviewed.', success: true });
      } else if (response.data?.status === 'success') {
        setSubmitted(true);
        setNotice({ title: 'Report received', message: 'Your report has been submitted to the admin team. You can track its status in the Help Center.', success: true });
      } else {
        throw new Error(response.data?.message || 'Unable to submit your report. Please try again.');
      }
    } catch (error: any) {
      const validation = Object.values(error.response?.data?.errors || {}).flat().find((value) => typeof value === 'string');
      setNotice({ title: 'Submission failed', message: String(validation || error.response?.data?.message || error.message || 'Please check your connection and try again.'), success: false });
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ gestureEnabled: !submitting }} />
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center px-5 pb-3 flex-row items-center gap-3" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={goBack} disabled={submitting} accessibilityRole="button" accessibilityLabel="Go back" activeOpacity={0.75} className="w-12 h-12 items-center justify-center" style={{ opacity: submitting ? 0.5 : 1 }}>
          <MaterialIcons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold" style={{ color: colors.text }}>{title}</Text>
      </View>
      <View ref={viewportRef} collapsable={false} className="flex-1" onLayout={(event) => {
        setViewportHeight(event.nativeEvent.layout.height);
        revealExplanation();
      }}>
        <ScrollView ref={scrollRef}
          className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 24 + keyboardOverlap, width: '100%', maxWidth: 680, alignSelf: 'center' }}
          onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
          onContentSizeChange={revealExplanation} automaticallyAdjustKeyboardInsets={false}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        >
          <View className="rounded-3xl border p-5 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-row items-start gap-3">
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="outlined-flag" size={23} color={accent} /></View>
              <View className="flex-1">
                <Text className="text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>{generalReport ? 'Platform concern' : 'Reporting'}</Text>
                <Text className="text-base font-semibold leading-6" style={{ color: colors.text }}>{targetName}</Text>
              </View>
            </View>
            <Text className="text-sm leading-6 mt-3" style={{ color: colors.textSecondary }}>Tell us what happened so the admin team can review your concern.</Text>
          </View>
          <View className="rounded-3xl border p-5 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Text className="text-base font-semibold" style={{ color: colors.text }}>Reason for reporting</Text>
            <Text className="text-xs leading-5 mt-1 mb-3" style={{ color: colors.textSecondary }}>Choose the option that best describes the issue.</Text>
            {REPORT_REASONS.map((reason) => {
              const selected = selectedReason === reason.key;
              return (
                <TouchableOpacity key={reason.key} onPress={() => setSelectedReason(reason.key)} disabled={submitting || submitted} accessibilityRole="radio" accessibilityState={{ selected, disabled: submitting || submitted }} activeOpacity={0.75}
                  className="min-h-14 flex-row items-center gap-3 rounded-2xl border p-3 mb-2"
                  style={{ backgroundColor: selected ? accentSurface : colors.background, borderColor: selected ? accent : colors.border }}>
                  <MaterialIcons name={reason.icon} size={21} color={selected ? accent : colors.textSecondary} />
                  <Text className="flex-1 text-sm font-medium leading-5" style={{ color: selected ? accent : colors.text }}>{reason.label}</Text>
                  <MaterialIcons name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={selected ? accent : colors.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Text className="text-base font-semibold" style={{ color: colors.text }}>What happened? <Text style={{ color: accent }}>*</Text></Text>
            <Text className="text-xs leading-5 mt-1 mb-3" style={{ color: colors.textSecondary }}>Include relevant details about the incident, rate discrepancy, or safety issue.</Text>
            <TextInput ref={explanationRef} multiline scrollEnabled value={description} onChangeText={setDescription} editable={!submitting && !submitted} maxLength={2000}
              onFocus={() => { explanationFocused.current = true; keyboardTop.current = Keyboard.metrics()?.screenY ?? keyboardTop.current; revealExplanation(); }}
              onBlur={() => { explanationFocused.current = false; }}
              onContentSizeChange={revealExplanation} onSelectionChange={revealExplanation}
              placeholder="Describe your concern..." placeholderTextColor={colors.textSecondary} textAlignVertical="top" accessibilityLabel="Report explanation"
              className="rounded-2xl border p-4 text-sm leading-6" style={{ height: viewportHeight > 0 ? Math.min(180, Math.max(72, viewportHeight - keyboardOverlap - 32)) : 180, backgroundColor: colors.background, borderColor: colors.border, color: colors.text }} />
            <Text className="text-xs text-right mt-2" style={{ color: colors.textSecondary }}>{description.length}/2,000</Text>
            <View className="flex-row items-start gap-2 mt-4"><MaterialIcons name="lock-outline" size={17} color={colors.textSecondary} /><Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>Your report will be reviewed confidentially by DiskarTech administrators.</Text></View>
          </View>
          <View className="flex-row gap-3 mt-5">
            <TouchableOpacity onPress={goBack} disabled={submitting} activeOpacity={0.75} accessibilityRole="button" className="flex-1 min-h-14 items-center justify-center rounded-2xl border px-3" style={{ backgroundColor: colors.surface, borderColor: colors.border, opacity: submitting ? 0.5 : 1 }}><Text className="text-sm font-semibold" style={{ color: colors.text }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} disabled={submitting || submitted} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Submit report" accessibilityState={{ disabled: submitting || submitted, busy: submitting }} className="flex-[2] min-h-14 flex-row items-center justify-center gap-2 rounded-2xl px-3" style={{ backgroundColor: colors.primary, opacity: submitted ? 0.5 : 1 }}>
              {submitting && <ActivityIndicator size="small" color="#FFFFFF" />}<Text className="text-sm font-semibold text-white">{submitting ? 'Submitting...' : 'Submit report'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <NotificationModal visible={!!notice} title={notice?.title || ''} message={notice?.message || ''} iconName={notice?.success ? 'check-circle-outline' : 'error-outline'} iconColor={notice?.success ? '#15803D' : '#DC2626'} iconBgColor={notice?.success ? 'bg-emerald-50' : 'bg-red-50'} primaryButtonText={notice?.success ? 'Done' : 'OK'}
        onPrimaryPress={() => { const shouldReturn = notice?.success; setNotice(null); if (shouldReturn) goBack(); }} />
    </KeyboardAvoidingView>
  );
}
