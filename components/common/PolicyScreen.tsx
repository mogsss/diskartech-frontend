import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { PolicyDocument } from '@/data/legalPolicies';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PolicyLink {
  title: string;
  href: '/terms-and-conditions' | '/privacy-policy' | '/cookie-policy' | '/delete-account';
  icon?: keyof typeof MaterialIcons.glyphMap;
}

interface PolicyScreenProps {
  document: PolicyDocument;
  icon: keyof typeof MaterialIcons.glyphMap;
  relatedPolicy: PolicyLink;
  additionalPolicies?: PolicyLink[];
  showPrivacyReference?: boolean;
  variant?: 'cards' | 'plain';
}

export default function PolicyScreen({ document, icon, relatedPolicy, additionalPolicies = [], showPrivacyReference = false, variant = 'cards' }: PolicyScreenProps) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const accentText = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const plain = variant === 'plain';

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center flex-row items-center gap-3 px-6 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')} accessibilityRole="button" accessibilityLabel="Go back" activeOpacity={0.75} className="w-12 h-12 items-center justify-center">
          <MaterialIcons name="arrow-back" size={23} color={isDark ? colors.text : '#000000'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold leading-6" style={{ color: colors.text }}>{document.title}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center px-6 pt-2" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }} showsVerticalScrollIndicator>
        <View className={plain ? 'px-1 pt-4 pb-6' : 'rounded-3xl border p-5 mb-4'} style={plain ? undefined : { backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="w-12 h-12 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: plain ? 'transparent' : accentSurface }}>
            <MaterialIcons name={icon} size={25} color={accentText} />
          </View>
          <Text className="text-2xl font-bold leading-8 tracking-tight" style={{ color: colors.text }}>{document.title}</Text>
          <Text className="text-sm leading-6 mt-3" style={{ color: colors.textSecondary }}>{document.introduction}</Text>
          <View className="flex-row items-center gap-2 mt-4">
            <MaterialIcons name="update" size={16} color={accentText} />
            <Text className="text-xs" style={{ color: colors.textSecondary }}>Updated {document.updated}</Text>
          </View>
        </View>

        <View className={plain ? 'px-1' : 'rounded-3xl border px-5'} style={plain ? undefined : { backgroundColor: colors.surface, borderColor: colors.border }}>
          {document.sections.map((section, index) => (
            <View key={section.title} className={index === 0 ? 'py-5' : 'py-5 border-t'} style={{ borderColor: colors.border }}>
              <Text accessibilityRole="header" className="text-base font-bold leading-6 mb-2" style={{ color: colors.text }}>{section.title}</Text>
              {section.paragraphs.map((paragraph) => <Text key={paragraph} selectable className="text-sm leading-6 mt-2" style={{ color: colors.textSecondary }}>{paragraph}</Text>)}
              {section.bullets?.map((bullet) => <View key={bullet} className="flex-row items-start gap-3 mt-3">
                <View className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: accentText }} />
                <Text selectable className="flex-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{bullet}</Text>
              </View>)}
            </View>
          ))}
        </View>

        <View className={plain ? 'px-1 pt-6 mt-2 border-t' : 'rounded-3xl border p-5 mt-4'} style={{ backgroundColor: plain ? 'transparent' : colors.surface, borderColor: colors.border }}>
          <Text className="text-base font-bold" style={{ color: colors.text }}>Related information</Text>
          {[relatedPolicy, ...additionalPolicies].map((policy) => <Link key={policy.href} href={policy.href} replace asChild>
            <TouchableOpacity accessibilityRole="link" activeOpacity={0.75} className="min-h-12 flex-row items-center gap-3 mt-2">
              <MaterialIcons name={policy.icon ?? (showPrivacyReference ? 'description' : 'security')} size={20} color={accentText} />
              <Text className="flex-1 text-sm font-semibold" style={{ color: accentText }}>{policy.title}</Text>
              <MaterialIcons name="chevron-right" size={21} color={accentText} />
            </TouchableOpacity>
          </Link>)}
          {showPrivacyReference && <Link href="https://privacy.gov.ph/data-subject-rights/" asChild>
            <TouchableOpacity accessibilityRole="link" accessibilityLabel="Read National Privacy Commission data subject rights in your browser" activeOpacity={0.75} className="min-h-12 flex-row items-center gap-3">
              <MaterialIcons name="policy" size={20} color={accentText} />
              <Text className="flex-1 text-sm font-semibold leading-5" style={{ color: accentText }}>Your privacy rights (NPC)</Text>
              <MaterialIcons name="open-in-new" size={18} color={accentText} />
            </TouchableOpacity>
          </Link>}
          <Link href="/help-center" asChild>
            <TouchableOpacity accessibilityRole="link" activeOpacity={0.75} className="min-h-12 flex-row items-center gap-3">
              <MaterialIcons name="help-outline" size={20} color={accentText} />
              <Text className="flex-1 text-sm font-semibold" style={{ color: accentText }}>Help Center</Text>
              <MaterialIcons name="chevron-right" size={21} color={accentText} />
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
