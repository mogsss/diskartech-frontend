import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Badge from '@/components/ui/Badge';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';
import { formatDate } from '@/utils/helpers';
import api, { STORAGE_URL } from '@/api/axios';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import {
    ensureChatRoom,
    getStudentParticipantFromStorage,
    resolveOwnerFromJob,
} from '@/utils/chat';

interface ApplicationDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    application: any | null;
    onApplicationCancelled?: () => void;
    onApplicationDeleted?: () => void;
}

export default function ApplicationDetailsModal({ 
    visible, 
    onClose, 
    application, 
    onApplicationCancelled,
    onApplicationDeleted 
}: ApplicationDetailsModalProps) {
    const { colors, isDark } = useDarkMode();
    const [companyName, setCompanyName] = useState('Employer');
    const [ownerId, setOwnerId] = useState('employer_default');
    const [employerAvatar, setEmployerAvatar] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [notification, setNotification] = useState<{
        visible: boolean;
        title: string;
        message: string;
        iconName?: keyof typeof MaterialIcons.glyphMap;
        iconColor?: string;
        iconBgColor?: string;
        primaryButtonText?: string;
        onPrimaryPress: () => void;
        secondaryButtonText?: string;
        onSecondaryPress?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        onPrimaryPress: () => {},
    });

    const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));

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
                                : `${STORAGE_URL}${rawAvatar}`;
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
            const jobId = application.job_id || job.id || 'job';
            const student = await getStudentParticipantFromStorage();
            const jobData = {
                ...job,
                id: jobId,
                employer_id: ownerId,
                employer: { employer_name: companyName, avatar: employerAvatar },
            };
            const owner = resolveOwnerFromJob(jobData);
            const chatId = await ensureChatRoom({
                jobId,
                jobTitle: job.title || 'Job Application',
                owner,
                student,
            });

            onClose();
            router.push(`/chat?id=${chatId}` as any);
        } catch (error) {
            console.error('Error starting chat:', error);
            setNotification({
                visible: true,
                title: 'Notice',
                message: 'Unable to open chat at this time.',
                iconName: 'error-outline',
                iconColor: '#DC2626',
                iconBgColor: 'bg-red-50',
                primaryButtonText: 'OK',
                onPrimaryPress: closeNotification,
            });
        }
    };

    const handleCancelApplication = () => {
        setNotification({
            visible: true,
            title: 'Cancel Application',
            message: 'Are you sure you want to cancel this application? This action cannot be undone.',
            iconName: 'remove-circle-outline',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'Yes, Cancel',
            secondaryButtonText: 'Keep Application',
            onSecondaryPress: closeNotification,
            onPrimaryPress: async () => {
                closeNotification();
                try {
                    setCancelling(true);
                    const response = await api.post(`/student/applications/${application.id}/cancel`);

                    if (response.data && response.data.status === 'success') {
                        setNotification({
                            visible: true,
                            title: 'Application Cancelled',
                            message: 'Your application has been successfully cancelled.',
                            iconName: 'check-circle',
                            iconColor: '#16A34A',
                            iconBgColor: 'bg-emerald-50',
                            primaryButtonText: 'Done',
                            onPrimaryPress: () => {
                                closeNotification();
                                onClose();
                                if (onApplicationCancelled) {
                                    onApplicationCancelled();
                                }
                            },
                        });
                    }
                } catch (error: any) {
                    console.error('Error cancelling application:', error);
                    const msg = error.response?.data?.message || 'Unable to cancel application at this time.';
                    setNotification({
                        visible: true,
                        title: 'Notice',
                        message: msg,
                        iconName: 'error-outline',
                        iconColor: '#DC2626',
                        iconBgColor: 'bg-red-50',
                        primaryButtonText: 'OK',
                        onPrimaryPress: closeNotification,
                    });
                } finally {
                    setCancelling(false);
                }
            },
        });
    };

    const handleDeleteApplication = () => {
        setNotification({
            visible: true,
            title: 'Delete Application',
            message: 'Are you sure you want to delete this application record? This action cannot be undone.',
            iconName: 'delete-outline',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'Yes, Delete',
            secondaryButtonText: 'Cancel',
            onSecondaryPress: closeNotification,
            onPrimaryPress: async () => {
                closeNotification();
                try {
                    setDeleting(true);
                    const response = await api.delete(`/student/applications/${application.id}`);

                    if (response.data && response.data.status === 'success') {
                        setNotification({
                            visible: true,
                            title: 'Application Deleted',
                            message: 'The application record has been removed.',
                            iconName: 'check-circle',
                            iconColor: '#16A34A',
                            iconBgColor: 'bg-emerald-50',
                            primaryButtonText: 'Done',
                            onPrimaryPress: () => {
                                closeNotification();
                                onClose();
                                if (onApplicationDeleted) {
                                    onApplicationDeleted();
                                }
                            },
                        });
                    }
                } catch (error: any) {
                    console.error('Error deleting application:', error);
                    const msg = error.response?.data?.message || 'Unable to delete application at this time.';
                    setNotification({
                        visible: true,
                        title: 'Notice',
                        message: msg,
                        iconName: 'error-outline',
                        iconColor: '#DC2626',
                        iconBgColor: 'bg-red-50',
                        primaryButtonText: 'OK',
                        onPrimaryPress: closeNotification,
                    });
                } finally {
                    setDeleting(false);
                }
            },
        });
    };

    const canCancel = ['pending', 'viewed'].includes(application.status?.toLowerCase());
    const canDelete = ['cancelled', 'rejected', 'completed'].includes(application.status?.toLowerCase());

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
                <View 
                    className="rounded-t-3xl p-6 max-h-[80%]"
                    style={{ backgroundColor: colors.surface }}
                >
                    {/* Header */}
                    <View 
                        className="flex-row justify-between items-center mb-4 border-b pb-3"
                        style={{ borderBottomColor: colors.border }}
                    >
                        <Text className="text-lg font-bold text-center" style={{ color: colors.text }}>
                            Application Details
                        </Text>
                        <TouchableOpacity 
                            onPress={onClose} 
                            className="p-1 rounded-full"
                            style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
                        >
                            <MaterialIcons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View 
                            className="p-4 rounded-xl mb-4 border"
                            style={{ 
                                backgroundColor: isDark ? colors.background : '#F8FAFC',
                                borderColor: colors.border
                            }}
                        >
                            <Text className="text-base font-bold" style={{ color: colors.text }}>
                                {application.job?.title || 'Job Opening'}
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                                {companyName}
                            </Text>
                            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                                {application.job?.category || 'General'}
                            </Text>
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs uppercase font-semibold mb-1" style={{ color: colors.textSecondary }}>
                                Current Status
                            </Text>
                            <View className="flex-row items-center gap-2 mt-1">
                                <Badge
                                    text={application.status ? application.status.charAt(0).toUpperCase() + application.status.slice(1) : ''}
                                    variant={application.status === 'rejected' || application.status === 'cancelled' ? 'error' : application.status === 'accepted' || application.status === 'completed' ? 'success' : 'warning'}
                                    size="medium"
                                />
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs uppercase font-semibold mb-1" style={{ color: colors.textSecondary }}>
                                Rate
                            </Text>
                            <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                                ₱{application.job?.salary || '0.00'} {getSalaryUnit(application.job?.salary_type)}
                            </Text>
                        </View>

                        <View className="mb-4">
                            <Text className="text-xs uppercase font-semibold mb-1" style={{ color: colors.textSecondary }}>
                                Job Description
                            </Text>
                            <Text className="text-sm leading-5" style={{ color: colors.text }}>
                                {application.job?.description || 'No Description.'}
                            </Text>
                        </View>

                        <View className="mb-6">
                            <Text className="text-xs uppercase font-semibold mb-1" style={{ color: colors.textSecondary }}>
                                Applied Date
                            </Text>
                            <Text className="text-sm" style={{ color: colors.text }}>
                                {formatDate(application.created_at)}
                            </Text>
                        </View>
                        
                        {/* Requirements Section */}
                        {application.job?.requirements && (
                            <View className="mb-4">
                                <View className="flex-row items-center gap-1.5 mb-1.5">
                                    <MaterialIcons name="checklist" size={14} color="#dc2626" />
                                    <Text className="text-xs uppercase font-semibold" style={{ color: colors.textSecondary }}>
                                        Requirements
                                    </Text>
                                </View>
                                <View className="flex-row flex-wrap gap-1.5 mt-1">
                                    {(() => {
                                        try {
                                             const reqs = typeof application.job.requirements === 'string'
                                                ? JSON.parse(application.job.requirements)
                                                : application.job.requirements;
                                            return Array.isArray(reqs) ? reqs.map((req: string, index: number) => (
                                                <View 
                                                    key={index} 
                                                    className="px-3 py-1 rounded-full border"
                                                    style={{ 
                                                        backgroundColor: isDark ? colors.background : '#F1F5F9',
                                                        borderColor: colors.border
                                                    }}
                                                >
                                                    <Text className="text-xs" style={{ color: colors.text }}>{req}</Text>
                                                </View>
                                            )) : <Text className="text-sm" style={{ color: colors.text }}>{String(reqs)}</Text>;
                                        } catch {
                                            return <Text className="text-sm" style={{ color: colors.text }}>{application.job.requirements}</Text>;
                                        }
                                    })()}
                                </View>
                            </View>
                        )}

                        {application.job?.skills && (
                            <View className="mb-4">
                                <View className="flex-row items-center gap-1.5 mb-1.5">
                                    <MaterialIcons name="psychology" size={14} color="#dc2626" />
                                    <Text className="text-xs uppercase font-semibold" style={{ color: colors.textSecondary }}>
                                        Skills Needed
                                    </Text>
                                </View>
                                <View className="flex-row flex-wrap gap-1.5 mt-1">
                                    {(() => {
                                        try {
                                            const skills = typeof application.job.skills === 'string'
                                                ? JSON.parse(application.job.skills)
                                                : application.job.skills;
                                            return Array.isArray(skills) ? skills.map((skill: string, index: number) => (
                                                <View 
                                                    key={index} 
                                                    className="px-3 py-1 rounded-full border"
                                                    style={{
                                                        backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                                                        borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2'
                                                    }}
                                                >
                                                    <Text className="text-xs text-red-600 font-medium">{skill}</Text>
                                                </View>
                                            )) : <Text className="text-sm" style={{ color: colors.text }}>{String(skills)}</Text>;
                                        } catch {
                                            return <Text className="text-sm" style={{ color: colors.text }}>{application.job.skills}</Text>;
                                        }
                                    })()}
                                </View>
                            </View>
                        )}

                        {/* Message Employer Button */}
                        <TouchableOpacity
                            onPress={handleSendMessage}
                            className="bg-red-600 py-3.5 rounded-xl items-center justify-center flex-row gap-2 mb-3 shadow-sm"
                        >
                            <MaterialIcons name="chat" size={18} color="white" />
                            <Text className="text-white font-semibold text-sm">Message Employer</Text>
                        </TouchableOpacity>

                        {canCancel && (
                            <TouchableOpacity
                                onPress={handleCancelApplication}
                                disabled={cancelling}
                                activeOpacity={0.7}
                                className="py-3.5 rounded-xl items-center justify-center flex-row gap-2 mb-6 border"
                                style={{
                                    borderColor: isDark ? 'rgba(220, 38, 38, 0.4)' : '#FECACA',
                                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.1)' : '#FEF2F2'
                                }}
                            >
                                {cancelling ? (
                                    <ActivityIndicator size="small" color="#dc2626" />
                                ) : (
                                    <>
                                        <MaterialIcons name="remove-circle-outline" size={17} color="#dc2626" />
                                        <Text className="text-red-600 font-semibold text-sm">
                                            Cancel Application
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity> 
                        )}

                        {canDelete && (
                            <TouchableOpacity
                                onPress={handleDeleteApplication}
                                disabled={deleting}
                                activeOpacity={0.7}
                                className="py-3.5 rounded-xl items-center justify-center flex-row gap-2 mb-6 border"
                                style={{
                                    borderColor: isDark ? 'rgba(220, 38, 38, 0.4)' : '#FECACA',
                                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.1)' : '#FEF2F2'
                                }}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#dc2626" />
                                ) : (
                                    <>
                                        <MaterialIcons name="delete-outline" size={17} color="#dc2626" />
                                        <Text className="text-red-600 font-semibold text-sm">
                                            Delete Application
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity> 
                        )}
                    </ScrollView>
                </View>
            </View>

            <NotificationModal
                visible={notification.visible}
                title={notification.title}
                message={notification.message}
                iconName={notification.iconName}
                iconColor={notification.iconColor}
                iconBgColor={notification.iconBgColor}
                primaryButtonText={notification.primaryButtonText}
                onPrimaryPress={notification.onPrimaryPress}
                secondaryButtonText={notification.secondaryButtonText}
                onSecondaryPress={notification.onSecondaryPress}
            />
        </Modal>
    );
}
