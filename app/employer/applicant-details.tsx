import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import PrimaryButton from '@/components/ui/PrimaryButton';
import InterviewModal from '@/components/employer/modals/InterviewModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureChatRoom,
  getOwnerParticipantFromStorage,
  isGenericName,
  resolveOwnerFromJob,
  resolveStudentFromRecord,
  sendChatMessage,
} from '@/utils/chat';
import { sendAppNotification } from '@/utils/notifications';

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

        // Live notification para kay student
        try {
          const student = resolveStudentFromRecord(application.student || {});
          const jobTitle = job?.title || application.job?.title || 'Job';
          if (student.student_user_id && student.student_user_id !== 'unknown') {
            const isApproved = newStatus === 'accepted';
            await sendAppNotification({
              recipientId: student.student_user_id,
              title: isApproved ? 'Application Approved' : 'Application Update',
              body: isApproved 
                ? `Congratulations! Your application for "${jobTitle}" has been APPROVED.`
                : `Your application for "${jobTitle}" was not accepted.`,
              type: 'application_status',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error sending application status notification:', notifErr);
        }
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

        const student = resolveStudentFromRecord(application.student || {});
        let owner = resolveOwnerFromJob(job);
        if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
          const storedOwner = await getOwnerParticipantFromStorage();
          owner = {
            owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
            owner_role: storedOwner.owner_role || owner.owner_role,
            owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
            owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
          };
        }
        const jobId = job.id || application.job_id || 'job';
        const jobTitle = job.title || 'Job Position';

        const inviteMessage = `Hello ${student.student_name}! You are invited for a ${interviewType.toUpperCase()} interview for "${jobTitle}".\n\nDate: ${date}\nTime: ${time}\n${interviewType === 'walk-in' ? 'Address' : 'Link'}: ${location}`;

        const chatId = await ensureChatRoom({
          jobId,
          jobTitle,
          owner,
          student,
          initiatorRole: 'owner',
        });

        await sendChatMessage({
          chatId,
          senderId: owner.owner_user_id,
          senderName: owner.owner_name,
          senderAvatar: owner.owner_avatar,
          receiverId: student.student_user_id,
          receiverName: student.student_name,
          text: inviteMessage,
        });

        // Live notification para kay student
        try {
          if (student.student_user_id && student.student_user_id !== 'unknown') {
            await sendAppNotification({
              recipientId: student.student_user_id,
              title: 'Interview Invitation',
              body: `You are invited for an interview for "${jobTitle}".`,
              type: 'application_status',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error sending interview notification:', notifErr);
        }

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
      const student = resolveStudentFromRecord(application.student || {});
      let owner = resolveOwnerFromJob(job);
      if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
        const storedOwner = await getOwnerParticipantFromStorage();
        owner = {
          owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
          owner_role: storedOwner.owner_role || owner.owner_role,
          owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
          owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
        };
      }
      const jobId = job.id || application.job_id || 'job';
      const jobTitle = job.title || 'Job Position';

      const chatId = await ensureChatRoom({
        jobId,
        jobTitle,
        owner,
        student,
        initiatorRole: 'owner',
      });

      router.push(`/chat?id=${chatId}` as any);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Notice', 'Unable to open chat at this time.');
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