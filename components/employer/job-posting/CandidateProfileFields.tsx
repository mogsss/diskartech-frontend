import InputSuggestions from '@/components/ui/InputSuggestions';
import { REQUIREMENT_SUGGESTIONS } from '@/data/jobRequirements';
import { SKILL_SUGGESTIONS } from '@/data/skills';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { JobPostingForm } from '@/hooks/useJobPosting';
import type { JobPostingInputNavigation, JobPostingInputProps } from '@/hooks/useJobPostingKeyboard';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import JobFormSection from './JobFormSection';

type SuggestionField = 'requirements' | 'skills' | null;

interface CandidateProfileFieldsProps {
  form: JobPostingForm['candidate'];
  inputNavigation: JobPostingInputNavigation;
  activeSuggestionField: SuggestionField;
  setActiveSuggestionField: (field: SuggestionField) => void;
}

export default function CandidateProfileFields({ form, inputNavigation, activeSuggestionField, setActiveSuggestionField }: CandidateProfileFieldsProps) {
  const { colors } = useDarkMode();
  return (
    <JobFormSection number="03" title="Candidate profile" subtitle="Help students see if they are a good fit." icon="person-outline">
      <View className="mb-5">
        <CandidateListInput
          navigation={inputNavigation('requirements', 'skills')}
          label="Requirements"
          placeholder="e.g. Valid ID, Resume"
          value={form.requirementInput}
          onChangeText={form.setRequirementInput}
          items={form.requirements}
          onAdd={form.handleAddRequirement}
          onRemove={form.handleRemoveRequirement}
          suggestions={REQUIREMENT_SUGGESTIONS}
          suggestionsLabel="Suggested requirements"
          addLabel="Add requirements"
          showSuggestions={activeSuggestionField === 'requirements'}
          onFocus={() => setActiveSuggestionField('requirements')}
        />
      </View>
      <View className="border-t pt-4" style={{ borderTopColor: colors.border }}>
        <CandidateListInput
          navigation={inputNavigation('skills')}
          label="Skills Needed"
          placeholder="e.g. Driving, Delivery"
          value={form.skillInput}
          onChangeText={form.setSkillInput}
          items={form.skills}
          onAdd={form.handleAddSkill}
          onRemove={form.handleRemoveSkill}
          suggestions={SKILL_SUGGESTIONS}
          suggestionsLabel="Suggested skills"
          addLabel="Add skills"
          showSuggestions={activeSuggestionField === 'skills'}
          onFocus={() => setActiveSuggestionField('skills')}
        />
      </View>
      <Text className="text-[11px] leading-4 mt-4" style={{ color: colors.textSecondary }}>
        Type your own or select a suggestion. Use commas to add multiple entries.
      </Text>
    </JobFormSection>
  );
}

interface CandidateListInputProps {
  navigation: JobPostingInputProps;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  suggestions: readonly string[];
  suggestionsLabel: string;
  addLabel: string;
  showSuggestions: boolean;
  onFocus: () => void;
}

function CandidateListInput({ navigation, label, placeholder, value, onChangeText, items, onAdd, onRemove, suggestions, suggestionsLabel, addLabel, showSuggestions, onFocus }: CandidateListInputProps) {
  const { colors, isDark } = useDarkMode();
  const inputRef = useRef<TextInput>(null);
  const fieldBackground = isDark ? colors.background : '#F8FAFC';
  const accentColor = isDark ? colors.accent : '#B91C1C';
  const { inputRef: registerInput, ...navigationProps } = navigation;

  return (
    <>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold" style={{ color: colors.text }}>{label} *</Text>
        {items.length > 0 && <Text className="text-xs" style={{ color: colors.textSecondary }}>{items.length} added</Text>}
      </View>
      <View className="flex-row items-center gap-2 mb-2">
        <TextInput
          {...navigationProps}
          ref={input => { inputRef.current = input; registerInput(input); }}
          className="flex-1 border rounded-xl px-3.5 text-sm"
          style={{ height: 48, paddingVertical: 0, backgroundColor: fieldBackground, borderColor: colors.border, color: colors.text }}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { navigation.onFocus(); onFocus(); }}
          onSubmitEditing={() => { onAdd(); navigation.onSubmitEditing(); }}
          accessibilityLabel={label}
        />
        <TouchableOpacity onPress={onAdd} accessibilityRole="button" accessibilityLabel={addLabel} className="w-12 h-12 items-center justify-center">
          <MaterialIcons name="add" size={23} color={accentColor} />
        </TouchableOpacity>
      </View>
      {showSuggestions && (
        <InputSuggestions
          value={value}
          options={suggestions}
          existingValues={items}
          label={suggestionsLabel}
          onChangeText={(next) => { onChangeText(next); inputRef.current?.focus(); }}
        />
      )}
      <View className="flex-row flex-wrap gap-2">
        {items.map((item, index) => (
          <View key={index} className="flex-row items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border" style={{ maxWidth: '100%', backgroundColor: fieldBackground, borderColor: colors.border }}>
            <Text className="text-xs" style={{ color: colors.text, flexShrink: 1 }}>{item}</Text>
            <TouchableOpacity onPress={() => onRemove(index)} accessibilityRole="button" accessibilityLabel={'Remove ' + item} hitSlop={6} className="w-6 h-6 items-center justify-center">
              <MaterialIcons name="close" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </>
  );
}
