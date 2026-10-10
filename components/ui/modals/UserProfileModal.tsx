import React from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Avatar from '@/components/ui/Avatar';
import { useDarkMode } from '@/hooks/useDarkMode';

export interface UserProfileData {
  id: string | number;
  role?: string;
  name: string;
  avatar?: string | null;
  isVerified?: boolean;
  rating?: number;
  review_count?: number;
  email?: string;
  phone?: string;
  location?: string;
  detailed_address?: string;
  school?: string;
  course?: string;
  year_level?: string;
  skills?: string[] | string;
  business_name?: string;
  business_type?: string;
  about?: string;
}

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  user: UserProfileData | null;
}

export default function UserProfileModal({
  visible,
  onClose,
  loading = false,
  user,
}: UserProfileModalProps) {
  const { colors, isDark } = useDarkMode();

  const parsedSkills: string[] = React.useMemo(() => {
    if (!user?.skills) return [];
    if (Array.isArray(user.skills)) return user.skills;
    if (typeof user.skills === 'string') {
      try {
        const parsed = JSON.parse(user.skills);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return user.skills.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }, [user?.skills]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '88%',
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Header Bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>User Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 48, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#DC2626" />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 13 }}>
                Loading profile details...
              </Text>
            </View>
          ) : user ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            >
              {/* Profile Overview */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Avatar uri={user.avatar || undefined} name={user.name} size={84} online />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                    {user.name}
                  </Text>
                  {user.isVerified && (
                    <MaterialIcons name="verified" size={20} color="#10B981" />
                  )}
                </View>

                {/* Rating Badge */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 4.5,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
                  }}
                >
                  <MaterialIcons name="star" size={15} color="#F59E0B" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FBBF24' : '#B45309' }}>
                    {user.rating !== undefined ? Number(user.rating).toFixed(1) : '5.0'}
                  </Text>
                  <Text style={{ fontSize: 12, color: isDark ? '#D1D5DB' : '#6B7280' }}>
                    {user.review_count && user.review_count > 0
                      ? `(${user.review_count} ${user.review_count === 1 ? 'review' : 'reviews'})`
                      : '(No reviews yet)'}
                  </Text>
                </View>
              </View>

              {/* Education Section (kung student) */}
              {user.role === 'student' && (user.school || user.course || user.year_level) && (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <MaterialIcons name="school" size={18} color={colors.accent} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      Academic Information
                    </Text>
                  </View>

                  {user.school && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>School</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {user.school}
                      </Text>
                    </View>
                  )}

                  {user.course && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Course</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {user.course}
                      </Text>
                    </View>
                  )}

                  {user.year_level && (
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Year Level</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {user.year_level}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Business Section (kung employer) */}
              {user.role !== 'student' && (user.business_name || user.business_type || user.about) && (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <MaterialIcons name="business" size={18} color={colors.accent} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      Business / Household Info
                    </Text>
                  </View>

                  {user.business_name && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Business Name</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {user.business_name}
                      </Text>
                    </View>
                  )}

                  {user.business_type && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Business Type</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {user.business_type}
                      </Text>
                    </View>
                  )}

                  {user.about && (
                    <View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>About</Text>
                      <Text style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>
                        {user.about}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Skills Tags (kung student) */}
              {user.role === 'student' && parsedSkills.length > 0 && (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <MaterialIcons name="build" size={18} color={colors.accent} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      Skills & Expertise
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {parsedSkills.map((skill, index) => (
                      <View
                        key={index}
                        style={{
                          backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2',
                          borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA',
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626' }}>
                          {skill}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Contact & Location Section */}
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <MaterialIcons name="contact-mail" size={18} color={colors.accent} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    Contact & Location
                  </Text>
                </View>

                {user.email && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <MaterialIcons name="email" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.text }}>{user.email}</Text>
                  </View>
                )}

                {user.phone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <MaterialIcons name="phone" size={16} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.text }}>{user.phone}</Text>
                  </View>
                )}

                {(user.location || user.detailed_address) && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <MaterialIcons name="location-on" size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>
                      {[user.detailed_address, user.location].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Close Button */}
              <TouchableOpacity
                onPress={onClose}
                style={{
                  backgroundColor: '#DC2626',
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginTop: 6,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={{ padding: 48, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="person-off" size={48} color={colors.textSecondary} />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>
                Profile not found
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
