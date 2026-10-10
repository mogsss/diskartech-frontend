import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SKILL_SUGGESTIONS } from '@/data/skills';
import { useDarkMode } from '@/hooks/useDarkMode';
import InputSuggestions from '@/components/ui/InputSuggestions';

interface AddSkillModalProps {
  visible: boolean;
  onClose: () => void;
  onAddSkill: (skills: string[]) => void;
  existingSkills?: string[];
}

export default function AddSkillModal({ visible, onClose, onAddSkill, existingSkills = [] }: AddSkillModalProps) {
  const { colors, isDark } = useDarkMode();
  const [newSkill, setNewSkill] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleClose = () => {
    setNewSkill('');
    onClose();
  };

  const handleAdd = () => {
    if (!newSkill.trim()) return;

    // Hiwalayin gamit ang comma para sa maramihang skills (e.g. "Graphic Design, Baking, Encoding")
    const splitSkills = Array.from(
      new Set(
        newSkill
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      )
    );

    if (splitSkills.length > 0) {
      onAddSkill(splitSkills);
      setNewSkill('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/60"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="rounded-3xl p-6 shadow-lg border"
          >
            <Text style={{ color: colors.text }} className="text-lg font-bold mb-2">Add New Skills</Text>
            <Text style={{ color: colors.textSecondary }} className="text-xs mb-4">
              Choose a suggestion or type your own. Use commas for multiple skills.
            </Text>

            <View
              style={{
                backgroundColor: isDark ? colors.background : '#F8FAFC',
                borderColor: colors.border,
              }}
              className="border rounded-2xl px-4 py-3 mb-4"
            >
              <TextInput
                ref={inputRef}
                placeholder="e.g., Graphic Design, Baking, Encoding"
                placeholderTextColor={colors.textSecondary}
                value={newSkill}
                onChangeText={setNewSkill}
                style={{ color: colors.text, paddingVertical: 0, minHeight: 24 }}
                className="text-base"
                autoFocus={true}
                onSubmitEditing={handleAdd}
              />
            </View>

            <InputSuggestions
              value={newSkill}
              options={SKILL_SUGGESTIONS}
              existingValues={existingSkills}
              label="Suggested skills"
              onChangeText={(value) => {
                setNewSkill(value);
                inputRef.current?.focus();
              }}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  backgroundColor: isDark ? '#334155' : '#F1F5F9',
                }}
                className="flex-1 py-3.5 items-center rounded-xl"
              >
                <Text style={{ color: colors.textSecondary }} className="font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdd}
                className="flex-1 py-3.5 items-center rounded-xl bg-red-600 shadow-sm"
              >
                <Text className="font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
