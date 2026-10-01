import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { router } from 'expo-router';

import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import AddSkillModal from '@/components/student/modals/AddSkillModal';
import EditAvailabilityModal from '@/components/student/modals/EditAvailabilityModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import DocumentCard from '@/components/student/DocumentCard'; 
import InfoRow from '@/components/ui/InfoRow'; 

// Custom Hook natin!
import { useStudentProfile } from '@/hooks/useStudentProfile'; 

const menuItems = [
  { icon: 'settings', label: 'Settings', route: '/settings' },
  { icon: 'help-outline', label: 'Help Center', route: '#' },
  { icon: 'info-outline', label: 'About DiskarTech', route: '#' },
  { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
];

export default function ProfileScreen() {
  // Hinatak natin palabas lahat ng data at functions galing sa Custom Hook
  const {
    studentName, studentEmail, school, course, yearLevel, location, isVerified, profilePicUri, uploadedDocs,
    skills, isAddSkillModalVisible, setAddSkillModalVisible, handleSaveSkills,
    selectedDays, selectedTimeSlot, isAvailabilityModalVisible, setAvailabilityModalVisible, handleSaveAvailability, formatScheduleText,
    isLogoutModalVisible, setLogoutModalVisible, handleLogout,
    alertModalVisible, setAlertModalVisible, alertModalConfig, showAlertModal,
    handleUploadDocument, handleUploadProfilePic
  } = useStudentProfile();

  return (
    <ScrollView className="flex-1 bg-[#F8FAFC]" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Profile</Text>
      </View>

      {/* Profile Card */}
      <View className="bg-white mx-6 rounded-2xl p-6 items-center shadow-md mb-4">
        <View className="relative mb-4">
          {profilePicUri ? (
            <Image 
              source={{ uri: profilePicUri }} 
              style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#e2e8f0' }} 
              onError={(e) => console.log('Image Load Error:', e.nativeEvent.error)} 
            />
          ) : (
            <Avatar
              uri={`https://ui-avatars.com/api/?name=${encodeURIComponent(String(studentName || 'User'))}&background=D32F2F&color=fff&size=200`}
              name={String(studentName || 'User')}
              size={80}
              verified={Boolean(isVerified)}
            />
          )}
          <TouchableOpacity onPress={handleUploadProfilePic} className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-600 items-center justify-center border-2 border-white">
            <MaterialIcons name="camera-alt" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <Text className="text-xl font-bold text-slate-900">{String(studentName || '')}</Text>
        <Text className="text-xs text-slate-500 mt-[2px]">{String(studentEmail || '')}</Text>
        <Badge
          text={isVerified ? "Verified Student" : "Pending Verification"}
          variant={isVerified ? "success" : "warning"}
          icon={isVerified ? "check-circle" : "hourglass-empty"}
          style={{ marginTop: 8, alignSelf: 'center' }}
        />
      </View>

      {/* Documents & Verification */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">Documents & Verification</Text>
        
        {/* 👇 PINALITAN ANG isUploaded NG filename */}
        <DocumentCard
          icon="description"
          title="Resume"
          filename={uploadedDocs.student_resume}
          onUpload={() => handleUploadDocument('student_resume', 'Resume')}
        />
        <DocumentCard
          icon="badge"
          title="School ID"
          filename={uploadedDocs.school_id}
          onUpload={() => handleUploadDocument('school_id', 'School ID')}
        />
        <DocumentCard
          icon="insert-drive-file"
          title="COR (Certificate of Reg.)"
          filename={uploadedDocs.coe}
          onUpload={() => handleUploadDocument('coe', 'COR')}
        />
      </View>

      {/* Student Info */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">Student Information</Text>
        <InfoRow icon="school" label="School" value={school} />
        <InfoRow icon="menu-book" label="Course" value={course} />
        <InfoRow icon="format-list-numbered" label="Year Level" value={yearLevel} />
        <InfoRow icon="location-on" label="Location" value={location} />
      </View>

      {/* Skills Section */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-1">Skills</Text>
        <Text className="text-xs text-slate-400 mb-4">
          Show your top skills — add up to 5 skills you want to be known for.
        </Text>

        {skills && skills.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {skills
              .filter((skill) => skill && typeof skill === 'string')
              .map((skill, index) => (
                <View
                  key={index.toString()}
                  className="flex-row items-center bg-red-50 border border-red-100 rounded-full px-3.5 py-2"
                >
                  <Text className="text-xs font-semibold text-red-600 mr-2">
                    {String(skill)}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    const updatedSkills = skills.filter((_, i) => i !== index);
                    handleSaveSkills(updatedSkills);
                  }}>
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
              showAlertModal({
                title: 'Limit Reached', message: 'You can only add up to 5 skills.', iconName: 'warning',
                iconColor: '#f59e0b', iconBgColor: 'bg-amber-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
              });
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
                setLogoutModalVisible(true);
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

      {/* MODALS */}
      <AddSkillModal
        visible={isAddSkillModalVisible}
        onClose={() => setAddSkillModalVisible(false)}
        onAddSkill={(newSkill) => {
          const updatedSkills = [...skills, newSkill];
          handleSaveSkills(updatedSkills);
        }}
      />

      <EditAvailabilityModal
        visible={isAvailabilityModalVisible}
        onClose={() => setAvailabilityModalVisible(false)}
        currentDays={selectedDays}
        currentTimeSlot={selectedTimeSlot}
        onSave={(days, timeSlot) => handleSaveAvailability(days, timeSlot)}
      />

      <NotificationModal
        visible={alertModalVisible}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        iconName={alertModalConfig.iconName}
        iconColor={alertModalConfig.iconColor}
        iconBgColor={alertModalConfig.iconBgColor}
        primaryButtonText={alertModalConfig.primaryButtonText}
        onPrimaryPress={alertModalConfig.onPrimaryPress}
      />

      <NotificationModal
        visible={isLogoutModalVisible}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        iconName="logout"
        iconColor="#DC2626"
        iconBgColor="bg-red-50"
        primaryButtonText="Yes, Log Out"
        onPrimaryPress={handleLogout}
        secondaryButtonText="Cancel"
        onSecondaryPress={() => setLogoutModalVisible(false)}
      />
    </ScrollView>
  );
}