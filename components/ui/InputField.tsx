import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export default function InputField({
  label,
  error,
  icon,
  isPassword = false,
  containerStyle,
  ...props
}: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text className="text-sm font-semibold text-slate-900 mb-2">
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleContainerPress}
        className={`flex-row items-center bg-white border-[1.5px] rounded-xl px-4 h-[52px] ${
          isFocused ? 'border-red-600' : error ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        {icon && (
          <MaterialIcons
            name={icon}
            size={20}
            color={isFocused ? '#dc2626' : '#6b7280'}
            style={{ marginRight: 8 }}
          />
        )}
        
        <TextInput
          ref={inputRef}
          className="flex-1 text-base text-slate-900 h-full p-0"
          placeholderTextColor="#9ca3af"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          autoCorrect={false}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color="#6b7280"
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {error && (
        <Text className="text-xs text-red-500 mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}