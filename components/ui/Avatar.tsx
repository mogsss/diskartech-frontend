import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Text, View, ViewStyle } from 'react-native';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  verified?: boolean;
  online?: boolean;
  style?: ViewStyle;
}

export default function Avatar({ uri, name, size = 48, verified = false, online = false, style }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const getInitials = (): string => {
    if (!name || typeof name !== 'string') return '?';
    const cleanName = name.trim();
    if (!cleanName) return '?';
    
    const words = cleanName.split(' ');
    if (words.length >= 2 && words[0] && words[1]) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  };

  const borderRadius = size / 2;
  const initialsText = getInitials();

  return (
    <View style={style} className="relative">
      {uri && !imageError ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius }}
          className="bg-gray-100"
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius,
            backgroundColor: Colors.primary + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ fontSize: size * 0.38, color: Colors.primary, fontWeight: 'bold' }}
          >
            {initialsText}
          </Text>
        </View>
      )}

      {verified && (
        <View className="absolute bottom-0 right-0 bg-white rounded-full">
          <MaterialIcons name="verified" size={size * 0.3} color={Colors.verified} />
        </View>
      )}

      {online && (
        <View
          style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }}
          className="absolute bottom-0.5 right-0.5 bg-emerald-500 border-2 border-white rounded-full"
        />
      )}
    </View>
  );
}