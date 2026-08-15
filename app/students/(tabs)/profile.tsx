import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import AddSkillModal from '@/components/modals/student/AddSkillModal';
import EditAvailabilityModal from '@/components/modals/student/EditAvailabilityModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const menuItems = [
  { icon: 'settings', label: 'Settings', route: '/settings' },
  { icon: 'help-outline', label: 'Help Center', route: '#' },
  { icon: 'info-outline', label: 'About DiskarTech', route: '#' },
  { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
];

export default function ProfileScreen() {
  // States para sa Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [isAddSkillModalVisible, setAddSkillModalVisible] = useState(false);

  // States para sa Availability
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [isAvailabilityModalVisible, setAvailabilityModalVisible] = useState(false);

  // Format para sa display ng schedule
  const formatScheduleText = () => {
    if (selectedDays.length === 0) return 'No days selected';
    return `${selectedDays.join(', ')} | ${selectedTimeSlot}`;
  };

  return (
    <ScrollView className="flex-1 bg-[#F8FAFC]" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Profile</Text>
      </View>

      {/* Profile Card */}
      <View className="bg-white mx-6 rounded-2xl p-6 items-center shadow-md mb-4">
        <View className="relative mb-4">
          <Avatar
            uri="https://ui-avatars.com/api/?name=Junnyl+Mabini&background=D32F2F&color=fff&size=200"
            name="Junnyl Mabini"
            size={80}
            verified={false}
          />
          <TouchableOpacity className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-600 items-center justify-center border-2 border-white">
            <MaterialIcons name="camera-alt" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <Text className="text-xl font-bold text-slate-900">Junnyl Mabini</Text>
        <Text className="text-xs text-slate-500 mt-[2px]">junnyl.mabini@example.com</Text>
        <Badge 
          text="Pending Verification" 
          variant="warning" 
          icon="hourglass-empty" 
          style={{ marginTop: 8, alignSelf: 'center' }} 
        />
      </View>

      {/* Document Upload Placeholders */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">Documents & Verification</Text>
        <DocumentPlaceholderCard icon="description" title="Resume" status="Not uploaded yet" />
        <DocumentPlaceholderCard icon="badge" title="School ID" status="Not uploaded yet" />
        <DocumentPlaceholderCard icon="insert-drive-file" title="COR (Certificate of Registration)" status="Not uploaded yet" />
      </View>

      {/* Student Info */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">Student Information</Text>
        <InfoRow icon="school" label="School" value="Not specified" />
        <InfoRow icon="menu-book" label="Course" value="Not specified" />
        <InfoRow icon="format-list-numbered" label="Year Level" value="Not specified" />
        <InfoRow icon="location-on" label="Location" value="Not specified" />
      </View>

      {/* Skills Section */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-1">Skills</Text>
        <Text className="text-xs text-slate-400 mb-4">
          Show your top skills — add up to 5 skills you want to be known for.
        </Text>

        {skills.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {skills.map((skill, index) => (
              <View 
                key={index} 
                className="flex-row items-center bg-red-50 border border-red-100 rounded-full px-3.5 py-2"
              >
                <Text className="text-xs font-semibold text-red-600 mr-2">{skill}</Text>
                <TouchableOpacity onPress={() => setSkills(skills.filter((_, i) => i !== index))}>
                  <MaterialIcons name="close" size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-xs text-slate-400 italic mb-4">No skills added yet.</Text>
        )}

        <TouchableOpacity 
          onPress={() => {
            if (skills.length >= 5) {
              alert('You can only add up to 5 skills.');
              return;
            }
            setAddSkillModalVisible(true);
          }}
          className="flex-row items-center justify-center border border-gray-300 rounded-full py-2.5 px-4 self-start"
        >
          <MaterialIcons name="add" size={16} color="#0F172A" style={{ marginRight: 6 }} />
          <Text className="text-xs font-semibold text-slate-800">Add skill</Text>
        </TouchableOpacity>
      </View>

      {/* Availability Section */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
          <Text className="text-lg font-bold text-slate-900">Availability</Text>
          <TouchableOpacity onPress={() => setAvailabilityModalVisible(true)}>
            <Text className="text-red-600 font-bold text-xs">EDIT</Text>
          </TouchableOpacity>
        </View>
        <InfoRow icon="schedule" label="Available Schedule" value={formatScheduleText()} />
        <InfoRow icon="work" label="Preferred Job Type" value="Part-time" />
      </View>

      {/* Menu */}
      <View className="bg-white mx-6 rounded-2xl shadow-sm mb-12 overflow-hidden">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            className={`flex-row items-center p-4 border-b border-gray-100 gap-4 ${
              index === menuItems.length - 1 ? 'border-b-0' : ''
            }`}
            onPress={() => {
              if (item.route === '/auth/welcome') {
                router.replace(item.route as any);
              } else if (item.route !== '#') {
                router.push(item.route as any);
              }
            }}
          >
            <MaterialIcons
              name={item.icon as any}
              size={22}
              color={item.danger ? Colors.error : Colors.text}
            />
            <Text className={`text-base text-slate-900 flex-1 ${item.danger ? 'text-red-600' : ''}`}>
              {item.label}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </View>

      {/* HIWALAY NA MODALS NA NAKASALALAY SA FOLDER */}
      <AddSkillModal
        visible={isAddSkillModalVisible}
        onClose={() => setAddSkillModalVisible(false)}
        onAddSkill={(newSkill) => setSkills([...skills, newSkill])}
      />

      <EditAvailabilityModal
        visible={isAvailabilityModalVisible}
        onClose={() => setAvailabilityModalVisible(false)}
        currentDays={selectedDays}
        currentTimeSlot={selectedTimeSlot}
        onSave={(days, timeSlot) => {
          setSelectedDays(days);
          setSelectedTimeSlot(timeSlot);
        }}
      />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-4 mb-4">
      <MaterialIcons name={icon} size={18} color={Colors.gray500} />
      <View className="flex-1">
        <Text className="text-xs text-slate-400">{label}</Text>
        <Text className="text-sm font-medium text-slate-900 mt-[2px]">{value}</Text>
      </View>
    </View>
  );
}

function DocumentPlaceholderCard({ icon, title, status }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; status: string }) {
  return (
    <View 
      style={{ backgroundColor: Colors.primary + '04', borderColor: Colors.primary + '15' }}
      className="flex-row items-center rounded-2xl p-4 gap-4 mb-3 border-[1.5px] border-dashed"
    >
      <View 
        style={{ backgroundColor: Colors.primary + '10' }}
        className="w-12 h-12 rounded-xl items-center justify-center"
      >
        <MaterialIcons name={icon} size={26} color={Colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-bold text-red-600 mb-[2px]">{title}</Text>
        <Text className="text-sm font-semibold text-slate-800">{status}</Text>
      </View>
      <TouchableOpacity className="bg-red-50 px-3 py-1.5 rounded-xl">
        <Text className="text-xs font-semibold text-red-600">Upload</Text>
      </TouchableOpacity>
    </View>
  );
}