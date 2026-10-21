import InputField from '@/components/ui/InputField';
import { CATEGORY_OPTIONS } from '@/data/jobCategories';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { JobPostingForm } from '@/hooks/useJobPosting';
import { getSalaryUnit } from '@/utils/jobRate';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Keyboard, PanResponder, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import JobFormSection from './JobFormSection';

interface JobDetailsFieldsProps {
  form: JobPostingForm['details'];
  isHousehold?: boolean;
  isCategoryOpen: boolean;
  setIsCategoryOpen: (open: boolean) => void;
  onScrollEnabledChange: (enabled: boolean) => void;
}

export default function JobDetailsFields({ form, isHousehold = false, isCategoryOpen, setIsCategoryOpen, onScrollEnabledChange }: JobDetailsFieldsProps) {
  const { colors, isDark } = useDarkMode();
  const fieldBackground = isDark ? colors.background : '#F8FAFC';
  const accentBackground = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2';
  const accentColor = isDark ? colors.accent : '#B91C1C';
  const {
    jobTitle, setJobTitle, description, setDescription,
    salary, handleSalaryChange, salaryType, setSalaryType,
    selectedCategory, setSelectedCategory, customCategory, setCustomCategory,
  } = form;
  const [isSalaryTypeOpen, setIsSalaryTypeOpen] = useState(false);
  // States at PanResponder para sa textarea corner resize grip (katulad ng browser textarea)
  const [descriptionHeight, setDescriptionHeight] = useState(120);
  const descriptionHeightRef = useRef(120);
  const dragStartHeightRef = useRef(120);
  const isDraggingRef = useRef(false);

  const cornerResizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onScrollEnabledChange(false);
        dragStartHeightRef.current = descriptionHeightRef.current;
        isDraggingRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 4) {
          isDraggingRef.current = true;
        }
        const nextHeight = Math.max(100, Math.min(dragStartHeightRef.current + gestureState.dy, 450));
        descriptionHeightRef.current = nextHeight;
        setDescriptionHeight(nextHeight);
      },
      onPanResponderRelease: () => {
        onScrollEnabledChange(true);
        // Kung simpleng tap lang sa corner icon nang hindi nag-drag, i-toggle ang height
        if (!isDraggingRef.current) {
          const next = descriptionHeightRef.current > 160 ? 120 : 250;
          descriptionHeightRef.current = next;
          setDescriptionHeight(next);
        }
      },
      onPanResponderTerminate: () => {
        onScrollEnabledChange(true);
      },
    })
  ).current;

  return (
    <JobFormSection number="01" title="Job details" subtitle="Tell applicants about the role." icon="work-outline">
      <InputField
        label="Job Title *"
        placeholder="e.g. Service Crew, Barista"
        value={jobTitle}
        onChangeText={setJobTitle}
        icon="work-outline"
      />

      <View className="mb-4">
        <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Job Description *</Text>
        <View
          style={{ height: descriptionHeight, backgroundColor: fieldBackground, borderColor: colors.border }}
          className="border rounded-xl relative overflow-hidden"
        >
          <TextInput
            style={{ flex: 1, padding: 14, paddingBottom: 24, paddingRight: 28, color: colors.text }}
            className="text-sm"
            placeholder="What will the student do? Describe the tasks and expectations."
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
          <View
            {...cornerResizePanResponder.panHandlers}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 6, paddingBottom: 6 }}
          >
            <MaterialCommunityIcons name="resize-bottom-right" size={18} color={colors.textSecondary} />
          </View>
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Pay rate *</Text>
        <View className="flex-row items-center border rounded-xl px-3.5 h-[52px]" style={{ backgroundColor: fieldBackground, borderColor: colors.border }}>
          <Text className="text-lg font-semibold mr-2" style={{ color: colors.textSecondary }}>{'\u20B1'}</Text>
          <TextInput
            className="flex-1 text-base p-0"
            style={{ color: colors.text }}
            placeholder="e.g. 500"
            placeholderTextColor={colors.textSecondary}
            value={salary}
            onChangeText={handleSalaryChange}
            keyboardType="decimal-pad"
            accessibilityLabel={salaryType === 'hour' ? 'Hourly rate in pesos' : 'Daily rate in pesos'}
            onFocus={() => setIsSalaryTypeOpen(false)}
          />
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); setIsSalaryTypeOpen(!isSalaryTypeOpen); }}
            accessibilityRole="button"
            accessibilityLabel={'Pay basis: ' + getSalaryUnit(salaryType, 'long')}
            accessibilityState={{ expanded: isSalaryTypeOpen }}
            className="flex-row items-center justify-center gap-1 min-h-12 pl-3 ml-2 border-l"
            style={{ borderLeftColor: colors.border }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>{getSalaryUnit(salaryType)}</Text>
            <MaterialIcons name={isSalaryTypeOpen ? 'expand-less' : 'expand-more'} size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
        {isSalaryTypeOpen && (
          <View className="mt-2 border rounded-xl p-1 gap-1" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {(['day', 'hour'] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                onPress={() => { setSalaryType(unit); setIsSalaryTypeOpen(false); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: salaryType === unit }}
                accessibilityLabel={unit === 'hour' ? 'Per hour' : 'Per day'}
                className="flex-row items-center justify-between rounded-lg px-3 min-h-12"
                style={{ backgroundColor: salaryType === unit ? accentBackground : colors.surface }}
              >
                <Text className="text-sm font-medium" style={{ color: salaryType === unit ? accentColor : colors.text }}>{unit === 'hour' ? 'Per hour' : 'Per day'}</Text>
                <MaterialIcons name={salaryType === unit ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={salaryType === unit ? colors.accent : colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View>
        <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Job Category</Text>
        <TouchableOpacity
          onPress={() => setIsCategoryOpen(!isCategoryOpen)}
          accessibilityRole="button"
          accessibilityLabel={'Job category: ' + selectedCategory}
          accessibilityState={{ expanded: isCategoryOpen }}
          className="flex-row items-center justify-between border rounded-xl px-3.5 h-[52px]"
          style={{ backgroundColor: fieldBackground, borderColor: colors.border }}
        >
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="category" size={18} color={colors.textSecondary} />
            <Text className="text-sm" style={{ color: colors.text }}>{selectedCategory}</Text>
          </View>
          <MaterialIcons name={isCategoryOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        {isCategoryOpen && (
          <ScrollView
            style={{ maxHeight: 220, flexGrow: 0, backgroundColor: fieldBackground, borderColor: colors.border }}
            className="border rounded-xl mt-2"
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORY_OPTIONS.map((category, index) => {
              const selected = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => { setSelectedCategory(category); setIsCategoryOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className="flex-row items-center justify-between px-3.5 py-3"
                  style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border, backgroundColor: selected ? accentBackground : undefined }}
                >
                  <Text className="text-sm" style={{ color: selected ? accentColor : colors.text, fontWeight: selected ? '600' : '400' }}>{category}</Text>
                  {selected && <MaterialIcons name="check" size={18} color={accentColor} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        {selectedCategory === 'Other' && (
          <View className="mt-3">
            <InputField
              label="Category name *"
              placeholder={isHousehold ? 'e.g. Laundry, Gardening, Quick errands' : 'e.g. Photography, Warehouse'}
              value={customCategory}
              onChangeText={setCustomCategory}
              icon="edit"
              autoFocus
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
        )}
      </View>
    </JobFormSection>
  );
}
