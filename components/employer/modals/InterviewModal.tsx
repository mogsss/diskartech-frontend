import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDarkMode } from '@/hooks/useDarkMode';
import { ToastViewport } from '@/hooks/useToast';
import { formatInterviewTime } from '@/utils/interviewTime';

interface InterviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (interviewType: string, date: string, time: string, location: string) => void;
  date: string;
  setDate: (val: string) => void;
  time: string;
  setTime: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  defaultAddress: string;
  initialType?: 'walk-in' | 'online';
  loading?: boolean;
  notification?: React.ReactNode;
}

export default function InterviewModal({
  visible,
  onClose,
  onSubmit,
  date,
  setDate,
  time,
  setTime,
  location,
  setLocation,
  defaultAddress,
  initialType = 'walk-in',
  loading = false,
  notification,
}: InterviewModalProps) {
  const { colors, isDark } = useDarkMode();
  const [interviewType, setInterviewType] = useState<'walk-in' | 'online'>('walk-in');
  const wasVisible = useRef(false);
  const locationDrafts = useRef({ 'walk-in': '', online: '' });

  // States para sa pagpapakita ng Native Date/Time Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      setShowDatePicker(false);
      setShowTimePicker(false);
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;
    setInterviewType(initialType);
    locationDrafts.current = {
      'walk-in': initialType === 'walk-in' ? location : defaultAddress,
      online: initialType === 'online' ? location : '',
    };
  }, [visible, initialType, location, defaultAddress]);

  const handleTypeChange = (type: 'walk-in' | 'online') => {
    if (loading || type === interviewType) return;
    locationDrafts.current[interviewType] = location;
    setInterviewType(type);
    setLocation(locationDrafts.current[type]);
  };

  // I-handle ang pagpili ng Date mula sa Native Calendar
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setTempDate(selectedDate);
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      setDate(selectedDate.toLocaleDateString('en-US', options));
    }
  };

  // I-handle ang pagpili ng Time mula sa Native Clock picker
  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setTime(formatInterviewTime(selectedTime));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => { if (!loading) onClose(); }}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'flex-end' }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            width: '100%',
            maxHeight: '85%',
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>Schedule Interview</Text>
            <TouchableOpacity onPress={onClose} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 20 }}>
            This will send an invite and automatically message the student via chat.
          </Text>
          
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Interview Type Selector */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Interview Type
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => handleTypeChange('walk-in')}
                disabled={loading}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  backgroundColor: interviewType === 'walk-in'
                    ? (isDark ? 'rgba(220, 38, 38, 0.18)' : '#FEF2F2')
                    : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC'),
                  borderColor: interviewType === 'walk-in' ? '#DC2626' : colors.border,
                }}
              >
                <MaterialIcons
                  name="store"
                  size={18}
                  color={interviewType === 'walk-in' ? '#DC2626' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: interviewType === 'walk-in' ? (isDark ? colors.accent : '#DC2626') : colors.text,
                  }}
                >
                  Walk-In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleTypeChange('online')}
                disabled={loading}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  backgroundColor: interviewType === 'online'
                    ? (isDark ? 'rgba(220, 38, 38, 0.18)' : '#FEF2F2')
                    : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC'),
                  borderColor: interviewType === 'online' ? '#DC2626' : colors.border,
                }}
              >
                <MaterialIcons
                  name="videocam"
                  size={18}
                  color={interviewType === 'online' ? '#DC2626' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: interviewType === 'online' ? (isDark ? colors.accent : '#DC2626') : colors.text,
                  }}
                >
                  Online
                </Text>
              </TouchableOpacity>
            </View>

            {/* Interview Date Picker Trigger */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Interview Date
            </Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              disabled={loading}
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 14, color: date ? colors.text : colors.textSecondary }}>
                {date || 'Select interview date'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color={colors.accent} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}

            {/* Interview Time Picker Trigger */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Interview Time
            </Text>
            <TouchableOpacity 
              onPress={() => setShowTimePicker(true)}
              disabled={loading}
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 14, color: time ? colors.text : colors.textSecondary }}>
                {time || 'Select interview time'}
              </Text>
              <MaterialIcons name="access-time" size={20} color={colors.accent} />
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            {/* Location / Venue Input */}
            {interviewType === 'walk-in' ? <>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              Office Address / Venue
            </Text>
            <TextInput
              editable={!loading}
              placeholder="Employer address"
              placeholderTextColor={colors.textSecondary}
              value={location}
              onChangeText={setLocation}
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 14,
                color: colors.text,
                marginBottom: 24,
              }}
            />
            </> : <View className="flex-row gap-3 rounded-2xl p-4 mb-6" style={{ backgroundColor: colors.accent + '12' }}>
              <MaterialIcons name="videocam" size={22} color={colors.accent} />
              <Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>The interview will take place in DiskarTech. You and the student can join the video call from application details.</Text>
            </View>}

            <TouchableOpacity
              onPress={() => onSubmit(interviewType, date, time, location)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              style={{
                width: '100%',
                backgroundColor: '#DC2626',
                paddingVertical: 16,
                borderRadius: 16,
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' }}>Send Interview Invite</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {notification}
      <ToastViewport active={visible} />
    </Modal>
  );
}
