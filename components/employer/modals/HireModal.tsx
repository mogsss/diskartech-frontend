import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AVAILABLE_DAYS, TIME_SLOTS, parseTimeSlots, serializeTimeSlots, toggleTimeSlot } from '@/data/jobSchedule';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { isAxiosError } from 'axios';
import { getSalaryUnit } from '@/utils/jobRate';
import { sanitizePlainText, containsMarkup, isValidCompensation } from '@/utils/plainTextInput';
import WeeklyScheduleSummary from '@/components/schedule/WeeklyScheduleSummary';
import { ScheduleSlot } from '@/utils/weeklySchedule';

function startOfDay(value = new Date()): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

interface HireModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    start_date: string;
    end_date: string;
    work_schedule: string;
    agreed_rate: string;
    special_instructions: string;
    contract_terms: string;
  }) => Promise<void> | void;
  studentName?: string;
  jobTitle?: string;
  defaultRate?: string;
  defaultSalaryType?: string | null;
  defaultWorkDays?: string | string[] | null;
  defaultWorkHours?: string | null;
  defaultScheduleSlots?: ScheduleSlot[];
}

function parsePostedWorkDays(value: string | string[] | null): string[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = value; }
  }
  const days = Array.isArray(parsed) ? parsed : typeof parsed === 'string' ? parsed.split(',') : [];
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return [...new Set(days
    .filter((day): day is string => typeof day === 'string' && !!day.trim())
    .map((day) => AVAILABLE_DAYS.find((option, index) => [option, fullDayNames[index]].some((name) => name.toLowerCase() === day.trim().toLowerCase())) || day.trim()))];
}

function HireSection({ title, icon, children }: { title: string; icon: keyof typeof MaterialIcons.glyphMap; children: React.ReactNode }) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-center gap-2 mb-4">
        <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={16} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function HireModal({
  visible,
  onClose,
  onSubmit,
  studentName = 'Student Applicant',
  jobTitle = 'Job Position',
  defaultRate = '',
  defaultSalaryType = 'day',
  defaultWorkDays = [],
  defaultWorkHours = '',
  defaultScheduleSlots,
}: HireModalProps) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const accentColor = isDark ? colors.accent : '#B91C1C';
  const inputBackground = isDark ? colors.background : '#F8FAFC';
  const rateUnit = getSalaryUnit(defaultSalaryType);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [agreedRate, setAgreedRate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [contractTerms, setContractTerms] = useState(
    '• Both parties may terminate this contract with at least 3 days prior written notice.\n• Immediate termination applies in cases of misconduct or violation of agreed terms.\n• Agreed payment to be disbursed on time upon completion of assigned work.'
  );
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [modalHeight, setModalHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const modalRef = useRef<View>(null);
  const viewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const rateRef = useRef<TextInput>(null);
  const termsRef = useRef<TextInput>(null);
  const instructionsRef = useRef<TextInput>(null);
  const focusedInput = useRef<TextInput | null>(null);
  const keyboardTop = useRef<number | null>(null);
  const scrollOffset = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealFocusedInput = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      if (keyboardTop.current === null) return;
      const input = focusedInput.current;
      input?.measureInWindow((_x, inputY, _width, inputHeight) => {
        viewportRef.current?.measureInWindow((_left, viewportY, _w, viewportHeight) => {
          if (focusedInput.current !== input || keyboardTop.current === null || viewportHeight <= 0) return;
          const bottom = Math.min(viewportY + viewportHeight, keyboardTop.current) - 16;
          const delta = inputY + Math.min(inputHeight, bottom - viewportY) > bottom
            ? inputY + Math.min(inputHeight, bottom - viewportY) - bottom
            : inputY < viewportY ? inputY - viewportY : 0;
          if (Math.abs(delta) > 1) {
            scrollRef.current?.scrollTo({ y: Math.max(0, scrollOffset.current + delta), animated: true });
          }
        });
      });
    }, 100);
  }, []);

  const updateKeyboardLayout = useCallback(() => {
    modalRef.current?.measureInWindow((_x, y, _width, height) => {
      // Account only for actual overlap: Android may already resize the modal.
      setModalHeight(height);
      setKeyboardInset(keyboardTop.current === null ? 0 : Math.max(0, y + height - keyboardTop.current));
      revealFocusedInput();
    });
  }, [revealFocusedInput]);

  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardVisible(true);
      updateKeyboardLayout();
    });
    const change = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      if (keyboardTop.current !== null) {
        keyboardTop.current = event.endCoordinates.screenY;
        updateKeyboardLayout();
      }
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardVisible(false);
      setKeyboardInset(0);
    });
    return () => {
      show.remove(); change.remove(); hide.remove();
      keyboardTop.current = null;
      focusedInput.current = null;
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [visible, updateKeyboardLayout]);

  // Date Pickers state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(() => startOfDay());
  const [tempEndDate, setTempEndDate] = useState(() => startOfDay());
  const today = startOfDay();
  const minimumEndDate = startDate ? tempStartDate : today;
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName: keyof typeof MaterialIcons.glyphMap;
  }>({ visible: false, title: '', message: '', iconName: 'error-outline' });

  const closeNotification = () => setNotification((current) => ({ ...current, visible: false }));
  const showNotice = (title: string, message: string, iconName: keyof typeof MaterialIcons.glyphMap = 'error-outline') => {
    Keyboard.dismiss();
    setNotification({ visible: true, title, message, iconName });
  };

  const postedDaysKey = JSON.stringify(parsePostedWorkDays(defaultWorkDays));
  const postedWorkHours = (defaultWorkHours ?? '').trim();
  const dayOptions = [...new Set([...AVAILABLE_DAYS, ...parsePostedWorkDays(defaultWorkDays)])];
  const timeOptions = [...new Set([...TIME_SLOTS, ...parseTimeSlots(postedWorkHours)])];
  const workSchedule = defaultScheduleSlots?.length ? 'Weekly hours from job post' : [selectedDays.join(', '), serializeTimeSlots(selectedTimeSlots)].filter(Boolean).join(' \u2022 ');

  useEffect(() => {
    if (visible) {
      if (defaultRate) {
        setAgreedRate((currentRate) => currentRate || defaultRate.replace(/[^0-9.]/g, ''));
      }
      setAgreedToTerms(true);
    }
  }, [visible, defaultRate]);

  useEffect(() => {
    if (visible) {
      setSelectedDays(JSON.parse(postedDaysKey));
      setSelectedTimeSlots(parseTimeSlots(postedWorkHours));
    }
  }, [visible, postedDaysKey, postedWorkHours]);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      setKeyboardVisible(false);
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
      setNotification((current) => current.visible ? { ...current, visible: false } : current);
    }
  }, [visible]);

  const handleToggleDay = (day: string) => {
    setSelectedDays((currentDays) => currentDays.includes(day)
      ? currentDays.filter((selected) => selected !== day)
      : [...currentDays, day]);
  };

  // Android reopens/updates its native dialog when onChange changes during polling.
  const onStartDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios' && event.type === 'set');
    if (event.type === 'set' && selectedDate) {
      setTempStartDate(startOfDay(selectedDate));
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      setStartDate(selectedDate.toLocaleDateString('en-US', options));
    }
  }, []);

  const onEndDateChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios' && event.type === 'set');
    if (event.type === 'set' && selectedDate) {
      setTempEndDate(startOfDay(selectedDate));
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      setEndDate(selectedDate.toLocaleDateString('en-US', options));
    }
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!startDate.trim()) {
      showNotice('Start Date Required', 'Please select the contract start date.', 'calendar-today');
      return;
    }
    if (endDate && endDate !== 'Until Project Completion' && tempEndDate < tempStartDate) {
      showNotice('Invalid End Date', 'The contract end date cannot be earlier than the start date.', 'event');
      return;
    }
    if (!defaultScheduleSlots?.length && selectedDays.length === 0) {
      showNotice('Work Days Required', 'Please select at least one work day.', 'calendar-today');
      return;
    }
    if (!defaultScheduleSlots?.length && selectedTimeSlots.length === 0) {
      showNotice('Working Hours Required', 'Please select the agreed working hours.', 'schedule');
      return;
    }
    if (!agreedRate.trim()) {
      showNotice('Compensation Required', 'Please enter the agreed compensation rate.', 'payments');
      return;
    }
    const cleanRate = sanitizePlainText(agreedRate);
    const cleanInstructions = sanitizePlainText(specialInstructions);
    const cleanTerms = sanitizePlainText(contractTerms);
    if (!isValidCompensation(cleanRate)) {
      showNotice('Invalid Compensation', 'Enter a positive amount with up to 9 whole-number digits and 2 decimal places.', 'payments');
      return;
    }
    if (!cleanTerms || cleanTerms.length > 2000 || cleanInstructions.length > 2000 || workSchedule.length > 255) {
      showNotice('Invalid Contract Details', 'Contract terms are required. Terms and instructions must be within 2,000 characters, and the schedule within 255 characters.');
      return;
    }
    if ([cleanInstructions, cleanTerms, workSchedule].some(containsMarkup)) {
      showNotice('Invalid Text', 'Use plain text for contract details. HTML and script tags are not allowed.');
      return;
    }
    if (!agreedToTerms) {
      showNotice('Contract Agreement', 'Please confirm and agree to the contract terms before submitting.', 'verified-user');
      return;
    }

    try {
      Keyboard.dismiss();
      setIsSubmitting(true);
      await onSubmit({
        start_date: startDate.trim(),
        end_date: endDate.trim() || 'Indefinite / Project-based',
        work_schedule: sanitizePlainText(workSchedule),
        agreed_rate: cleanRate,
        special_instructions: cleanInstructions,
        contract_terms: cleanTerms,
      });
    } catch (error: unknown) {
      console.error('Error submitting hire details:', error);
      const fallbackMessage = 'Unable to hire this student right now. Please try again.';
      const serverMessage = isAxiosError(error) ? error.response?.data?.message : undefined;
      const message = typeof serverMessage === 'string' && serverMessage.trim()
        ? serverMessage
        : !isAxiosError(error) && error instanceof Error && error.message ? error.message : fallbackMessage;
      showNotice('Hiring Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      Keyboard.dismiss();
      focusedInput.current = null;
      closeNotification();
      onClose();
    }
  };
  const fieldStyle = {
    backgroundColor: inputBackground,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    minHeight: 48,
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onRequestClose={handleClose}>
      <View ref={modalRef} onLayout={updateKeyboardLayout} style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardInset }}>
        <View className="rounded-t-[28px] overflow-hidden border-t" style={{ height: modalHeight > 0 ? Math.max(0, modalHeight - keyboardInset) * 0.9 : '90%', backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="px-5 pt-3 pb-3 border-b" style={{ borderBottomColor: colors.border }}>
            <View className="w-9 h-1 rounded-full self-center mb-3" style={{ backgroundColor: colors.border }} />
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-lg font-bold tracking-tight" style={{ color: colors.text }}>Hire student</Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>Review the employment contract and job offer</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Close hire modal"
                activeOpacity={0.7}
                className="w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: inputBackground, opacity: isSubmitting ? 0.5 : 1 }}
              >
                <MaterialIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View ref={viewportRef} onLayout={revealFocusedInput} style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View className="flex-row items-start gap-3 rounded-2xl border p-4 mb-4" style={{ backgroundColor: inputBackground, borderColor: colors.border }}>
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2' }}>
                <MaterialIcons name="person-outline" size={23} color={accentColor} />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-semibold tracking-wide mb-1" style={{ color: colors.textSecondary }}>JOB OFFER FOR</Text>
                <Text className="text-base font-semibold leading-6" style={{ color: colors.text }}>{studentName}</Text>
                <Text className="text-xs leading-5 mt-0.5" style={{ color: colors.textSecondary }}>{jobTitle}</Text>
              </View>
            </View>

            <HireSection title="Contract schedule" icon="calendar-today">
              <View className="mb-4">
                <Text className="text-xs font-medium mb-2" style={{ color: colors.text }}>Start date <Text style={{ color: accentColor }}>*</Text></Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowEndDatePicker(false);
                    setShowStartDatePicker(true);
                  }}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Select contract start date"
                  activeOpacity={0.7}
                  className="flex-row items-center gap-2 rounded-xl border px-3 py-3"
                  style={fieldStyle}
                >
                  <Text className="flex-1 text-sm" style={{ color: startDate ? colors.text : colors.textSecondary }}>{startDate || 'Select start date'}</Text>
                  <MaterialIcons name="calendar-today" size={17} color={colors.textSecondary} />
                </TouchableOpacity>
                {showStartDatePicker && (
                  <View className="mt-2">
                    <DateTimePicker value={tempStartDate < today ? today : tempStartDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartDateChange} minimumDate={today} themeVariant={isDark ? 'dark' : 'light'} />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setShowStartDatePicker(false)} accessibilityRole="button" accessibilityLabel="Done selecting start date" className="self-end px-3 py-2">
                        <Text className="text-xs font-semibold" style={{ color: accentColor }}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
              <View className="mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-xs font-medium" style={{ color: colors.text }}>End date</Text>
                  <Text className="text-[10px]" style={{ color: colors.textSecondary }}>Optional</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowStartDatePicker(false);
                    setShowEndDatePicker(true);
                  }}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Select contract end date"
                  activeOpacity={0.7}
                  className="flex-row items-center gap-2 rounded-xl border px-3 py-3"
                  style={fieldStyle}
                >
                  <Text className="flex-1 text-sm" style={{ color: endDate ? colors.text : colors.textSecondary }}>{endDate || 'Select an end date'}</Text>
                  <MaterialIcons name="event" size={17} color={colors.textSecondary} />
                </TouchableOpacity>
                {showEndDatePicker && (
                  <View className="mt-2">
                    <DateTimePicker value={tempEndDate < minimumEndDate ? minimumEndDate : tempEndDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onEndDateChange} minimumDate={minimumEndDate} themeVariant={isDark ? 'dark' : 'light'} />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setShowEndDatePicker(false)} accessibilityRole="button" accessibilityLabel="Done selecting end date" className="self-end px-3 py-2">
                        <Text className="text-xs font-semibold" style={{ color: accentColor }}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => { setEndDate('Until Project Completion'); setShowEndDatePicker(false); }}
                  accessibilityRole="button"
                  accessibilityLabel="Set contract until project completion"
                  accessibilityState={{ selected: endDate === 'Until Project Completion' }}
                  activeOpacity={0.7}
                  className="self-start flex-row items-center gap-1.5 rounded-lg border px-2.5 py-2 mt-2"
                  style={{ backgroundColor: endDate === 'Until Project Completion' ? (isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2') : inputBackground, borderColor: endDate === 'Until Project Completion' ? (isDark ? 'rgba(248, 113, 113, 0.25)' : '#FECACA') : colors.border }}
                >
                  <MaterialIcons name={endDate === 'Until Project Completion' ? 'check' : 'all-inclusive'} size={14} color={accentColor} />
                  <Text className="text-[11px] font-medium" style={{ color: accentColor }}>Until project completion</Text>
                </TouchableOpacity>
              </View>
              {defaultScheduleSlots?.length ? <View style={{ gap: 12 }}><WeeklyScheduleSummary slots={defaultScheduleSlots} /><Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 20 }}>These hours come from the job post. Availability and active contract conflicts are checked again when hiring is confirmed.</Text></View> : <>
              <Text className="text-[11px] leading-5 mb-3" style={{ color: colors.textSecondary }}>Pre-selected from your job post. Adjust as agreed with the student.</Text>
              <Text className="text-xs font-medium mb-2" style={{ color: colors.text }}>Work days <Text style={{ color: accentColor }}>*</Text></Text>
              <View className="flex-row flex-wrap gap-1 mb-5">
                {dayOptions.map((day) => {
                  const selected = selectedDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => handleToggleDay(day)}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                      accessibilityLabel={'Work day ' + day}
                      accessibilityState={{ selected, disabled: isSubmitting }}
                      activeOpacity={0.7}
                      className="items-center justify-center rounded-xl border px-1 py-3"
                      style={{ flexBasis: AVAILABLE_DAYS.includes(day) ? '12%' : 'auto', flexGrow: 1, minHeight: 44, backgroundColor: selected ? (isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2') : inputBackground, borderColor: selected ? accentColor : colors.border, opacity: isSubmitting ? 0.5 : 1 }}
                    >
                      <Text className="text-[11px] font-semibold" style={{ color: selected ? accentColor : colors.textSecondary }}>{day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text className="text-xs font-medium mb-2" style={{ color: colors.text }}>Working hours <Text style={{ color: accentColor }}>*</Text></Text>
              <Text className="text-[11px] leading-5 mb-3" style={{ color: colors.textSecondary }}>Choose up to 2 time slots, or select Whole Day.</Text>
              <View className="flex-row flex-wrap gap-2">
                {timeOptions.map((slot, index) => {
                  const selected = selectedTimeSlots.includes(slot);
                  const disabled = isSubmitting || (!selected && slot !== 'Whole Day' && selectedTimeSlots.length >= 2);
                  const slotIcon = (['wb-sunny', 'light-mode', 'dark-mode', 'schedule'] as const)[index] ?? 'schedule';
                  return (
                    <TouchableOpacity
                      key={slot}
                      onPress={() => setSelectedTimeSlots((current) => toggleTimeSlot(current, slot))}
                      disabled={disabled}
                      accessibilityRole="checkbox"
                      accessibilityLabel={'Working hours ' + slot}
                      accessibilityState={{ checked: selected, disabled }}
                      activeOpacity={0.7}
                      className="rounded-2xl border p-3"
                      style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: selected ? (isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2') : inputBackground, borderColor: selected ? accentColor : colors.border, opacity: disabled ? 0.5 : 1 }}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <MaterialIcons name={slotIcon} size={19} color={selected ? accentColor : colors.textSecondary} />
                        <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={16} color={selected ? accentColor : colors.textSecondary} />
                      </View>
                      <Text className="text-xs font-semibold mb-1" style={{ color: selected ? accentColor : colors.text }}>{slot.split(' (')[0]}</Text>
                      <Text className="text-[10px] leading-4" style={{ color: colors.textSecondary }}>{slot.includes(' (') ? slot.split(' (')[1].replace(')', '') : slot === 'Whole Day' ? 'Full day schedule' : 'From job post'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              </>}
            </HireSection>

            <HireSection title="Agreed compensation" icon="payments">
              <Text className="text-xs font-medium mb-2" style={{ color: colors.text }}>Compensation rate <Text style={{ color: accentColor }}>*</Text></Text>
              <View className="flex-row items-center rounded-xl border px-3" style={{ backgroundColor: inputBackground, borderColor: colors.border }}>
                <Text className="text-base font-semibold mr-2" style={{ color: colors.textSecondary }}>{'\u20B1'}</Text>
                <TextInput
                  ref={rateRef}
                  onFocus={() => { focusedInput.current = rateRef.current; revealFocusedInput(); }}
                  onBlur={() => { if (focusedInput.current === rateRef.current) focusedInput.current = null; }}
                  value={agreedRate}
                  onChangeText={(value) => { if (/^\d{0,9}(?:\.\d{0,2})?$/.test(value)) setAgreedRate(value); }}
                  maxLength={12}
                  editable={!isSubmitting}
                  accessibilityLabel={`Agreed compensation in pesos ${getSalaryUnit(defaultSalaryType, 'long')}`}
                  placeholder="e.g. 500"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  className="flex-1 py-3"
                  style={{ minHeight: 48, color: colors.text, fontSize: 14 }}
                />
                <Text className="text-sm font-medium ml-2" style={{ color: colors.textSecondary }}>{rateUnit}</Text>
              </View>
              <Text className="text-[11px] leading-5 mt-2" style={{ color: colors.textSecondary }}>Payment basis follows the job post: {getSalaryUnit(defaultSalaryType, 'long')}. Adjust the amount as agreed with the student.</Text>
            </HireSection>

            <HireSection title="Contract terms" icon="gavel">
              <TextInput
                ref={termsRef}
                onFocus={() => { focusedInput.current = termsRef.current; revealFocusedInput(); }}
                onBlur={() => { if (focusedInput.current === termsRef.current) focusedInput.current = null; }}
                onContentSizeChange={revealFocusedInput}
                value={contractTerms}
                onChangeText={setContractTerms}
                maxLength={2000}
                editable={!isSubmitting}
                accessibilityLabel="Contract terms and termination conditions"
                multiline
                numberOfLines={6}
                placeholder="Notice period, termination conditions, and work rules"
                placeholderTextColor={colors.textSecondary}
                textAlignVertical="top"
                className="rounded-xl border px-3 py-3"
                style={{ ...fieldStyle, minHeight: 170, lineHeight: 22, fontSize: 13 }}
              />
              <Text className="text-[11px] leading-5 mt-2" style={{ color: colors.textSecondary }}>These terms will be visible to you and the student. Include the agreed notice period and termination conditions.</Text>
            </HireSection>

            <HireSection title="First-day instructions" icon="assignment">
              <Text className="text-[11px] mb-2" style={{ color: colors.textSecondary }}>Optional</Text>
              <TextInput
                ref={instructionsRef}
                onFocus={() => { focusedInput.current = instructionsRef.current; revealFocusedInput(); }}
                onBlur={() => { if (focusedInput.current === instructionsRef.current) focusedInput.current = null; }}
                onContentSizeChange={revealFocusedInput}
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                maxLength={2000}
                editable={!isSubmitting}
                accessibilityLabel="First-day instructions"
                multiline
                numberOfLines={3}
                placeholder="What to bring, dress code, or who to contact on arrival"
                placeholderTextColor={colors.textSecondary}
                textAlignVertical="top"
                className="rounded-xl border px-3 py-3"
                style={{ ...fieldStyle, minHeight: 100, lineHeight: 21, fontSize: 13 }}
              />
            </HireSection>

            <TouchableOpacity
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              accessibilityRole="checkbox"
              accessibilityLabel="Approve the employment contract terms, rate, and schedule"
              accessibilityState={{ checked: agreedToTerms }}
              activeOpacity={0.7}
              className="flex-row items-start gap-2.5 rounded-2xl border p-3"
              style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.08)' : '#FEF2F2', borderColor: isDark ? 'rgba(248, 113, 113, 0.25)' : '#FECACA' }}
            >
              <MaterialIcons name={agreedToTerms ? 'check-box' : 'check-box-outline-blank'} size={21} color={accentColor} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-xs leading-5" style={{ color: colors.text }}>I approve this applicant under the stated employment contract terms, compensation, and schedule.</Text>
            </TouchableOpacity>
          </ScrollView>
          </View>

          <View className="px-5 pt-3 border-t" style={{ paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 16), backgroundColor: colors.surface, borderTopColor: colors.border }}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={handleClose}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Cancel hiring"
                activeOpacity={0.7}
                className="flex-1 items-center justify-center rounded-2xl border px-3 py-3"
                style={{ minHeight: 48, backgroundColor: inputBackground, borderColor: colors.border, opacity: isSubmitting ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Accept and hire student"
                accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
                activeOpacity={0.8}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 py-3"
                style={{ flex: 1.6, minHeight: 48, opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="check-circle-outline" size={18} color="#FFFFFF" />}
                <Text className="text-sm font-semibold text-white">{isSubmitting ? 'Processing...' : 'Accept & Hire'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      </View>
      <NotificationModal
        visible={visible && notification.visible}
        title={notification.title}
        message={notification.message}
        iconName={notification.iconName}
        iconColor="#DC2626"
        iconBgColor="bg-red-50"
        primaryButtonText="OK"
        onPrimaryPress={closeNotification}
      />
    </Modal>
  );
}
