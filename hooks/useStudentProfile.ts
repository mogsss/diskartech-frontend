import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { clearPushToken } from '@/utils/notifications';

export function useStudentProfile() {
  const [studentName, setStudentName] = useState('Junnyl Mabini');
  const [studentEmail, setStudentEmail] = useState('junnyl.mabini@example.com');
  const [school, setSchool] = useState('Not specified');
  const [course, setCourse] = useState('Not specified');
  const [yearLevel, setYearLevel] = useState('Not specified');
  const [location, setLocation] = useState('Not specified');
  const [isVerified, setIsVerified] = useState(false);
  
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);

  // 👇 GINAWANG STRING | NULL PARA MA-SAVE ANG FILENAME
  const [uploadedDocs, setUploadedDocs] = useState<{
    student_resume: string | null;
    school_id: string | null;
    coe: string | null;
  }>({
    student_resume: null,
    school_id: null,
    coe: null
  });

  const [skills, setSkills] = useState<string[]>([]);
  const [isAddSkillModalVisible, setAddSkillModalVisible] = useState(false);

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [isAvailabilityModalVisible, setAvailabilityModalVisible] = useState(false);

  const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertModalConfig, setAlertModalConfig] = useState<any>({});

  const showAlertModal = (config: any) => {
    setAlertModalConfig(config);
    setAlertModalVisible(true);
  };

  // 👇 HELPER FUNCTION PARA KUNIN ANG FILENAME SA DULO NG PATH
  const getFilename = (path?: string) => {
    if (!path || typeof path !== 'string') return null;
    return path.split('/').pop() || null; 
  };

  const fetchStudentProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      const storedUser = await AsyncStorage.getItem('userData');

      if (storedProfile && storedProfile !== 'null' && storedProfile !== 'undefined') {
        const profile = JSON.parse(storedProfile);

        if (profile.student_name) setStudentName(profile.student_name);
        if (profile.student_school_name) setSchool(profile.student_school_name);
        if (profile.course) setCourse(profile.course);
        if (profile.year_level) setYearLevel(profile.year_level);
        if (profile.location) setLocation(profile.location);
        if (profile.isVerified !== undefined) setIsVerified(profile.isVerified);

        if (profile.avatar) {
          const fullAvatarUrl = profile.avatar.startsWith('http')
            ? profile.avatar
            : `http://192.168.1.2:8000/storage/${profile.avatar}`;
          setProfilePicUri(fullAvatarUrl);
        }

        // 👇 IN-UPDATE PARA GAMITIN ANG GETFILENAME
        setUploadedDocs({
          student_resume: getFilename(profile.student_resume),
          school_id: getFilename(profile.school_id),
          coe: getFilename(profile.coe)
        });

        if (profile.skillset && Array.isArray(profile.skillset)) {
          setSkills(profile.skillset);
        } else {
          setSkills([]);
        }

        if (profile.available_days) setSelectedDays(profile.available_days);
        if (profile.time_slot) setSelectedTimeSlot(profile.time_slot);
      }

      if (storedUser && storedUser !== 'null' && storedUser !== 'undefined') {
        const user = JSON.parse(storedUser);
        if (user.email) setStudentEmail(user.email);
      }
    } catch (error) {
      console.error('Error loading student profile from storage:', error);
    }
  };

  useEffect(() => {
    fetchStudentProfile();
  }, []);

  const handleSaveAvailability = async (days: string[], timeSlot: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/student/update-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ days, time_slot: timeSlot }),
      });

      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch (e) {
        showAlertModal({
          title: 'Server Error', message: 'Nagbalik ng HTML page ang server.', iconName: 'error-outline',
          iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
        });
        return;
      }

      if (response.ok) {
        setSelectedDays(days);
        setSelectedTimeSlot(timeSlot);
        setAvailabilityModalVisible(false);
        
        showAlertModal({
          title: 'Success!', message: 'Your availability has been updated successfully.', iconName: 'check-circle',
          iconColor: '#16a34a', iconBgColor: 'bg-green-50', primaryButtonText: 'Awesome', onPrimaryPress: () => setAlertModalVisible(false),
        });

        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          profile.available_days = days;
          profile.time_slot = timeSlot;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }
      } else {
        showAlertModal({
          title: 'Update Failed', message: data.message || 'Failed to update availability', iconName: 'error-outline',
          iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'Try Again', onPrimaryPress: () => setAlertModalVisible(false),
        });
      }
    } catch (error) {
      showAlertModal({
        title: 'Network Error', message: 'Please check your internet connection.', iconName: 'wifi-off',
        iconColor: '#64748b', iconBgColor: 'bg-slate-100', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
      });
    }
  };

  const handleSaveSkills = async (updatedSkills: string[]) => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/student/update-skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ skills: updatedSkills }),
      });

      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch (e) {
        showAlertModal({
          title: 'Server Error', message: 'Nagbalik ng HTML page ang server.', iconName: 'error-outline',
          iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
        });
        return;
      }

      if (response.ok) {
        setSkills(updatedSkills);
        setAddSkillModalVisible(false);

        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          profile.skillset = updatedSkills;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }
      } else {
        showAlertModal({
          title: 'Update Failed', message: data.message || 'Failed to update skills', iconName: 'error-outline',
          iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
        });
      }
    } catch (error) {
      showAlertModal({
        title: 'Network Error', message: 'Please check your connection and try again.', iconName: 'wifi-off',
        iconColor: '#64748b', iconBgColor: 'bg-slate-100', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
      });
    }
  };

  const handleUploadDocument = async (documentType: string, title: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

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
          'Accept': 'application/json',
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        const newPath = data.file_path || data[documentType];

        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          profile[documentType] = newPath;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }

        // 👇 IN-UPDATE PARA MAG-REFLECT AGAD ANG FILENAME SA SCREEN
        setUploadedDocs(prev => ({
          ...prev,
          [documentType]: getFilename(newPath)
        }));

        showAlertModal({
          title: 'Upload Successful',
          message: `${title} has been uploaded and saved successfully!`,
          iconName: 'cloud-done',
          iconColor: '#16a34a',
          iconBgColor: 'bg-green-50',
          primaryButtonText: 'Great',
          onPrimaryPress: () => setAlertModalVisible(false),
        });
        
        // Pwede pa ring i-call para ma-sync nang buo kung gusto mo
        fetchStudentProfile();
      } else {
        showAlertModal({
          title: 'Upload Failed',
          message: data.message || `Failed to upload ${title}. Please try again.`,
          iconName: 'error-outline',
          iconColor: '#ef4444',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'OK',
          onPrimaryPress: () => setAlertModalVisible(false),
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      showAlertModal({
        title: 'Error',
        message: 'An error occurred while uploading. Check your connection.',
        iconName: 'wifi-off',
        iconColor: '#64748b',
        iconBgColor: 'bg-slate-100',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setAlertModalVisible(false),
      });
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
          'Accept': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error logging out from server:', error);
    } finally {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          if (user?.id) await clearPushToken(user.id);
        }
      } catch {
        /* ignore */
      }

      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userProfile');
      await AsyncStorage.removeItem('userData');

      setLogoutModalVisible(false);
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

      if (result.canceled) return;

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
          'Accept': 'application/json',
        },
        body: formData,
      });

      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch (e) {
        showAlertModal({
          title: 'Server Error', message: 'Nagbalik ng HTML page ang server.', iconName: 'error-outline',
          iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
        });
        return;
      }

      if (response.ok) {
        const newPath = data.file_path || data.profile_picture;
        const fullUrl = `http://192.168.1.2:8000/storage/${newPath}`;
        
        setProfilePicUri(fullUrl); 

        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          profile.avatar = newPath;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }

        showAlertModal({
          title: 'Profile Updated', message: 'Profile picture uploaded successfully!', iconName: 'check-circle',
          iconColor: '#16a34a', iconBgColor: 'bg-green-50', primaryButtonText: 'Nice', onPrimaryPress: () => setAlertModalVisible(false),
        });

        fetchStudentProfile(); 
      } else {
        showAlertModal({
          title: 'Upload Failed', message: data.message || 'Failed to upload profile picture', iconName: 'error-outline',
          iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
        });
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      showAlertModal({
        title: 'Error', message: 'An error occurred while uploading profile picture.', iconName: 'error-outline',
        iconColor: '#ef4444', iconBgColor: 'bg-red-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
      });
    }
  };

  const formatScheduleText = () => {
    if (!selectedDays || selectedDays.length === 0) return 'No days selected';
    return `${selectedDays.join(', ')} | ${selectedTimeSlot || ''}`;
  };

  return {
    studentName, studentEmail, school, course, yearLevel, location, isVerified, profilePicUri, uploadedDocs,
    skills, isAddSkillModalVisible, setAddSkillModalVisible, handleSaveSkills,
    selectedDays, selectedTimeSlot, isAvailabilityModalVisible, setAvailabilityModalVisible, handleSaveAvailability, formatScheduleText,
    isLogoutModalVisible, setLogoutModalVisible, handleLogout,
    alertModalVisible, setAlertModalVisible, alertModalConfig, showAlertModal,
    handleUploadDocument, handleUploadProfilePic
  };
}