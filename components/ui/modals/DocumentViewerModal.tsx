import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useDarkMode } from '@/hooks/useDarkMode';

interface DocumentViewerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  uri: string | null;
  filename?: string | null;
}

export default function DocumentViewerModal({
  visible,
  onClose,
  title,
  uri,
  filename,
}: DocumentViewerModalProps) {
  const { colors, isDark } = useDarkMode();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // I-reset ang loading at error state tuwing bubuksan ang modal o magbabago ang URI
  useEffect(() => {
    if (visible && uri) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [visible, uri]);

  if (!visible || !uri) return null;

  const isPdf =
    Boolean(uri && uri.toLowerCase().includes('.pdf')) ||
    Boolean(filename && filename.toLowerCase().endsWith('.pdf'));

  const handleOpenExternal = async () => {
    if (!uri) return;
    try {
      // Para sa Android, buksan ang PDF gamit ang Google Docs Viewer para ma-render agad
      const targetUrl = isPdf
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true`
        : uri;
      await WebBrowser.openBrowserAsync(targetUrl);
    } catch {
      Linking.openURL(uri).catch(() => {
        Alert.alert('Notice', 'Unable to open document in browser.');
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Solid dark backdrop to completely mask underlying screen & tab bar */}
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 22,
            width: '100%',
            maxHeight: '92%',
            borderColor: colors.border,
            borderWidth: isDark ? 1 : 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2',
                }}
              >
                <MaterialIcons name="verified-user" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
                  DiskarTech Verification Document
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
            {/* Meta & Status Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : 'rgba(254, 242, 242, 0.7)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(220, 38, 38, 0.25)' : '#FEE2E2',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                <MaterialIcons name="check-circle" size={16} color={colors.accent} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isDark ? colors.accent : '#7F1D1D',
                  }}
                  numberOfLines={1}
                >
                  {filename || 'Uploaded Document'}
                </Text>
              </View>
              <View style={{ backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isPdf ? 'PDF' : 'IMAGE'}
                </Text>
              </View>
            </View>

            {/* Document Preview Frame */}
            <View
              style={{
                backgroundColor: '#0F172A',
                borderRadius: 20,
                overflow: 'hidden',
                minHeight: 280,
                maxHeight: 380,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#1E293B',
                position: 'relative',
              }}
            >
              {isPdf ? (
                <View style={{ alignItems: 'center', padding: 24, width: '100%' }}>
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 16,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <MaterialIcons name="picture-as-pdf" size={44} color="#EF4444" />
                  </View>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginBottom: 4 }}>
                    Portable Document Format (PDF)
                  </Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginBottom: 16, paddingHorizontal: 16 }} numberOfLines={2}>
                    {filename || 'Document ready for viewing'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleOpenExternal}
                    activeOpacity={0.8}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                      backgroundColor: '#DC2626',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Open in Browser</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: '100%', minHeight: 320, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                  {imageLoading && (
                    <View style={{ position: 'absolute', zIndex: 10, alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="large" color="#DC2626" />
                      <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 8 }}>Loading document preview...</Text>
                    </View>
                  )}

                  {imageError ? (
                    <View style={{ alignItems: 'center', padding: 24 }}>
                      <MaterialIcons name="broken-image" size={44} color="#EF4444" />
                      <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, marginTop: 8 }}>Preview Unavailable</Text>
                      <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                        Unable to render direct preview in-app. Tap below to open full resolution.
                      </Text>
                      <TouchableOpacity
                        onPress={handleOpenExternal}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          backgroundColor: '#DC2626',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <MaterialIcons name="open-in-browser" size={16} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Open in Browser</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Image
                        source={{ uri }}
                        style={{ width: '100%', height: 320 }}
                        resizeMode="contain"
                        onLoadStart={() => setImageLoading(true)}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={() => {
                          setImageLoading(false);
                          setImageError(true);
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleOpenExternal}
                        activeOpacity={0.8}
                        style={{
                          marginTop: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: 'rgba(255, 255, 255, 0.12)',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <MaterialIcons name="open-in-new" size={14} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>View Full Image</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Verification Security Note */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 16, paddingHorizontal: 4 }}>
              <MaterialIcons name="lock-outline" size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Verified official document stored securely for business accreditation.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 16 }}>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
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
                onPress={handleOpenExternal}
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
                <MaterialIcons name="open-in-new" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                  Open Full Resolution
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

