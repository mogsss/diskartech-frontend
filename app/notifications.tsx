import NotificationCard from '@/components/ui/NotificationCard';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import api from '@/api/axios';
import { db } from '@/utils/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApplicationDetailsModal from '@/components/modals/student/ApplicationDetailsModal';

export default function NotificationsScreen() {
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // States para sa direct modal display para sa student
  const [selectedModalApp, setSelectedModalApp] = useState<any | null>(null);
  const [isAppModalVisible, setIsAppModalVisible] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentUserId(user.id?.toString());
          const role = user.role || (user.student_school_name ? 'student' : 'employer');
          setUserRole(role);
        }
      } catch (e) {
        console.error('Error fetching user data:', e);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!currentUserId || !userRole) return;

    let appNotifications: any[] = [];
    let verificationNotifications: any[] = [];

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const readNotifsString = await AsyncStorage.getItem('read_notifications');
        const readNotifsIds: string[] = readNotifsString ? JSON.parse(readNotifsString) : [];

        if (userRole === 'student') {
          try {
            const res = await api.get('/student/applications');
            if (res.data && res.data.applications) {
              res.data.applications.forEach((app: any) => {
                const notifId = `app_${app.id}`;
                const isLocallyRead = readNotifsIds.includes(notifId);

                const statusText = app.status === 'interview'
                  ? 'For Interview'
                  : app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Update';

                let titleText = `Application ${statusText}`;
                let messageText = (
                  <Text>
                    Your application for <Text className="font-bold text-slate-700">{app.job?.title || 'Job'}</Text> is currently {app.status}.
                  </Text>
                );

                if (app.status === 'interview') {
                  titleText = 'Invitation for Interview';
                  messageText = (
                    <Text>
                      You are invited for a walk-in interview for <Text className="font-bold text-slate-700">{app.job?.title || 'Job'}</Text>.
                    </Text>
                  );
                } else if (app.status === 'accepted') {
                  messageText = (
                    <Text>
                      Congratulations! Your application for <Text className="font-bold text-slate-700">{app.job?.title || 'Job'}</Text> is APPROVED.
                    </Text>
                  );
                } else if (app.status === 'rejected') {
                  messageText = (
                    <Text>
                      Sorry, your application for <Text className="font-bold text-slate-700">{app.job?.title || 'Job'}</Text> is REJECTED.
                    </Text>
                  );
                }

                appNotifications.push({
                  id: notifId,
                  title: titleText,
                  message: messageText,
                  time: app.updated_at ? new Date(app.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
                  timestamp: app.updated_at ? new Date(app.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
                  read: isLocallyRead || app.status !== 'pending',
                  type: 'application_status',
                  targetId: app.id,
                });
              });
            }
          } catch (err) {
            console.error('Error fetching student applications:', err);
          }
        } else {
          try {
            const response = await api.get('/user/profile');
            const profile = response.data.profile || response.data.user || response.data;
            if (profile) {
              const isVerified = profile.isVerified === 1 || profile.isVerified === true || profile.status === 'verified';
              const isRejected = !isVerified && !!profile.rejection_reason;
              const hasUploadedDocs = !!profile.valid_id_path || !!profile.employer_certificate_path;

              const notifId = 'verification_status';
              const isLocallyRead = readNotifsIds.includes(notifId);

              if (isVerified) {
                verificationNotifications.push({
                  id: notifId,
                  title: 'Account Verified!',
                  message: 'Account verified successfully! You can now hire workers.',
                  time: 'Recent',
                  timestamp: 'Recent',
                  read: true,
                  type: 'verification',
                });
              } else if (isRejected) {
                verificationNotifications.push({
                  id: notifId,
                  title: 'Verification Rejected',
                  message: `Reason: ${profile.rejection_reason}.`,
                  time: 'Recent',
                  timestamp: 'Recent',
                  read: isLocallyRead,
                  type: 'verification',
                });
              } else if (hasUploadedDocs) {
                verificationNotifications.push({
                  id: notifId,
                  title: 'Verification Pending',
                  message: 'Your documents is being reviewed.',
                  time: 'Recent',
                  timestamp: 'Recent',
                  read: isLocallyRead,
                  type: 'verification',
                });
              } else {
                verificationNotifications.push({
                  id: notifId,
                  title: 'Documents Required',
                  message: 'Not verified. Please upload required verification documents.',
                  time: 'Recent',
                  timestamp: 'Recent',
                  read: isLocallyRead,
                  type: 'verification',
                });
              }
            }
          } catch (err) {
            console.error('Error fetching verification status:', err);
          }

          try {
            const res = await api.get('/employer/applicants');
            if (res.data && res.data.status === 'success') {
              const applicants = res.data.applicants || [];
              applicants.forEach((app: any) => {
                const notifId = `app_${app.id}`;
                const isLocallyRead = readNotifsIds.includes(notifId);

                appNotifications.push({
                  id: notifId,
                  title: 'New Application!',
                  message: `${app.student?.student_name} applied for ${app.job?.title || 'Job'}.`,
                  time: app.created_at ? new Date(app.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
                  timestamp: app.created_at ? new Date(app.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
                  read: isLocallyRead || app.status !== 'pending',
                  type: 'application',
                  targetId: app.id,
                });
              });
            }
          } catch (apiError) {
            console.error('Error fetching applicants:', apiError);
          }
        }
        let chatQuery;
        if (userRole === 'student') {
          chatQuery = query(
            collection(db, 'chats'),
            where('studentId', 'in', [currentUserId, Number(currentUserId), String(currentUserId)])
          );
        } else {
          chatQuery = query(
            collection(db, 'chats'),
            where('ownerId', 'in', [currentUserId, Number(currentUserId), String(currentUserId)])
          );
        }

        const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
          let chatList: any[] = [];

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const isUnread = userRole === 'student' ? data.unreadByStudent : data.unreadByEmployer;
            const displayName = userRole === 'student' ? (data.employerName || 'Employer') : (data.senderName || 'Student');
            const formattedTime = data.timestamp || 'Kamakailan';

            chatList.push({
              id: `chat_${docSnap.id}`,
              title: 'Message',
              message: `${displayName}: "${data.lastMessage || 'Sent a message'}"`,
              time: formattedTime,
              timestamp: formattedTime,
              date: formattedTime,
              read: !isUnread,
              type: 'message',
              targetId: docSnap.id,
            });
          });

          setNotificationsList([...appNotifications, ...chatList, ...verificationNotifications]);
          setLoading(false);
        }, (error) => {
          console.error('Error loading chat notifications:', error);
          setLoading(false);
        });

        return () => unsubscribe();

      } catch (error) {
        console.error('Error loading notifications:', error);
        setLoading(false);
      }
    };

    loadNotifications();
  }, [currentUserId, userRole]);

  const handleNotificationPress = async (notification: any) => {
    try {
      const readNotifsString = await AsyncStorage.getItem('read_notifications');
      const readNotifsIds: string[] = readNotifsString ? JSON.parse(readNotifsString) : [];

      if (!readNotifsIds.includes(notification.id)) {
        readNotifsIds.push(notification.id);
        await AsyncStorage.setItem('read_notifications', JSON.stringify(readNotifsIds));
      }
    } catch (e) {
      console.error('Error saving read notification status:', e);
    }

    setNotificationsList((prevList) =>
      prevList.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item
      )
    );

    if (notification.type === 'message') {
      try {
        const chatRef = doc(db, 'chats', notification.targetId);
        if (userRole === 'student') {
          await updateDoc(chatRef, { unreadByStudent: false });
        } else {
          await updateDoc(chatRef, { unreadByEmployer: false });
        }
      } catch (e) {
        console.error('Error updating message read status:', e);
      }

      router.push(`/chat?id=${notification.targetId}` as any);
    } else if (notification.type === 'application' || notification.type === 'application_status') {
      if (userRole === 'student') {
        try {
          const res = await api.get('/student/applications');
          if (res.data && res.data.applications) {
            const foundApp = res.data.applications.find(
              (a: any) => a.id.toString() === notification.targetId.toString()
            );
            if (foundApp) {
              setSelectedModalApp(foundApp);
              setIsAppModalVisible(true);
            }
          }
        } catch (error) {
          console.error('Error fetching application for modal:', error);
        }
      } else {
        router.push(`/employer/applicant-details?applicationId=${notification.targetId}` as any);
      }
    } else if (notification.type === 'verification') {
      router.push('/employer/verification-status' as any);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const allIds = notificationsList.map((n) => n.id);
      await AsyncStorage.setItem('read_notifications', JSON.stringify(allIds));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }

    const updated = notificationsList.map((n) => ({ ...n, read: true }));
    setNotificationsList(updated);
  };

  const unreadCount = notificationsList.filter((n) => !n.read).length;

  if (loading) {
    return (
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-900">Notifications</Text>
          {unreadCount > 0 && (
            <Text className="text-xs text-red-600 font-semibold mt-[2px]">{unreadCount} unread</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleMarkAllRead} className="py-2 px-4">
          <Text className="text-sm text-red-600 font-semibold">Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {notificationsList.length === 0 ? (
          <View className="flex-1 justify-center items-center mt-32">
            <MaterialIcons name="notifications-none" size={56} color={Colors.gray400} />
            <Text className="text-slate-500 mt-4 text-base font-medium">No Notifications</Text>
          </View>
        ) : (
          notificationsList.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onPress={() => handleNotificationPress(notification)}
            />
          ))
        )}
      </ScrollView>

      {/* Modal para sa Student Application Details para maiwasan ang Unmatched Route */}
      <ApplicationDetailsModal
        visible={isAppModalVisible}
        onClose={() => setIsAppModalVisible(false)}
        application={selectedModalApp}
        onApplicationCancelled={() => {
          // Pwede mong i-refresh kung kailangan
        }}
      />
    </View>
  );
}