import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import AddSkillModal from '@/components/modals/student/AddSkillModal';
import EditAvailabilityModal from '@/components/modals/student/EditAvailabilityModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useCallback } from 'react'; // 👈 Idinagdag ang useCallback
import { ScrollView, Text, TouchableOpacity, View, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import DocumentPlaceholderCard from '@/components/ui/student/DocumentPlaceholderCard';
import * as ImagePicker from 'expo-image-picker';
import api from '@/api/axios';
import { useFocusEffect } from '@react-navigation/native'; // 👈 Idinagdag para mag-refresh tuwing tututok sa screen

const menuItems = [
  { icon: 'settings', label: 'Settings', route: '/settings' },
  { icon: 'help-outline', label: 'Help Center', route: '#' },
  { icon: 'info-outline', label: 'About DiskarTech', route: '#' },
  { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
];

export default function ProfileScreen() {
  const [studentName, setStudentName] = useState('Junnyl Mabini');
  const [studentEmail, setStudentEmail] = useState('junnyl.mabini@example.com');
  const [school, setSchool] = useState('Not specified');
  const [course, setCourse] = useState('Not specified');
  const [yearLevel, setYearLevel] = useState('Not specified');
  const [location, setLocation] = useState('Not specified');
  const [isVerified, setIsVerified] = useState(false);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);

  const [skills, setSkills] = useState<string[]>([]);
  const [isAddSkillModalVisible, setAddSkillModalVisible] = useState(false);

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [isAvailabilityModalVisible, setAvailabilityModalVisible] = useState(false);

  // Global fetch function na kumukuha sa /student/profile API endpoint
  const fetchStudentProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('Stored Token:', token);

      try {
        const response = await api.get('/student/profile');
        console.log('API Student Profile Response:', response.data);

        const profileData = response.data.profile || response.data;

        if (profileData) {
          if (profileData.student_name) setStudentName(profileData.student_name);
          if (profileData.student_school_name || profileData.school_name) {
            setSchool(profileData.student_school_name || profileData.school_name);
          }
          if (profileData.course) setCourse(profileData.course);
          if (profileData.year_level) setYearLevel(profileData.year_level);
          if (profileData.location || profileData.address) {
            setLocation(profileData.location || profileData.address);
          }
          if (profileData.isVerified !== undefined) {
            setIsVerified(profileData.isVerified === 1 || profileData.isVerified === true);
          }

          if (profileData.avatar || profileData.profile_picture) {
            const avatarPath = profileData.avatar || profileData.profile_picture;
            const fullAvatarUrl = avatarPath.startsWith('http')
              ? avatarPath
              : `http://192.168.1.2:8000/storage/${avatarPath}`;
            setProfilePicUri(fullAvatarUrl);
          }

          if (profileData.skillset && Array.isArray(profileData.skillset)) {
            setSkills(profileData.skillset);
          }

          if (profileData.available_days) setSelectedDays(profileData.available_days);
          if (profileData.time_slot) setSelectedTimeSlot(profileData.time_slot);
        }

        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser && storedUser !== 'null') {
          const user = JSON.parse(storedUser);
          if (user.email) setStudentEmail(user.email);
        }

      } catch (apiErr) {
        console.log('API fetch failed, fallback to AsyncStorage:', apiErr);

        const storedProfile = await AsyncStorage.getItem('userProfile');
        const storedUser = await AsyncStorage.getItem('userData');

        if (storedProfile && storedProfile !== 'null') {
          const profile = JSON.parse(storedProfile);
          if (profile.student_name) setStudentName(profile.student_name);
          if (profile.student_school_name) setSchool(profile.student_school_name);
          if (profile.course) setCourse(profile.course);
          if (profile.year_level) setYearLevel(profile.year_level);
          if (profile.location) setLocation(profile.location);
          if (profile.isVerified !== undefined) setIsVerified(profile.isVerified);
        }

        if (storedUser && storedUser !== 'null') {
          const user = JSON.parse(storedUser);
          if (user.email) setStudentEmail(user.email);
        }
      }
    } catch (error) {
      console.error('Error loading student profile from storage:', error);
    }
  };

  // 👇 Ginamit na natin ang useFocusEffect para mag-refresh kada bukas ng profile screen
  useFocusEffect(
    useCallback(() => {
      fetchStudentProfile();
    }, [])
  );

  const handleSaveAvailability = async (days: string[], timeSlot: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/student/update-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          days: days,
          time_slot: timeSlot,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSelectedDays(days);
        setSelectedTimeSlot(timeSlot);
        setAvailabilityModalVisible(false);
        alert('Availability updated successfully!');
        fetchStudentProfile(); // I-refresh ang data
      } else {
        alert(data.message || 'Failed to update availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleSaveSkills = async (updatedSkills: string[]) => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/student/update-skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          skills: updatedSkills,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSkills(updatedSkills);
        setAddSkillModalVisible(false);
        fetchStudentProfile(); // I-refresh ang data
      } else {
        alert(data.message || 'Failed to update skills');
      }
    } catch (error) {
      console.error('Error saving skills:', error);
      alert('Network error. Please try again.');
    }
  };

  const handleUploadDocument = async (documentType: string, title: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileToUpload = result.assets[0];
      const formData = new FormData();
      formData.append('document_type', documentType);
      formData.append('file', {
        uri: fileToUpload.uri,
        name: fileToUpload.name,
        type: fileToUpload.mimeType || 'application/pdf',
      } as any);

      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/student/upload-doc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        alert(`${title} has been uploaded and saved successfully!`);
        fetchStudentProfile();
      } else {
        alert(data.message || `Failed to upload ${title}. Please try again.`);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('An error occurred while uploading.');
    }
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      await fetch('http://192.168.1.2:8000/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error logging out from server:', error);
    } finally {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userProfile');
      await AsyncStorage.removeItem('userData');

      router.replace('/auth/welcome' as any);
    }
  };

  const handleUploadProfilePic = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const fileToUpload = result.assets[0];
      const formData = new FormData();
      
      formData.append('document_type', 'profile_picture'); 
      formData.append('file', {
        uri: fileToUpload.uri,
        name: fileToUpload.fileName || 'profile.jpg',
        type: fileToUpload.mimeType || 'image/jpeg',
      } as any);

      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/student/upload-doc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Server returned HTML instead of JSON:', responseText);
        alert('Server Error: Nagbalik ang Laravel ng HTML error page.');
        return;
      }

      if (response.ok) {
        alert('Profile picture uploaded successfully!');
        fetchStudentProfile(); 
      } else {
        alert(data.message || 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('An error occurred while uploading profile picture.');
    }
  };

  const formatScheduleText = () => {
    if (!selectedDays || selectedDays.length === 0) return 'No days selected';
    return `${selectedDays.join(', ')} | ${selectedTimeSlot || ''}`;
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

      {/* Document Upload Placeholders  */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">Documents & Verification</Text>
        <DocumentPlaceholderCard
          icon="description"
          title="Resume"
          status="Not uploaded yet"
          onUpload={() => handleUploadDocument('student_resume', 'Resume')}
        />
        <DocumentPlaceholderCard
          icon="badge"
          title="School ID"
          status="Not uploaded yet"
          onUpload={() => handleUploadDocument('school_id', 'School ID')}
        />
        <DocumentPlaceholderCard
          icon="insert-drive-file"
          title="COR (Certificate of Registration)"
          status="Not uploaded yet"
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
                handleLogout();
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
        onSave={(days, timeSlot) => {
          handleSaveAvailability(days, timeSlot);
        }}
      />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: any }) {
  return (
    <View className="flex-row items-start gap-4 mb-4">
      <MaterialIcons name={icon} size={18} color={Colors.gray500} />
      <View className="flex-1">
        <Text className="text-xs text-slate-400">{String(label || '')}</Text>
        <Text className="text-sm font-medium text-slate-900 mt-[2px]">
          {String(value !== undefined && value !== null ? value : 'Not specified')}
        </Text>
      </View>
    </View>
  );
}