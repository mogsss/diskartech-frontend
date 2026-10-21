import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { FormSection, ProfileField } from '@/components/ui/profile/ProfileFormFields';

type EditableField = 'firstName' | 'middleName' | 'lastName' | 'school' | 'phone' | 'detailedAddress';

interface StudentProfileFormProps {
  values: Record<EditableField, string> & { email: string; course: string; yearLevel: string; location: string };
  saving: boolean;
  onChange: (field: EditableField, value: string) => void;
  onChooseCourse: () => void;
  onChooseYearLevel: () => void;
  onChooseLocation: () => void;
}

export default function StudentProfileForm({ values, saving, onChange, onChooseCourse, onChooseYearLevel, onChooseLocation }: StudentProfileFormProps) {
  const { colors, isDark } = useDarkMode();
  const accentText = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220,38,38,0.12)' : '#FFF1F2';
  const fieldBackground = isDark ? colors.background : '#F8FAFC';
  const fullName = [values.firstName, values.middleName, values.lastName].map(part => part.trim()).filter(Boolean).join(' ');

  return (
    <View className="gap-5">
      <View className="flex-row items-center gap-4 pt-2 pb-1">
        <View className="h-14 w-14 rounded-2xl items-center justify-center" style={{ backgroundColor: accentSurface }}>
          <MaterialIcons name="school" size={27} color={accentText} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-xs font-medium leading-5" style={{ color: colors.textSecondary }}>Student profile</Text>
          <Text className="text-lg font-bold leading-7 mt-0.5" style={{ color: colors.text }}>{fullName || 'Your student profile'}</Text>
        </View>
      </View>
      <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>
        Keep your personal, school and contact details up to date. <Text style={{ color: accentText }}>*</Text> Required fields.
      </Text>

      <FormSection title="Personal information" description="The name employers and household hirers see." icon="person-outline">
        <ProfileField label="First name" required placeholder="Enter your first name" value={values.firstName} onChangeText={value => onChange('firstName', value)} editable={!saving} autoCapitalize="words" autoComplete="given-name" maxLength={255} />
        <ProfileField label="Middle name (optional)" placeholder="Enter your middle name" value={values.middleName} onChangeText={value => onChange('middleName', value)} editable={!saving} autoCapitalize="words" autoComplete="additional-name" maxLength={255} />
        <ProfileField label="Last name" required placeholder="Enter your last name" value={values.lastName} onChangeText={value => onChange('lastName', value)} editable={!saving} autoCapitalize="words" autoComplete="family-name" maxLength={255} />
      </FormSection>

      <FormSection title="Academic information" description="Your current school, course and year level." icon="school">
        <ProfileField label="College / university" placeholder="Enter your school name" value={values.school} onChangeText={value => onChange('school', value)} editable={!saving} autoCapitalize="words" maxLength={255} />
        {[
          { label: 'Course / program', value: values.course, placeholder: 'Select course', onPress: onChooseCourse },
          { label: 'Year level', value: values.yearLevel, placeholder: 'Select year level', onPress: onChooseYearLevel },
        ].map(field => (
          <View key={field.label} className="gap-2">
            <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>{field.label}</Text>
            <TouchableOpacity onPress={field.onPress} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={field.placeholder} accessibilityState={{ disabled: saving }} className="min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: fieldBackground, borderColor: colors.border, opacity: saving ? 0.65 : 1 }}>
              <Text className="flex-1 text-sm leading-6" style={{ color: field.value ? colors.text : colors.textSecondary }}>{field.value || field.placeholder}</Text>
              <MaterialIcons name="expand-more" size={22} color={accentText} />
            </TouchableOpacity>
          </View>
        ))}
      </FormSection>

      <FormSection title="Contact details" description="Your contact number and registered email." icon="contact-phone">
        <ProfileField label="Contact number" placeholder="09XX XXX XXXX" value={values.phone} onChangeText={value => onChange('phone', value)} editable={!saving} keyboardType="phone-pad" autoComplete="tel" />
        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>Email address</Text>
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="lock-outline" size={12} color={colors.textSecondary} />
              <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>Read only</Text>
            </View>
          </View>
          <View className="min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: isDark ? colors.background : '#F1F5F9', borderColor: colors.border }}>
            <MaterialIcons name="mail-outline" size={18} color={accentText} />
            <Text selectable className="flex-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{values.email || 'No email registered'}</Text>
          </View>
        </View>
      </FormSection>

      <FormSection title="Address & location" description="Choose your location to find nearby opportunities." icon="location-on">
        <View className="gap-2">
          <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>Pinned location</Text>
          <TouchableOpacity onPress={onChooseLocation} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={values.location ? 'Change pinned location' : 'Choose location on map'} accessibilityState={{ disabled: saving }} className="rounded-2xl border p-4" style={{ backgroundColor: fieldBackground, borderColor: colors.border, opacity: saving ? 0.65 : 1 }}>
            <View className="flex-row items-start gap-3">
              <View className="h-9 w-9 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="map" size={20} color={accentText} /></View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-medium leading-6" style={{ color: colors.text }}>{values.location || 'Choose a location'}</Text>
                {!values.location && <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Pinamalayan, Oriental Mindoro</Text>}
              </View>
            </View>
            <View className="flex-row items-center justify-end gap-1 mt-3">
              <Text className="text-xs font-semibold leading-5" style={{ color: accentText }}>{values.location ? 'Change map pin' : 'Open map'}</Text>
              <MaterialIcons name="arrow-forward" size={15} color={accentText} />
            </View>
          </TouchableOpacity>
        </View>
        <ProfileField label="Street address / landmark" placeholder="House number, street or nearby landmark" value={values.detailedAddress} onChangeText={value => onChange('detailedAddress', value)} editable={!saving} autoCapitalize="sentences" multiline numberOfLines={3} maxLength={500} />
      </FormSection>
    </View>
  );
}
