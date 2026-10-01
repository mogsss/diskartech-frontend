import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface DocumentPlaceholderCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  status: string;
  onUpload?: () => void;
}

export default function DocumentPlaceholderCard({ 
  icon, 
  title, 
  status, 
  onUpload 
}: DocumentPlaceholderCardProps) {
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
      <TouchableOpacity onPress={onUpload} className="bg-red-50 px-3 py-1.5 rounded-xl">
        <Text className="text-xs font-semibold text-red-600">Upload</Text>
      </TouchableOpacity>
    </View>
  );
}