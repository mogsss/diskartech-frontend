import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';

export interface CertificateData {
  certificate_number: string;
  student_name: string;
  student_course: string;
  student_school: string;
  job_title: string;
  job_category: string;
  company_name: string;
  hirer_name: string;
  company_address: string;
  start_date: string;
  end_date: string;
  work_schedule: string;
  agreed_rate: string;
  issued_date: string;
  certificate_status: string;
  employer_signature?: string;
  web_view_url: string;
}

interface CertificateModalProps {
  visible: boolean;
  onClose: () => void;
  data: CertificateData | null;
}

export default function CertificateModal({
  visible,
  onClose,
  data,
}: CertificateModalProps) {
  const { isDark, colors } = useDarkMode();

  if (!data) return null;

  const getResolvedUrl = () => {
    let url = data.web_view_url || '';
    if (api.defaults.baseURL && (url.includes('localhost') || url.includes('127.0.0.1'))) {
      const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
      const path = url.replace(/^https?:\/\/[^\/]+/, '');
      url = `${base}${path}`;
    }
    return url;
  };

  const handleDownloadPdf = async () => {
    const targetUrl = getResolvedUrl();
    try {
      if (targetUrl) {
        await WebBrowser.openBrowserAsync(targetUrl);
      } else {
        Alert.alert('Notice', 'Certificate link not available.');
      }
    } catch (err) {
      console.error('Error opening certificate web view:', err);
      if (targetUrl) {
        Linking.openURL(targetUrl);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <View 
          className="rounded-t-[32px] p-6 w-full shadow-2xl max-h-[92%] border-t"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b mb-3" style={{ borderColor: colors.border }}>
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View 
                className="w-10 h-10 rounded-2xl items-center justify-center border"
                style={{ 
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2'
                }}
              >
                <MaterialIcons name="workspace-premium" size={24} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold" numberOfLines={1} style={{ color: colors.text }}>
                  Official Certificate of Employment
                </Text>
                <Text className="text-xs" numberOfLines={1} style={{ color: colors.textSecondary }}>
                  Working Student Verification • DiskarTech
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              className="p-1.5 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
            >
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mt-1">
            {/* Certificate Preview Card */}
            <View 
              className="border-2 rounded-3xl p-5 mb-4 shadow-sm relative overflow-hidden"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FAFBFD',
                borderColor: isDark ? 'rgba(220, 38, 38, 0.4)' : 'rgba(239, 68, 68, 0.4)'
              }}
            >
              {/* Badge */}
              <View className="items-center mb-3">
                <View 
                  className="px-3 py-1 rounded-full flex-row items-center gap-1.5 border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                    borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'
                  }}
                >
                  <MaterialIcons name="verified" size={13} color={colors.accent} />
                  <Text className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                    DiskarTech Certified
                  </Text>
                </View>
              </View>

              {/* Title */}
              <View className="items-center mb-4">
                <Text className="text-lg font-black tracking-wider uppercase text-center" style={{ color: colors.text }}>
                  Certificate of Employment
                </Text>
                <Text className="text-[11px] font-semibold uppercase tracking-widest text-center mt-0.5" style={{ color: colors.textSecondary }}>
                  Working Student Engagement Verification
                </Text>
              </View>

              {/* Body */}
              <View 
                className="p-4 rounded-2xl border mb-4"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: colors.border
                }}
              >
                <Text className="text-xs leading-relaxed text-justify" style={{ color: colors.text }}>
                  This certifies that{' '}
                  <Text className="font-black underline" style={{ color: colors.text }}>
                    {data.student_name}
                  </Text>
                  , an enrolled student of{' '}
                  <Text className="font-bold" style={{ color: colors.text }}>{data.student_school}</Text>{' '}
                  taking up{' '}
                  <Text className="font-bold" style={{ color: colors.text }}>{data.student_course}</Text>, has
                  rendered verified working student services with{' '}
                  <Text className="font-black" style={{ color: colors.text }}>{data.company_name}</Text> as a{' '}
                  <Text className="font-bold text-red-600">{data.job_title}</Text> (
                  {data.job_category}) from{' '}
                  <Text className="font-bold" style={{ color: colors.text }}>{data.start_date}</Text> to{' '}
                  <Text className="font-bold" style={{ color: colors.text }}>{data.end_date}</Text>.
                </Text>
              </View>

              {/* Details Grid */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                <View 
                  className="flex-1 min-w-[130px] p-2.5 rounded-xl border"
                  style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF', borderColor: colors.border }}
                >
                  <Text className="text-[9px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Work Schedule</Text>
                  <Text className="text-xs font-bold mt-0.5" numberOfLines={1} style={{ color: colors.text }}>
                    {data.work_schedule}
                  </Text>
                </View>
                <View 
                  className="flex-1 min-w-[130px] p-2.5 rounded-xl border"
                  style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF', borderColor: colors.border }}
                >
                  <Text className="text-[9px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Agreed Rate</Text>
                  <Text className="text-xs font-bold mt-0.5" numberOfLines={1} style={{ color: colors.text }}>
                    {data.agreed_rate}
                  </Text>
                </View>
                <View 
                  className="flex-1 min-w-[130px] p-2.5 rounded-xl border"
                  style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF', borderColor: colors.border }}
                >
                  <Text className="text-[9px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Work Location</Text>
                  <Text className="text-xs font-bold mt-0.5" numberOfLines={1} style={{ color: colors.text }}>
                    {data.company_address}
                  </Text>
                </View>
                <View 
                  className="flex-1 min-w-[130px] p-2.5 rounded-xl border"
                  style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF', borderColor: colors.border }}
                >
                  <Text className="text-[9px] font-semibold uppercase" style={{ color: colors.textSecondary }}>Reference No.</Text>
                  <Text className="text-xs font-bold text-red-600 mt-0.5" numberOfLines={1}>
                    {data.certificate_number}
                  </Text>
                </View>
              </View>

              {/* Signatures & Seal */}
              <View className="pt-3 border-t flex-row items-center justify-between" style={{ borderColor: colors.border }}>
                <View className="flex-1">
                  {data.employer_signature ? (
                    <View style={{ height: 40, justifyContent: 'flex-end', marginBottom: 2 }}>
                      <Image
                        source={{ uri: data.employer_signature }}
                        style={{ width: 130, height: 38 }}
                        resizeMode="contain"
                      />
                    </View>
                  ) : null}
                  <Text className="text-xs font-bold" style={{ color: colors.text }}>{data.hirer_name}</Text>
                  <Text className="text-[10px]" style={{ color: colors.textSecondary }}>Employer</Text>
                  <Text className="text-[9px] mt-0.5" style={{ color: colors.textSecondary }}>Date: {data.issued_date}</Text>
                </View>

                <View className="w-16 h-16 rounded-full  items-center justify-center rotate-[-8deg]" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(254, 242, 242, 0.8)' }}>
                  <Text className="text-[8px] font-black text-red-600 text-center leading-3">
                    DISKARTECH{'\n'}VERIFIED{'\n'}SEAL
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 24, paddingTop: 4 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadPdf}
                activeOpacity={0.8}
                style={{
                  flex: 1.8,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: '#DC2626',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  paddingHorizontal: 12,
                }}
              >
                <MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                  Download
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
