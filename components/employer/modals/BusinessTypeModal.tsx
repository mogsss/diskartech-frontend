import InputField from '@/components/ui/InputField';
import InputSuggestions from '@/components/ui/InputSuggestions';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { BUSINESS_TYPES, BUSINESS_TYPE_SUGGESTIONS } from '@/data/businessTypes';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BusinessTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  selectedType: string;
}

export default function BusinessTypeModal({ visible, onClose, onSelect, selectedType }: BusinessTypeModalProps) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [customMode, setCustomMode] = useState(false);
  const [customType, setCustomType] = useState('');
  const [error, setError] = useState('');
  const [modalShown, setModalShown] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [bodyHeights, setBodyHeights] = useState({ presets: 0, custom: 0 });
  const bottomPadding = keyboardVisible ? 12 : Math.max(insets.bottom, 16);
  const bodyHeight = bodyHeights[customMode ? 'custom' : 'presets'];
  const contentMeasured = headerHeight > 0 && bodyHeight > 0 && (!customMode || footerHeight > 0);
  const contentHeight = headerHeight + bodyHeight + (customMode ? footerHeight : 0) + bottomPadding;
  const sheetHeight = Math.max(0, Math.min(
    (availableHeight || windowHeight) - insets.top - 12,
    contentMeasured ? contentHeight : customMode ? 480 : 560,
  ));
  const accentText = isDark ? colors.accent : colors.primary;
  const isPreset = (value: string) => BUSINESS_TYPES.some((type) => type === value);
  const isOtherLabel = (value: string) => ['Other / General Business', 'Others', 'Other'].includes(value);

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      return;
    }
    setKeyboardVisible(Keyboard.isVisible());
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setModalShown(false);
      setAvailableHeight(0);
      return;
    }
    const isCustom = !!selectedType && !BUSINESS_TYPES.some((type) => type === selectedType);
    setCustomMode(isCustom);
    setCustomType(isCustom && !['Other / General Business', 'Others', 'Other'].includes(selectedType) ? selectedType : '');
    setError('');
  }, [visible, selectedType]);

  const handleClose = () => {
    Keyboard.dismiss();
    setModalShown(false);
    onClose();
  };

  const handleCustomChange = (value: string) => {
    setCustomType(value);
    setError('');
  };

  const handleConfirm = () => {
    const value = customType.trim();
    if (!value || isOtherLabel(value)) {
      setError('Please specify your business type.');
      return;
    }
    if (value.length > 255) {
      setError('Please keep the business type within 255 characters.');
      return;
    }
    onSelect(value);
    handleClose();
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="slide" onShow={() => setModalShown(true)} onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        {/* Disable Android keyboard padding after hide to avoid a gap below the sheet. */}
        <KeyboardAvoidingView behavior="padding" enabled={Platform.OS !== 'android' || keyboardVisible} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 12 }} onLayout={({ nativeEvent }) => setAvailableHeight(nativeEvent.layout.height)}>
            <View className="rounded-t-3xl" style={{ height: sheetHeight, backgroundColor: colors.surface, paddingBottom: bottomPadding }}>
              <View className="flex-row items-center gap-3 px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: colors.border }} onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}>
                {customMode && <TouchableOpacity onPress={() => { Keyboard.dismiss(); setCustomMode(false); setError(''); }} accessibilityRole="button" accessibilityLabel="Back to business types" className="w-10 h-10 items-center justify-center">
                  <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>}
                <View className="flex-1">
                  <Text className="text-lg font-bold" style={{ color: colors.text }}>{customMode ? 'Specify business type' : 'Select business type'}</Text>
                  <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{customMode ? 'Type your own or choose a suggestion.' : 'Choose the category that fits your business.'}</Text>
                </View>
                <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close business type modal" className="w-10 h-10 items-center justify-center">
                  <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView key={customMode ? 'custom-type' : 'business-types'} style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }} onContentSizeChange={(_, height) => {
                const mode = customMode ? 'custom' : 'presets';
                setBodyHeights((previous) => previous[mode] === height ? previous : { ...previous, [mode]: height });
              }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {customMode ? modalShown && <>
                  <InputField label="Business type *" placeholder="e.g., Laundry Shop" value={customType} onChangeText={handleCustomChange} icon="store" autoCapitalize="words" autoFocus maxLength={255} returnKeyType="done" onSubmitEditing={handleConfirm} error={error || undefined} />
                  <InputSuggestions value={customType} options={BUSINESS_TYPE_SUGGESTIONS} label="Suggested business types" onChangeText={handleCustomChange} multiple={false} />
                  <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>You can also use a business type that isn’t in the suggestions.</Text>
                </> : <>
                  {BUSINESS_TYPES.map((item) => (
                    <TouchableOpacity key={item} onPress={() => { onSelect(item); handleClose(); }} accessibilityRole="button" accessibilityLabel={`Select ${item}`} accessibilityState={{ selected: selectedType === item }} activeOpacity={0.75} className="py-3.5 border-b flex-row items-center gap-3" style={{ borderBottomColor: colors.border }}>
                      <Text className={`flex-1 text-sm leading-5 ${selectedType === item ? 'font-bold' : 'font-medium'}`} style={{ color: selectedType === item ? accentText : colors.text }}>{item}</Text>
                      {selectedType === item && <MaterialIcons name="check" size={20} color={accentText} />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={() => { setCustomMode(true); setCustomType(isPreset(selectedType) || isOtherLabel(selectedType) ? '' : selectedType); setError(''); }} accessibilityRole="button" accessibilityLabel="Others, specify your business type" accessibilityState={{ selected: !!selectedType && !isPreset(selectedType) }} activeOpacity={0.75} className="py-3.5 flex-row items-center gap-3">
                    <View className="flex-1"><Text className="text-sm font-semibold" style={{ color: colors.text }}>Others</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Specify a different business type</Text></View>
                    <MaterialIcons name="chevron-right" size={23} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>}
              </ScrollView>

              {customMode && <View className="px-6 pt-3 border-t shrink-0" style={{ borderColor: colors.border }} onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)}>
                <PrimaryButton title="Use business type" onPress={handleConfirm} size="medium" />
              </View>}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
