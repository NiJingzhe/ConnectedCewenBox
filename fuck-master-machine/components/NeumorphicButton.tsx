import useColorScheme from '@/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import Colors from '../constants/Colors';

interface NeumorphicButtonProps {
  onPress: () => void;
  title?: string;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  disabled?: boolean;
  children?: React.ReactNode;
  isLoading?: boolean; // To show loading indicator
  variant?: 'primary' | 'error'; // Material 3: Different button variants
}

const NeumorphicButton: React.FC<NeumorphicButtonProps> = ({
  onPress,
  title,
  style,
  textStyle,
  disabled,
  children,
  isLoading,
  variant = 'primary', // Default to primary variant
}) => {
  const colorScheme = useColorScheme();

  const componentStyles = StyleSheet.create({
    button: {
      borderRadius: 1000, // Material 3: fully rounded for typical height
      backgroundColor: variant === 'error'
        ? Colors[colorScheme].error // Material 3: error color background for error variant
        : Colors[colorScheme].tint, // Material 3: primary color background
      paddingVertical: 5, // Material 3: common vertical padding
      paddingHorizontal: 24, // Material 3: common horizontal padding
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 90,
      // Removed neumorphic shadow properties: shadowColor, shadowOffset, shadowOpacity, shadowRadius
      elevation: 0, // Material 3 Flat style: no elevation
      textAlign: 'center', // Center text alignment
    },
    buttonText: {
      // Material 3: onPrimary color for primary, black text for error
      color: colorScheme === 'light' ? Colors.dark.text : Colors.light.text, // White text on blue/light tint, Black text on white/dark tint
      fontSize: 14, // Material 3: Label Large
      fontWeight: '500', // Material 3: Medium weight
    },
    disabledButton: {
      opacity: 0.5, // Simple disabled style
      // For more accurate M3 disabled style, you might change backgroundColor and text color explicitly
      // e.g., backgroundColor: colorScheme === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
      // and text color: colorScheme === 'light' ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.38)'
      // elevation: 0, // Ensure elevation is 0 for disabled state
    }
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        componentStyles.button,
        style,
        disabled || isLoading ? componentStyles.disabledButton : {}
      ]}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'error'
            ? '#000000' // Black color on red error background
            : colorScheme === 'light' ? Colors.dark.text : Colors.light.text} // Use contrast color for indicator
          size="small"
        />
      ) : children ? (
        children
      ) : (
        <Text style={[componentStyles.buttonText, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export default NeumorphicButton;
