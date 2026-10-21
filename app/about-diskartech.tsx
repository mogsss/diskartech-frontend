import SupportAiModal from '@/components/common/SupportAiModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WEBSITE_URL = 'https://diskartech.world';

const FEATURES: {
  title: string;
  summary: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  {
    title: 'AI job recommendations',
    summary: 'Opportunities based on your skills and schedule.',
    description: 'Set your skills, available days, and preferred time slots to help personalize job recommendations. Review each job before applying. For You also includes Featured opportunities from employers on Pro.',
    icon: 'schedule',
  },
  {
    title: 'Nearby opportunities',
    summary: 'See the distance before you apply.',
    description: 'Browse opportunities near your saved profile location and check their distance. Review the workplace address and factor the commute into your schedule.',
    icon: 'near-me',
  },
  {
    title: 'Account verification',
    summary: 'Documents reviewed before applying or posting.',
    description: 'Students submit school identification and enrollment documents. Employers and household hirers submit the documents required for their role. AI assists document analysis, and administrators review account verification. Students need a verified account to apply; hirers need one to post jobs.',
    icon: 'verified-user',
  },
  {
    title: 'Online interviews',
    summary: 'Meet your next hirer through a video call.',
    description: 'Join a scheduled online interview from the app when the interview is available. Camera and microphone permissions are required for the call. You can mute, turn your camera off, or leave using the call controls.',
    icon: 'videocam',
  },
  {
    title: 'Employment certificates',
    summary: 'Keep a record of your work experience.',
    description: 'Manage your employment contract and request a Certificate of Employment when the relevant action is available. The hirer processes the request before a certificate is issued.',
    icon: 'workspace-premium',
  },
  {
    title: 'Safety and reporting',
    summary: 'Raise concerns through the Help Center.',
    description: 'Report suspicious job offers, unsafe conditions, underpayment, or other work-related concerns. View updates on submitted reports in the Help Center.',
    icon: 'shield',
  },
];

const RESOURCES: {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href: '/help-center' | '/terms-and-conditions' | '/privacy-policy' | '/cookie-policy';
}[] = [
  { title: 'Help Center', subtitle: 'FAQs, support, and reports', icon: 'help-outline', href: '/help-center' },
  { title: 'Terms and Conditions', subtitle: 'Guidelines for using DiskarTech', icon: 'description', href: '/terms-and-conditions' },
  { title: 'Privacy Policy', subtitle: 'How your information is used', icon: 'security', href: '/privacy-policy' },
  { title: 'Cookie Policy', subtitle: 'Cookies, app storage, and your choices', icon: 'cookie', href: '/cookie-policy' },
];

export default function AboutDiskarTechScreen() {
  const { isDark, colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [openingWebsite, setOpeningWebsite] = useState(false);
  const websiteLock = useRef(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const accentText = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const arrowColor = colors.textSecondary;
  const version = Constants.expoConfig?.version || '1.0.0';

  const handleShareApp = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      await Share.share({
        title: 'DiskarTech',
        message: `Discover DiskarTech: Job Matching Platform that  fits your skills and schedule. Connect with employers and household hirers in Pinamalayan, Oriental Mindoro.\n\n${WEBSITE_URL}`,
      });
    } catch {
      setNotice({ title: 'Could not share', message: 'Unable to open sharing right now. Please try again.' });
    } finally {
      setSharing(false);
    }
  };

  const handleOpenWebsite = async () => {
    if (websiteLock.current) return;
    websiteLock.current = true;
    setOpeningWebsite(true);
    try {
      await Linking.openURL(WEBSITE_URL);
    } catch {
      setNotice({ title: 'Could not open website', message: 'Please try again, or open https://diskartech.world in your browser.' });
    } finally {
      websiteLock.current = false;
      setOpeningWebsite(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center flex-row items-center gap-2 px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')} accessibilityRole="button" accessibilityLabel="Go back" activeOpacity={0.75} className="w-12 h-12 items-center justify-center">
          <MaterialIcons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold leading-6 tracking-tight" style={{ color: colors.text }}>About DiskarTech</Text>
        </View>
        <TouchableOpacity onPress={handleShareApp} disabled={sharing} accessibilityRole="button" accessibilityLabel="Share DiskarTech" accessibilityState={{ disabled: sharing, busy: sharing }} activeOpacity={0.75} className="w-12 h-12 items-center justify-center" style={{ opacity: sharing ? 0.5 : 1 }}>
          <MaterialIcons name="share" size={21} color={accentText} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center px-6 pt-2" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }} showsVerticalScrollIndicator={false}>
        <View className="items-center px-2 pb-7 pt-5">
          <View className="w-20 h-20 rounded-3xl border overflow-hidden items-center justify-center mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: colors.border }}>
            <Image source={require('@/assets/images/icon.png')} className="w-full h-full" resizeMode="contain" accessibilityLabel="DiskarTech app logo" />
          </View>
          <Text className="text-3xl font-bold tracking-tight" style={{ color: colors.text }}>DiskarTech<Text style={{ color: accentText }}>.</Text></Text>
          <Text className="text-base font-semibold leading-6 text-center mt-2" style={{ color: accentText }}>Opportunity, closer to you.</Text>
          <Text className="text-sm leading-6 text-center mt-3" style={{ color: colors.textSecondary }}>Helping working students find their next opportunity, and local businesses and households find their next helping hand.</Text>
          <View className="flex-row flex-wrap justify-center gap-2 mt-4">
            {['Students', 'Employers', 'Households'].map((role) => (
              <View key={role} className="rounded-lg px-3 py-1.5" style={{ backgroundColor: accentSurface }}>
                <Text className="text-[11px] font-semibold" style={{ color: accentText }}>{role}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text accessibilityRole="header" className="text-base font-bold mb-3 px-1 mt-3 " style={{ color: colors.text }}>Why we built DiskarTech</Text>
        <View className="rounded-3xl border p-5 mb-6" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="flag" size={21} color={accentText} /></View>
            <Text className="text-base font-bold" style={{ color: colors.text }}>Our mission</Text>
          </View>
          <Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>Help Filipino college students find work that fits their skills and availability, while giving employers and households a way to connect with student applicants.</Text>
          <View className="border-t mt-5 pt-5" style={{ borderColor: colors.border }}>
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="visibility" size={21} color={accentText} /></View>
              <Text className="text-base font-bold" style={{ color: colors.text }}>Our vision</Text>
            </View>
            <Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>A community where students can build work experience and support their education through honest job opportunities and clear employment arrangements.</Text>
          </View>
        </View>

        <View className="mb-6">
          <Text accessibilityRole="header" className="text-base font-bold px-1" style={{ color: colors.text }}>What DiskarTech offers</Text>
          <Text className="text-xs leading-5 mt-1 mb-3" style={{ color: colors.textSecondary }}>Tap a feature to learn more.</Text>
          <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {FEATURES.map((feature, index) => {
              const expanded = activeFeature === feature.title;
              return (
                <TouchableOpacity key={feature.title} onPress={() => setActiveFeature(expanded ? null : feature.title)} accessibilityRole="button" accessibilityLabel={feature.title} accessibilityState={{ expanded }} activeOpacity={0.75} className={'p-4' + (index > 0 ? ' border-t' : '')} style={{ borderColor: colors.border }}>
                  <View className="flex-row items-center gap-3">
                    <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={feature.icon} size={22} color={accentText} /></View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold leading-5" style={{ color: colors.text }}>{feature.title}</Text>
                      <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{feature.summary}</Text>
                    </View>
                    <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={23} color={arrowColor} />
                  </View>
                  {expanded && <View className="border-t mt-4 pt-3" style={{ borderColor: colors.border }}><Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>{feature.description}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text accessibilityRole="header" className="text-base font-bold mb-3 px-1" style={{ color: colors.text }}>A little help along the way</Text>
        <View className="rounded-3xl border p-5 mb-6" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="smart-toy" size={25} color={accentText} /></View>
            <View className="flex-1"><Text className="text-base font-bold" style={{ color: colors.text }}>Meet DARA</Text><Text className="text-xs leading-5 mt-1" style={{ color: accentText }}>Your AI support assistant</Text></View>
          </View>
          <Text className="text-sm leading-6 mb-4" style={{ color: colors.textSecondary }}>Ask about applications, verification, schedules, contracts, and employment certificates.</Text>
          <TouchableOpacity onPress={() => setAiModalVisible(true)} accessibilityRole="button" accessibilityLabel="Chat with DARA" activeOpacity={0.75} className="min-h-12 rounded-xl flex-row items-center justify-center gap-2 px-4 py-3" style={{ backgroundColor: accentSurface }}>
            <MaterialIcons name="chat-bubble-outline" size={19} color={accentText} />
            <Text className="text-sm font-semibold" style={{ color: accentText }}>Chat with DARA</Text>
          </TouchableOpacity>
        </View>

        <View className="px-1 mb-6">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="school" size={21} color={accentText} /></View>
            <Text className="flex-1 text-base font-bold leading-6" style={{ color: colors.text }}>An academic capstone project</Text>
          </View>
          <Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>DiskarTech was developed as an academic capstone initiative focused on the challenges of balancing college studies and part-time work.</Text>
        </View>

        <View className="px-1 mb-6">
          <Text accessibilityRole="header" className="text-base font-bold mb-3" style={{ color: colors.text }}>Scope and limitations</Text>
          <Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>DiskarTech focuses on local job matching for working students, employers, and household hirers. As an academic capstone project, it operates within technical, structural, and logistical constraints.</Text>
          <Text className="text-sm leading-6 mt-3" style={{ color: colors.textSecondary }}>The following advanced recruitment and employment administration features are outside the scope of the project:</Text>
          {[
            'Large-scale labor regulation compliance management',
            'Formal corporate recruitment and hiring pipelines',
            'Tax filing integration',
            'Administration of long-term employment benefits, including SSS, PhilHealth, and Pag-IBIG contributions',
          ].map((limitation) => (
            <View key={limitation} className="flex-row items-start gap-2 mt-2">
              <Text className="text-sm leading-6" style={{ color: colors.textSecondary }}>{'\u2022'}</Text>
              <Text className="flex-1 text-sm leading-6" style={{ color: colors.textSecondary }}>{limitation}</Text>
            </View>
          ))}
        </View>

        <Text accessibilityRole="header" className="text-base font-bold mb-3 px-1" style={{ color: colors.text }}>Support and policies</Text>
        <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          {RESOURCES.map((resource) => (
            <Link key={resource.href} href={resource.href} asChild>
              <TouchableOpacity accessibilityRole="link" activeOpacity={0.75} className="flex-row items-center gap-3 px-5 py-4 border-b" style={{ borderColor: colors.border }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={resource.icon} size={20} color={accentText} /></View>
                <View className="flex-1"><Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{resource.title}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{resource.subtitle}</Text></View>
                <MaterialIcons name="chevron-right" size={21} color={arrowColor} />
              </TouchableOpacity>
            </Link>
          ))}
          <TouchableOpacity onPress={handleOpenWebsite} disabled={openingWebsite} accessibilityRole="link" accessibilityLabel="Visit the DiskarTech website at diskartech.world" accessibilityHint="Opens the landing page in your browser" accessibilityState={{ disabled: openingWebsite, busy: openingWebsite }} activeOpacity={0.75} className="flex-row items-center gap-3 px-5 py-4" style={{ opacity: openingWebsite ? 0.5 : 1 }}>
            <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="language" size={20} color={accentText} /></View>
            <View className="flex-1">
              <Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{openingWebsite ? 'Opening website…' : 'Visit our website'}</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>diskartech.world</Text>
            </View>
            {openingWebsite ? <ActivityIndicator size="small" color={accentText} /> : <MaterialIcons name="open-in-new" size={21} color={arrowColor} />}
          </TouchableOpacity>
        </View>

        <View className="items-center mt-6">
          <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>DiskarTech v{version}</Text>
          <Text className="text-[11px] text-center leading-5 mt-1" style={{ color: colors.textSecondary }}>Built for our community in Pinamalayan, Oriental Mindoro.</Text>
        </View>
      </ScrollView>

      <SupportAiModal visible={aiModalVisible} onClose={() => setAiModalVisible(false)} />
      <NotificationModal visible={!!notice} title={notice?.title ?? ''} message={notice?.message ?? ''} iconName="error-outline" iconColor={colors.primary} primaryButtonText="OK" onPrimaryPress={() => setNotice(null)} />
    </View>
  );
}
