import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

type EditableField = 'companyName' | 'firstName' | 'middleName' | 'lastName' | 'phone' | 'detailedAddress';

interface HirerProfileFormProps {
  role: 'employer' | 'household';
  values: Record<EditableField, string> & { email: string; businessType: string; location: string };
  saving: boolean;
  onChange: (field: EditableField, value: string) => void;
  onChooseBusinessType: () => void;
  onChooseLocation: () => void;
}

function ProfileField({ label, required, ...input }: TextInputProps & { label: string; required?: boolean }) {
  const { colors, isDark } = useDarkMode();
  const accentText = isDark ? '#F87171' : colors.primary;
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>
        {label}{required && <Text style={{ color: accentText }}> *</Text>}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={`${label}${required ? ', required' : ''}`}
        autoCorrect={false}
        placeholderTextColor={colors.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`rounded-xl border px-4 text-sm ${input.multiline ? 'min-h-24 py-3 leading-6' : 'h-14 py-3'}`}
        style={{
          color: colors.text,
          backgroundColor: isDark ? colors.background : '#F8FAFC',
          borderColor: focused ? accentText : colors.border,
          textAlignVertical: input.multiline ? 'top' : 'center',
          opacity: input.editable === false ? 0.65 : 1,
        }}
      />
    </View>
  );
}

function FormSection({ title, description, icon, children }: {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useDarkMode();
  const accentText = isDark ? '#F87171' : colors.primary;
  return (
    <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-start gap-3 px-5 py-4 border-b" style={{ borderColor: colors.border }}>
        <View className="h-9 w-9 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={19} color={accentText} />
        </View>
        <View className="flex-1 min-w-0">
          <Text accessibilityRole="header" className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text>
          <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{description}</Text>
        </View>
      </View>
      <View className="p-5 gap-4">{children}</View>
    </View>
  );
}

export default function HirerProfileForm({ role, values, saving, onChange, onChooseBusinessType, onChooseLocation }: HirerProfileFormProps) {
  const { colors, isDark } = useDarkMode();
  const accentText = isDark ? '#F87171' : colors.primary;
  const isBusiness = role === 'employer';
  const accentSurface = isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2';
  const representativeName = [values.firstName, values.middleName, values.lastName].map(part => part.trim()).filter(Boolean).join(' ');
  const displayName = (isBusiness ? values.companyName.trim() : representativeName) || (isBusiness ? 'Your business' : 'Your household');

  return (
    <View className="gap-5">
      <View className="flex-row items-center gap-4 pt-2 pb-1">
        <View className="h-14 w-14 rounded-2xl items-center justify-center" style={{ backgroundColor: accentSurface }}>
          <MaterialIcons name={isBusiness ? 'storefront' : 'home-work'} size={27} color={accentText} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-xs font-medium leading-5" style={{ color: colors.textSecondary }}>{isBusiness ? 'Business profile' : 'Household profile'}</Text>
          <Text className="text-lg font-bold leading-7 mt-0.5" style={{ color: colors.text }}>{displayName}</Text>
        </View>
      </View>
      <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>
        Keep your details up to date so students can connect with you. <Text style={{ color: accentText }}>*</Text> Required fields.
      </Text>

      {isBusiness && (
        <FormSection title="Business details" description="The name and type of your business." icon="business">
          <ProfileField label="Business / company name" required placeholder="Enter your business name" value={values.companyName} onChangeText={value => onChange('companyName', value)} editable={!saving} autoCapitalize="words" maxLength={255} />
          <View className="gap-2">
            <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>Business type</Text>
            <TouchableOpacity onPress={onChooseBusinessType} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Select business type" accessibilityState={{ disabled: saving }} className="min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border, opacity: saving ? 0.65 : 1 }}>
              <Text className="flex-1 text-sm leading-6" style={{ color: values.businessType ? colors.text : colors.textSecondary }}>{values.businessType || 'Select business type'}</Text>
              <MaterialIcons name="expand-more" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </FormSection>
      )}

      <FormSection title={isBusiness ? 'Contact person' : 'Household representative'} description="The person students will coordinate with." icon="person-outline">
        <ProfileField label="First name" required placeholder="Enter your first name" value={values.firstName} onChangeText={value => onChange('firstName', value)} editable={!saving} autoCapitalize="words" autoComplete="given-name" maxLength={255} />
        <ProfileField label="Middle name (optional)" placeholder="Enter your middle name" value={values.middleName} onChangeText={value => onChange('middleName', value)} editable={!saving} autoCapitalize="words" autoComplete="additional-name" maxLength={255} />
        <ProfileField label="Last name" required placeholder="Enter your last name" value={values.lastName} onChangeText={value => onChange('lastName', value)} editable={!saving} autoCapitalize="words" autoComplete="family-name" maxLength={255} />
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
            <MaterialIcons name="mail-outline" size={18} color={colors.textSecondary} />
            <Text selectable className="flex-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{values.email || 'No email registered'}</Text>
          </View>
        </View>
      </FormSection>

      <FormSection title={isBusiness ? 'Business location' : 'Home address'} description="Pin your location so nearby students can find you." icon="location-on">
        <View className="gap-2">
          <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>Pinned location</Text>
          <TouchableOpacity onPress={onChooseLocation} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={values.location ? 'Change pinned location' : 'Choose location on map'} accessibilityState={{ disabled: saving }} className="rounded-2xl border p-4" style={{ backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border, opacity: saving ? 0.65 : 1 }}>
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
