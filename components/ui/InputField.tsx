import { useDarkMode } from '@/hooks/useDarkMode';
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
  iconColor?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  inputRef?: (input: TextInput | null) => void;
}

export default function InputField({
  label,
  error,
  icon,
  iconColor,
  isPassword = false,
  containerStyle,
  inputRef: onInputRef,
  onFocus,
  onBlur,
  ...props
}: InputFieldProps) {
  const { colors, isDark } = useDarkMode();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleContainerPress}
        className="flex-row items-center border-[1.5px] rounded-xl px-4 h-[52px]"
        style={{
          backgroundColor: props.editable === false ? (isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9') : colors.surface,
          borderColor: isFocused ? '#DC2626' : error ? '#EF4444' : colors.border,
          opacity: props.editable === false ? 0.8 : 1,
        }}
      >
        {icon && (
          <MaterialIcons
            name={icon}
            size={20}
            color={iconColor ?? (isFocused ? colors.accent : colors.textSecondary)}
            style={{ marginRight: 8 }}
          />
        )}
        
        <TextInput
          ref={(input) => { inputRef.current = input; onInputRef?.(input); }}
          className="flex-1 text-base h-full p-0"
          style={[{ color: colors.text }, props.style]}
          placeholderTextColor={colors.textSecondary}
          onFocus={(event) => { setIsFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setIsFocused(false); onBlur?.(event); }}
          secureTextEntry={isPassword && !showPassword}
          autoCorrect={false}
          {...props}
        />

        {props.editable === false && (
          <MaterialIcons
            name="lock"
            size={16}
            color={iconColor ?? colors.textSecondary}
            style={{ marginLeft: 6 }}
          />
        )}

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color={iconColor ?? colors.textSecondary}
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
