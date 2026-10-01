import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface DocumentCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  filename: string | null | undefined;
  onUpload: () => void;
}

export default function DocumentCard({ icon, title, filename, onUpload }: DocumentCardProps) {
  const isUploaded = !!filename;

  return (
    <View className={`flex-row items-center justify-between p-4 rounded-xl border mb-3 ${isUploaded ? ' border-green-500' : ' border-red-200'}`}>
      {/* Nilagyan natin ng flex-1 at mr-4 para hindi lumagpas ang mahabang filename */}
      <View className="flex-row items-center gap-3 flex-1 mr-4">
        <View className={`w-10 h-10 rounded-full items-center justify-center flex-shrink-0 ${isUploaded ? '' : 'bg-red-100'}`}>
          <MaterialIcons name={icon} size={20} color={isUploaded ? '#16a34a' : '#DC2626'} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-slate-900">{title}</Text>
          <Text 
            className={`text-xs ${isUploaded ? 'text-black font-bold' : 'text-red-500'}`} 
            numberOfLines={1} 
          >
            {isUploaded ? `✓ ${filename}` : 'Not uploaded yet'}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onUpload} className={`px-4 py-2 rounded-lg flex-shrink-0 ${isUploaded ? 'bg-green-700' : 'bg-red-600'}`}>
        <Text className="text-xs font-bold text-white">
          {isUploaded ? 'CHANGE' : 'UPLOAD'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}