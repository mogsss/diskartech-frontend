import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { formatDate } from '@/utils/helpers';
import { db } from '@/utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';

interface ApplicationDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    application: any | null;
    onApplicationCancelled?: () => void;
}

export default function ApplicationDetailsModal({ visible, onClose, application, onApplicationCancelled }: ApplicationDetailsModalProps) {
    const [companyName, setCompanyName] = useState('Employer');
    const [ownerId, setOwnerId] = useState('employer_default');
    const [employerAvatar, setEmployerAvatar] = useState('');
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        const fetchJobOwnerDetails = async () => {
            if (application && application.job_id) {
                try {
                    const response = await api.get(`/jobs/${application.job_id}`);
                    if (response.data && response.data.status === 'success') {
                        const jobData = response.data.job;

                        const resolvedOwnerId = jobData.employer_id || jobData.household_id || jobData.user_id || 'employer_default';
                        setOwnerId(resolvedOwnerId.toString());

                        // 👇 Sinusuri nang maayos kung household o employer ba ang nag-post para hindi magka-interchange ang avatar/pangalan
                        let rawAvatar = '';
                        let resolvedName = 'Employer';

                        if (jobData.household_id && jobData.household) {
                            resolvedName = jobData.household.household_name || 'Household';
                            rawAvatar = jobData.household.avatar || '';
                        } else if (jobData.employer_id && jobData.employer) {
                            resolvedName = jobData.employer.employer_name || 'Employer';
                            rawAvatar = jobData.employer.avatar || '';
                        } else {
                            resolvedName = jobData.household?.household_name || jobData.employer?.employer_name || 'Employer';
                            rawAvatar = jobData.household?.avatar || jobData.employer?.avatar || '';
                        }

                        setCompanyName(resolvedName);

                        if (rawAvatar) {
                            const formattedAvatar = rawAvatar.startsWith('http')
                                ? rawAvatar
                                : `http://192.168.1.2:8000/storage/${rawAvatar}`;
                            setEmployerAvatar(formattedAvatar);
                        } else {
                            setEmployerAvatar('');
                        }
                    }
                } catch (error) {
                    console.error('Error fetching job details for chat:', error);
                }
            }
        };

        if (visible) {
            fetchJobOwnerDetails();
        }
    }, [application, visible]);

    if (!application) return null;

    const handleSendMessage = async () => {
        try {
            const job = application.job || {};
            const jobId = application.job_id || job.id;

            let studentId = 'student_default';
            let studentName = 'Student Applicant';
            let studentAvatar = '';

            try {
                const storedProfile = await AsyncStorage.getItem('userProfile');
                const storedUser = await AsyncStorage.getItem('userData');

                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    studentId = user.id?.toString() || 'student_default';
                }

                if (storedProfile) {
                    const parsedProfile = JSON.parse(storedProfile);
                    if (parsedProfile.student_name) {
                        studentName = parsedProfile.student_name;
                    }
                    if (parsedProfile.avatar) {
                        parsedProfile.avatar.startsWith('http')
                            ? (studentAvatar = parsedProfile.avatar)
                            : (studentAvatar = `http://192.168.1.2:8000/storage/${parsedProfile.avatar}`);
                    }
                }
            } catch (e) {
                console.error('Error reading user storage:', e);
            }

            const chatId = `job_${jobId}_employer_${ownerId}_student_${studentId}`;
            const chatRef = doc(db, 'chats', chatId);

            await setDoc(chatRef, {
                studentId: studentId,
                ownerId: ownerId,
                senderName: studentName,
                employerName: companyName,
                senderAvatar: studentAvatar,
                employerAvatar: employerAvatar,
                online: true,
            }, { merge: true });

            onClose();
            router.push(`/chat?id=${chatId}` as any);
        } catch (error) {
            console.error('Error starting chat:', error);
            Alert.alert('Paalala', 'Hindi mabuksan ang chat sa ngayon.');
        }
    };

    const handleCancelApplication = () => {
        Alert.alert(
            'Kanselahin ang Aplikasyon',
            'Sigurado ka bang gusto mong kanselahin ang aplikasyon na ito?',
            [
                { text: 'Huwag Muna', style: 'cancel' },
                {
                    text: 'Oo, Kanselahin',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCancelling(true);
                            const response = await api.post(`/student/applications/${application.id}/cancel`);

                            if (response.data && response.data.status === 'success') {
                                Alert.alert('Tagumpay', 'Matagumpay na na-kansela ang iyong aplikasyon.');
                                onClose();
                                if (onApplicationCancelled) {
                                    onApplicationCancelled();
                                }
                            }
                        } catch (error: any) {
                            console.error('Error cancelling application:', error);
                            const msg = error.response?.data?.message || 'Hindi ma-cancel ang aplikasyon sa ngayon.';
                            Alert.alert('Paalala', msg);
                        } finally {
                            setCancelling(false);
                        }
                    },
                },
            ]
        );
    };

    const isPending = application.status?.toLowerCase() === 'pending';

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4 border-b border-gray-100 pb-3">
                        <Text className="text-lg font-bold text-slate-900 text-center">Application Details</Text>
                        <TouchableOpacity onPress={onClose} className="p-1 bg-gray-100 rounded-full">
                            <MaterialIcons name="close" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="bg-slate-50 p-4 rounded-xl mb-4">
                            <Text className="text-base font-bold text-slate-900">{application.job?.title || 'Job Opening'}</Text>
                            <Text className="text-xs font-medium text-slate-700">{companyName}</Text>
                            <Text className="text-xs text-slate-500 mt-1">{application.job?.category || 'General'}</Text>
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs text-slate-400 uppercase font-semibold mb-1">Current Status</Text>
                            <View className="flex-row items-center gap-2 mt-1">
                                <Badge
                                    text={application.status ? application.status.charAt(0).toUpperCase() + application.status.slice(1) : ''}
                                    variant={application.status === 'rejected' || application.status === 'cancelled' ? 'error' : application.status === 'accepted' || application.status === 'completed' ? 'success' : 'warning'}
                                    size="medium"
                                />
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs text-slate-400 uppercase font-semibold mb-1">Rate</Text>
                            <Text className="text-sm font-semibold text-slate-700">₱{application.job?.salary || '0.00'}</Text>
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs text-slate-700 uppercase font-semibold mb-1">Job Description</Text>
                            <Text className="text-sm text-slate-600 leading-5">{application.job?.description || 'No Description.'}</Text>
                        </View>

                        <View className="mb-6">
                            <Text className="text-xs text-slate-400 uppercase font-semibold mb-1">Applied Date</Text>
                            <Text className="text-sm text-slate-600">{formatDate(application.created_at)}</Text>
                        </View>
                        
                        {/* Requirements Section */}
                        {application.job?.requirements && (
                            <View className="mb-4">
                                <Text className="text-xs text-slate-400 uppercase font-semibold mb-1">Requirements</Text>
                                <View className="flex-row flex-wrap gap-1.5 mt-1">
                                    {(() => {
                                        try {
                                            const reqs = typeof application.job.requirements === 'string'
                                                ? JSON.parse(application.job.requirements)
                                                : application.job.requirements;
                                            return Array.isArray(reqs) ? reqs.map((req: string, index: number) => (
                                                <View key={index} className="bg-slate-100 px-3 py-1 rounded-full">
                                                    <Text className="text-xs text-slate-700">{req}</Text>
                                                </View>
                                            )) : <Text className="text-sm text-slate-600">{String(reqs)}</Text>;
                                        } catch {
                                            return <Text className="text-sm text-slate-600">{application.job.requirements}</Text>;
                                        }
                                    })()}
                                </View>
                            </View>
                        )}

                        {application.job?.skills && (
                            <View className="mb-4">
                                <Text className="text-xs text-slate-400 uppercase font-semibold mb-1">Skills Needed</Text>
                                <View className="flex-row flex-wrap gap-1.5 mt-1">
                                    {(() => {
                                        try {
                                            const skills = typeof application.job.skills === 'string'
                                                ? JSON.parse(application.job.skills)
                                                : application.job.skills;
                                            return Array.isArray(skills) ? skills.map((skill: string, index: number) => (
                                                <View key={index} className="bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                                    <Text className="text-xs text-red-600 font-medium">{skill}</Text>
                                                </View>
                                            )) : <Text className="text-sm text-slate-600">{String(skills)}</Text>;
                                        } catch {
                                            return <Text className="text-sm text-slate-600">{application.job.skills}</Text>;
                                        }
                                    })()}
                                </View>
                            </View>
                        )}

                        {/* Message Employer Button */}
                        <TouchableOpacity
                            onPress={handleSendMessage}
                            className="bg-red-600 py-3.5 rounded-xl items-center justify-center flex-row gap-2 mb-3"
                        >
                            <MaterialIcons name="chat" size={18} color="white" />
                            <Text className="text-white font-semibold text-sm">Message Employer</Text>
                        </TouchableOpacity>

                        {isPending && (
                            <TouchableOpacity
                                onPress={handleCancelApplication}
                                disabled={cancelling}
                                className="bg-gray-100 py-3.5 rounded-xl items-center justify-center flex-row gap-2 mb-6 border border-gray-200"
                            >
                                <MaterialIcons name="cancel" size={18} color="#ef4444" />
                                <Text className="text-red-500 font-semibold text-sm">
                                    {cancelling ? 'Loading...' : 'Cancel Application'}
                                </Text>
                            </TouchableOpacity> 
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}