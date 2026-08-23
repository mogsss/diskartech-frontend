import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import PrimaryButton from '@/components/ui/PrimaryButton';
import InterviewModal from '@/components/modals/employer/InterviewModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios';
import { db } from '@/utils/firebase';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ApplicantDetailsScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States para sa Interview Modal
  const [isInterviewModalVisible, setIsInterviewModalVisible] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');

  const STORAGE_URL = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '/storage/') : 'http://192.168.1.2:8000/storage/';

  useEffect(() => {
    const fetchApplicationDetails = async () => {
      if (!applicationId) return;
      try {
        const response = await api.get(`/employer/applications/${applicationId}`);
        if (response.data && response.data.status === 'success') {
          setApplication(response.data.application);
        }
      } catch (error) {
        console.error('Error fetching application details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationDetails();
  }, [applicationId]);

  // Kunin ang employer address para sa default walk-in location
  const job = application?.job || {};
  const employerAddress =
    job.employer?.address ||
    job.household?.address ||
    job.employer?.location ||
    job.household?.location ||
    'Office Address';

  // Function para buksan ang modal at i-load ang default address
  const handleOpenInterviewModal = async () => {
    try {
      const response = await api.get('/user/profile');

      if (response.data && response.data.status === 'success') {
        const profile = response.data.profile;
        // Pagsamahin ang location at detailed_address para mas kumpleto, o gamitin ang location
        const employerAddress = [profile?.detailed_address, profile?.location].filter(Boolean).join(', ');
        setInterviewLocation(employerAddress);
      }
    } catch (error) {
      console.error('Error fetching user profile address:', error);
      setInterviewLocation('');
    } finally {
      setIsInterviewModalVisible(true);
    }
  };

  // Standard status update (para sa accept, reject, etc.)
  const handleUpdateStatus = async (newStatus: 'accepted' | 'rejected') => {
    try {
      const response = await api.put(`/employer/applications/${applicationId}/status`, {
        status: newStatus,
      });

      if (response.data && response.data.status === 'success') {
        Alert.alert('Success', `Application has been ${newStatus}.`);
        setApplication((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update application status.');
    }
  };

  // I-handle ang Interview Invite mula sa Modal (may kasamang interviewType)
  const handleSendInterviewInvite = async (interviewType: string, date: string, time: string, location: string) => {
    if (!date || !time || !location) {
      Alert.alert('Incomplete Details', 'Please fill in all the required fields.');
      return;
    }

    try {
      const response = await api.put(`/employer/applications/${applicationId}/status`, {
        status: 'interview',
      });

      if (response.data && response.data.status === 'success') {
        setApplication((prev: any) => ({ ...prev, status: 'interview' }));
        setIsInterviewModalVisible(false);

        // KAININ ANG EXACT CURRENT USER ID MULA SA ASYNCSTORAGE (Tulad ng ginagawa ng ChatScreen)
        let loggedInUserId = '39'; // Fallback
        try {
          const storedProfile = await AsyncStorage.getItem('userProfile');
          if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            loggedInUserId = profile.id?.toString() || profile.email || '39';
          }
        } catch (storageErr) {
          console.error('Error reading userProfile from AsyncStorage:', storageErr);
        }

        const student = application.student || {};
        const job = application.job || {};
        const ownerId = String(job.employer_id || job.household_id || job.user_id || loggedInUserId);

        let companyName = job.household?.household_name || job.employer?.employer_name || 'Employer';
        try {
          const profileRes = await api.get('/user/profile');
          if (profileRes.data && profileRes.data.status === 'success' && profileRes.data.profile) {
            const profile = profileRes.data.profile;
            companyName = profile.employer_name || profile.household_name || profile.hirer_name || companyName;
          }
        } catch (profileErr) {
          console.error('Error fetching profile details for chat:', profileErr);
        }

        const jobId = job.id || application.job_id;
        const studentChatId = student.user_id ? student.user_id.toString() : (student.id?.toString() || 'student_default');
        const studentName = student.student_name || 'Student Applicant';

        let studentAvatar = student.avatar ? (student.avatar.startsWith('http') ? student.avatar : `${STORAGE_URL}${student.avatar}`) : '';
        let employerAvatar = (job.household?.avatar || job.employer?.avatar) ? (job.household?.avatar || job.employer?.avatar) : '';
        if (employerAvatar && !employerAvatar.startsWith('http')) {
          employerAvatar = `${STORAGE_URL}${employerAvatar}`;
        }

        const chatId = `job_${jobId}_employer_${ownerId}_student_${studentChatId}`;
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);

        const inviteMessage = `Hello ${studentName}! You are invited for a ${interviewType.toUpperCase()} interview for "${job.title || 'Job'}".\n\n📅 Date: ${date}\n⏰ Time: ${time}\n📍 ${interviewType === 'walk-in' ? 'Address' : 'Link'}: ${location}`;

        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            studentId: studentChatId,
            ownerId: loggedInUserId, // Gamitin ang loggedInUserId para mag-match sa ChatScreen
            employerName: companyName,
            studentName: studentName,
            employerAvatar: employerAvatar,
            studentAvatar: studentAvatar,
            lastMessage: inviteMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unreadByStudent: true,
            unreadByEmployer: false,
            createdAt: new Date(),
          });
        } else {
          await setDoc(chatRef, {
            lastMessage: inviteMessage,
            employerName: companyName,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unreadByStudent: true,
          }, { merge: true });
        }

        // GAMITIN ANG loggedInUserId BILANG senderId PARA MAG-MATCH SA `currentUserId` NG CHAT SCREEN
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text: inviteMessage,
          senderId: loggedInUserId, // Dito magtutugma ang data.senderId === currentUserId sa ChatScreen!
          senderName: companyName,
          createdAt: new Date(),
        });

        Alert.alert('Success', 'Interview invitation sent successfully and message was delivered to chat!');
      }
    } catch (error) {
      console.error('Error sending interview invite:', error);
      Alert.alert('Error', 'Failed to send interview invitation.');
    }
  };

  const handleDeleteApplication = () => {
    Alert.alert(
      'Delete Application',
      'Are you sure you want to delete this application? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/employer/applications/${applicationId}`);
              if (response.data && response.data.status === 'success') {
                Alert.alert('Success', 'Application has been deleted.');
                router.back();
              }
            } catch (error) {
              console.error('Error deleting application:', error);
              Alert.alert('Error', 'Failed to delete application.');
            }
          },
        },
      ]
    );
  };

  const handleOpenResume = (resumePath: string) => {
    if (!resumePath) {
      Alert.alert('Notice', 'No resume uploaded by this student.');
      return;
    }
    Linking.openURL(`${STORAGE_URL}${resumePath}`).catch(() => {
      Alert.alert('Error', 'Unable to open resume file.');
    });
  };

  const handleStartChat = async () => {
    try {
      if (!application) return;
      const student = application.student || {};
      const jobId = job.id || application.job_id;
      const ownerId = job.employer_id || job.household_id || job.user_id || 'employer_default';
      const studentChatId = student.user_id ? student.user_id.toString() : (student.id?.toString() || 'student_default');
      const studentName = student.student_name || 'Student Applicant';
      const companyName = job.household?.household_name || job.employer?.employer_name || 'Employer';

      let studentAvatar = student.avatar ? (student.avatar.startsWith('http') ? student.avatar : `${STORAGE_URL}${student.avatar}`) : '';
      let employerAvatar = (job.household?.avatar || job.employer?.avatar) ? (job.household?.avatar || job.employer?.avatar) : '';
      if (employerAvatar && !employerAvatar.startsWith('http')) {
        employerAvatar = `${STORAGE_URL}${employerAvatar}`;
      }

      const chatId = `job_${jobId}_employer_${ownerId}_student_${studentChatId}`;
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          studentId: studentChatId,
          ownerId: ownerId,
          employerName: companyName,
          studentName: studentName,
          employerAvatar: employerAvatar,
          studentAvatar: studentAvatar,
          online: true,
          createdAt: new Date(),
        });
      }

      router.push(`/chat?id=${chatId}` as any);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Paalala', 'Hindi mabuksan ang chat sa ngayon.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F8FAFC]">
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (!application) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F8FAFC]">
        <Text className="text-slate-600 font-semibold">Application details not found.</Text>
      </View>
    );
  }

  const student = application.student || {};
  const isFinalStatus = application.status === 'rejected' || application.status === 'cancelled' || application.status === 'accepted';
  const studentAddress = [student.detailed_address, student.location].filter(Boolean).join(', ');

  let availableDaysText = 'N/A';
  try {
    if (student.available_days) {
      const days = typeof student.available_days === 'string' ? JSON.parse(student.available_days) : student.available_days;
      availableDaysText = Array.isArray(days) ? days.join(', ') : student.available_days;
    }
  } catch (e) {
    availableDaysText = student.available_days || 'N/A';
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        {/* Header */}
        <View className="flex-row items-center mb-4 pt-4">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4">
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-900 flex-1" numberOfLines={1}>Applicant Details</Text>
          <TouchableOpacity onPress={handleDeleteApplication} className="w-10 h-10 rounded-full bg-red-50 items-center justify-center">
            <MaterialIcons name="delete-outline" size={22} color="#DC2626" />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View className="bg-white rounded-2xl p-6 items-center shadow-md mb-4">
          <Avatar uri={student.avatar ? `${STORAGE_URL}${student.avatar}` : undefined} name={student.student_name} size={80} />
          <Text className="text-xl font-bold text-slate-900 mt-4 text-center">{student.student_name || 'Unknown'}</Text>
          <Text className="text-sm text-slate-500 mt-0.5 text-center">{student.course || student.student_school_name || 'Student Applicant'}</Text>
          <View className="mt-3" style={{ alignSelf: 'center' }}>
            <Badge
              text={application.status === 'interview' ? 'For Interview' : application.status ? application.status.charAt(0).toUpperCase() + application.status.slice(1) : 'Pending'}
              variant={application.status === 'pending' ? 'default' : application.status === 'viewed' ? 'info' : application.status === 'interview' ? 'warning' : application.status === 'accepted' ? 'success' : 'error'}
            />
          </View>
        </View>

        {/* Personal Details */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">Personal Details</Text>
          <View className="flex-row items-start gap-4 mb-3">
            <MaterialIcons name="cake" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Age</Text>
              <Text className="text-sm text-slate-500 mt-0.5">{student.age ? `${student.age} years old` : 'N/A'}</Text>
            </View>
          </View>
          <View className="flex-row items-start gap-4">
            <MaterialIcons name="location-on" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Address</Text>
              <Text className="text-sm text-slate-500 mt-0.5">{studentAddress || 'No address specified'}</Text>
            </View>
          </View>
        </View>

        {/* Applied Position */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-3">Applied Position</Text>
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
              <MaterialIcons name="work" size={20} color={Colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">{job.title || 'Job Position'}</Text>
              <Text className="text-xs text-slate-500 mt-0.5">{job.salary ? `₱${job.salary}` : 'View details below'}</Text>
            </View>
          </View>
        </View>

        {/* School Information */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">School Information</Text>
          <View className="flex-row items-start gap-4 mb-4">
            <MaterialIcons name="school" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">{student.student_school_name || 'No school specified'}</Text>
              <Text className="text-sm text-slate-500 mt-0.5">{student.course || 'No course specified'}</Text>
            </View>
          </View>
          <View className="flex-row items-start gap-2">
            <MaterialIcons name="star" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Year Level</Text>
              <Text className="text-sm text-slate-500 mt-0.5">{student.year_level || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Resume */}
        <TouchableOpacity onPress={() => handleOpenResume(student.student_resume)} className="bg-white rounded-2xl p-4 mb-4 shadow-sm flex-row items-center">
          <View className="flex-row items-center gap-4 flex-1">
            <MaterialIcons name="description" size={24} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Resume</Text>
              <Text className="text-sm text-slate-500 mt-0.5" numberOfLines={1}>{student.student_resume ? 'View / Download Resume' : 'No Resume Uploaded'}</Text>
            </View>
            <MaterialIcons name="download" size={20} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        {!isFinalStatus ? (
          <View className="mt-2">
            {application.status !== 'interview' && (
              <PrimaryButton
                title="Invite for Interview"
                onPress={handleOpenInterviewModal}
                variant="primary"
                size="medium"
                style={{ marginBottom: 8 }}
                icon={<MaterialIcons name="event-available" size={20} color={Colors.white} />}
              />
            )}

            {application.status === 'interview' && (
              <PrimaryButton
                title="Accept / Hire Applicant"
                onPress={() => handleUpdateStatus('accepted')}
                variant="primary"
                size="medium"
                style={{ marginBottom: 8 }}
                icon={<MaterialIcons name="check-circle" size={20} color={Colors.white} />}
              />
            )}

            <View className="flex-row justify-between">
              <View style={{ width: '48%' }}>
                <PrimaryButton title="Reject" onPress={() => handleUpdateStatus('rejected')} variant="outline" size="medium" />
              </View>
              <View style={{ width: '48%' }}>
                <PrimaryButton title="Message" onPress={handleStartChat} variant="secondary" size="medium" icon={<MaterialIcons name="message" size={18} color={Colors.primary} />} />
              </View>
            </View>
          </View>
        ) : (
          <View className="mt-4 p-4 bg-gray-100 rounded-2xl items-center">
            <Text className="text-sm font-semibold text-slate-500 text-center">
              This application has been {application.status}. No further actions available.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Hiwalay na Interview Modal Component na may Default Address */}
      <InterviewModal
        visible={isInterviewModalVisible}
        onClose={() => setIsInterviewModalVisible(false)}
        onSubmit={handleSendInterviewInvite}
        date={interviewDate}
        setDate={setInterviewDate}
        time={interviewTime}
        setTime={setInterviewTime}
        location={interviewLocation}
        setLocation={setInterviewLocation}
        defaultAddress={employerAddress}
      />
    </View>
  );
}