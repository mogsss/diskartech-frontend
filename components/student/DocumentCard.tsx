import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

interface DocumentCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  filename: string | null | undefined;
  onUpload: () => void;
  onView?: () => void;
  isVerified?: boolean;
  isRejected?: boolean;
}

export default function DocumentCard({
  icon,
  title,
  filename,
  onUpload,
  onView,
  isVerified = false,
  isRejected = false,
}: DocumentCardProps) {
  const { colors, isDark } = useDarkMode();
  const isUploaded = !!filename;

  // Kulay batay sa status: Pula kapag rejected, Emerald kapag uploaded/verified, Gray kapag wala pa
  const cardBorderClass = !isUploaded
    ? 'border-gray-200'
    : isRejected
    ? 'border-red-400'
    : 'border-emerald-500';

  const iconBgClass = !isUploaded
    ? 'bg-gray-100'
    : isRejected
    ? 'bg-red-50'
    : 'bg-emerald-50';

  const iconColor = !isUploaded
    ? '#94A3B8'
    : isRejected
    ? '#DC2626'
    : '#059669';

  const textClass = !isUploaded
    ? 'text-gray-400'
    : isRejected
    ? 'text-red-600 font-semibold'
    : 'text-emerald-700 font-bold';

  const textLabel = !isUploaded
    ? 'Not uploaded yet'
    : isRejected
    ? `✕ ${filename}`
    : `✓ ${filename}`;

  const eyeBgClass = isRejected ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200';
  const eyeColor = isRejected ? '#DC2626' : '#059669';

  const actionButtonClass = isRejected
    ? 'bg-red-600 border border-red-600'
    : isUploaded
    ? 'bg-slate-100 border border-slate-200'
    : 'bg-red-600';

  const actionButtonTextClass = isRejected || !isUploaded ? 'text-white' : 'text-slate-700';

  return (
    <View style={{ backgroundColor: colors.surface }} className={`flex-row items-center justify-between p-4 rounded-xl border mb-3 ${cardBorderClass}`}>
      {/* Nilagyan natin ng flex-1 at mr-3 para hindi lumagpas ang mahabang filename */}
      <TouchableOpacity
        onPress={isUploaded && onView ? onView : (!isVerified ? onUpload : undefined)}
        activeOpacity={isUploaded && onView ? 0.7 : 1}
        className="flex-row items-center gap-3 flex-1 mr-3"
      >
        <View className={`w-10 h-10 rounded-full items-center justify-center flex-shrink-0 ${iconBgClass}`}>
          <MaterialIcons name={icon} size={20} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text style={{ color: colors.text }} className="font-semibold">{title}</Text>
          <Text className={`text-xs ${textClass}`} numberOfLines={1}>
            {textLabel}
          </Text>
        </View>
      </TouchableOpacity>

      <View className="flex-row items-center gap-2 flex-shrink-0">
        {isUploaded && onView && (
          <TouchableOpacity
            onPress={onView}
            activeOpacity={0.8}
            className={`w-9 h-9 rounded-lg border items-center justify-center ${eyeBgClass}`}
          >
            <MaterialIcons name="visibility" size={19} color={eyeColor} />
          </TouchableOpacity>
        )}

        {/* Kapag verified na ang user at may file na, alisin ang CHANGE button */}
        {(!isVerified || !isUploaded) && (
          <TouchableOpacity
            onPress={onUpload}
            activeOpacity={0.8}
            style={isUploaded && !isRejected ? { backgroundColor: isDark ? '#334155' : '#F1F5F9', borderColor: colors.border } : {}}
            className={`h-9 px-3.5 rounded-lg items-center justify-center flex-shrink-0 ${actionButtonClass}`}
          >
            <Text style={isUploaded && !isRejected ? { color: colors.text } : {}} className={`text-xs font-bold ${actionButtonTextClass}`}>
              {isUploaded ? 'CHANGE' : 'UPLOAD'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}