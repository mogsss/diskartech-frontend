import { PRIVACY_POLICY, TERMS_AND_CONDITIONS, type PolicyDocument } from '@/data/legalPolicies';
import { useDarkMode } from '@/hooks/useDarkMode';
import { hasStartupConsent, saveStartupConsent } from '@/utils/startupConsent';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POLICY_VERSIONS = { terms: TERMS_AND_CONDITIONS.updated, privacy: PRIVACY_POLICY.updated };
const StartupConsentContext = createContext(false);

export function useStartupConsent() {
  return useContext(StartupConsentContext);
}

export default function StartupConsentGate({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useDarkMode();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'required' | 'accepted'>('loading');
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicyDocument | null>(null);
  const saveLock = useRef(false);
  const accent = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accepted = status === 'accepted';

  useEffect(() => {
    let cancelled = false;
    void hasStartupConsent(AsyncStorage, POLICY_VERSIONS).then((saved) => {
      if (!cancelled) setStatus(saved ? 'accepted' : 'required');
    });
    return () => { cancelled = true; };
  }, []);

  const agree = useCallback(async () => {
    if (!checked || saveLock.current || status !== 'required') return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      await saveStartupConsent(AsyncStorage, POLICY_VERSIONS, checked);
      setStatus('accepted');
    } catch {
      setError('We could not save your agreement on this device. Please try again.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }, [checked, status]);

  const returnToAgreement = () => setPolicy(null);

  return (
    <StartupConsentContext.Provider value={accepted}>
      {children}
      {/* Let the branded splash finish; all subsequent routes share this gate. */}
      <Modal
        visible={!accepted && pathname !== '/'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={returnToAgreement}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-5" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
          <View
            accessibilityViewIsModal
            className="w-full max-w-md rounded-3xl border overflow-hidden"
            style={{ backgroundColor: colors.surface, borderColor: colors.border, maxHeight: Math.max(160, height - insets.top - insets.bottom - 40) }}
          >
            {status === 'loading' ? (
              <View className="items-center p-8 gap-3">
                <ActivityIndicator color={accent} />
                <Text style={{ color: colors.textSecondary }}>Loading your preferences...</Text>
              </View>
            ) : policy ? (
              <>
                <View className="flex-row items-center gap-2 px-4 py-3 border-b" style={{ borderColor: colors.border }}>
                  <TouchableOpacity onPress={returnToAgreement} accessibilityRole="button" accessibilityLabel="Back to agreement" className="min-h-12 min-w-12 items-center justify-center">
                    <MaterialIcons name="arrow-back" size={23} color={colors.text} />
                  </TouchableOpacity>
                  <Text accessibilityRole="header" className="flex-1 text-base font-bold" style={{ color: colors.text }}>{policy.title}</Text>
                </View>
                <ScrollView key={policy.title} style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator>
                  <Text selectable className="text-sm leading-6" style={{ color: colors.textSecondary }}>{policy.introduction}</Text>
                  <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>Updated {policy.updated}</Text>
                  {policy.sections.map((section) => (
                    <View key={section.title} className="mt-5">
                      <Text accessibilityRole="header" className="text-base font-bold leading-6" style={{ color: colors.text }}>{section.title}</Text>
                      {section.paragraphs.map((paragraph) => <Text key={paragraph} selectable className="text-sm leading-6 mt-2" style={{ color: colors.textSecondary }}>{paragraph}</Text>)}
                      {section.bullets?.map((bullet) => (
                        <View key={bullet} className="flex-row items-start gap-2 mt-2">
                          <Text className="text-sm leading-6" style={{ color: accent }}>{'\u2022'}</Text>
                          <Text selectable className="flex-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity onPress={returnToAgreement} accessibilityRole="button" className="min-h-12 items-center justify-center px-5 py-4 border-t" style={{ borderColor: colors.border }}>
                  <Text className="text-sm font-bold" style={{ color: accent }}>Back to agreement</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator>
                  <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: accentSurface }}>
                    <MaterialIcons name="verified-user" size={29} color={accent} />
                  </View>
                  <Text accessibilityRole="header" className="text-2xl font-bold leading-8" style={{ color: colors.text }}>Before you get started</Text>
                  <Text className="text-sm leading-6 mt-3 mb-4" style={{ color: colors.textSecondary }}>Please review our Terms and Conditions and Privacy Policy before continuing to DiskarTech.</Text>
                  {[TERMS_AND_CONDITIONS, PRIVACY_POLICY].map((document) => (
                    <TouchableOpacity key={document.title} onPress={() => setPolicy(document)} accessibilityRole="button" accessibilityLabel={`Read ${document.title}`} className="min-h-12 flex-row items-center gap-3 py-3 border-b" style={{ borderColor: colors.border }}>
                      <MaterialIcons name={document === PRIVACY_POLICY ? 'security' : 'description'} size={21} color={accent} />
                      <Text className="flex-1 text-sm font-semibold leading-5" style={{ color: accent }}>{document.title}</Text>
                      <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => { setChecked((value) => !value); setError(null); }}
                    disabled={saving}
                    accessibilityRole="checkbox"
                    accessibilityLabel="I agree to the Terms and Conditions and acknowledge that I have read the Privacy Policy"
                    accessibilityState={{ checked, disabled: saving }}
                    activeOpacity={0.75}
                    className="min-h-12 flex-row items-start gap-3 mt-5 py-2"
                  >
                    <MaterialIcons name={checked ? 'check-box' : 'check-box-outline-blank'} size={26} color={checked ? accent : colors.textSecondary} />
                    <Text className="flex-1 text-sm leading-6" style={{ color: colors.text }}>I agree to the Terms and Conditions and acknowledge that I have read the Privacy Policy.</Text>
                  </TouchableOpacity>
                  {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-sm leading-6 mt-2" style={{ color: accent }}>{error}</Text>}
                </ScrollView>
                <View className="px-6 pb-6 pt-3">
                  <TouchableOpacity onPress={agree} disabled={!checked || saving} accessibilityRole="button" accessibilityState={{ disabled: !checked || saving, busy: saving }} className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.primary, opacity: !checked || saving ? 0.45 : 1 }}>
                    {saving && <ActivityIndicator color="#FFFFFF" size="small" />}
                    <Text className="text-base font-bold text-white">{saving ? 'Saving...' : 'Agree and continue'}</Text>
                  </TouchableOpacity>
                  <Text className="text-xs leading-5 text-center mt-3" style={{ color: colors.textSecondary }}>You can review these policies anytime in Settings.</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </StartupConsentContext.Provider>
  );
}
