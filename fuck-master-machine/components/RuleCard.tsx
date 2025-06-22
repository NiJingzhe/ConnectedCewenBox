import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import NeumorphicButton from './NeumorphicButton';
import Colors from '@/constants/Colors';
import useColorScheme from '@/hooks/useColorScheme';

interface RuleCardProps {
  min: string;
  max: string;
  onChangeMin: (v: string) => void;
  onChangeMax: (v: string) => void;
  onDelete: () => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ min, max, onChangeMin, onChangeMax, onDelete }) => {
  const colorScheme = useColorScheme();

  const styles = StyleSheet.create({
    ruleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colorScheme === 'light' ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      elevation: 1,
      shadowColor: Colors[colorScheme].text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colorScheme === 'light' ? 0.08 : 0.18,
      shadowRadius: 2,
    },
    input: {
      width: 60,
      borderRadius: 8,
      backgroundColor: colorScheme === 'light' ? '#fff' : '#222',
      color: Colors[colorScheme].text,
      fontSize: 16,
      paddingHorizontal: 8,
      marginHorizontal: 4,
    },
    ruleLabel: {
      fontSize: 15,
      color: Colors[colorScheme].text,
      opacity: 0.7,
      marginHorizontal: 2,
    },
    deleteBtn: {
      marginLeft: 8,
      paddingHorizontal: 0,
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.ruleCard}>
      <Text style={styles.ruleLabel}>下限</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={min}
        onChangeText={onChangeMin}
        placeholder="最小"
        placeholderTextColor="#aaa"
      />
      <Text style={styles.ruleLabel}>上限</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={max}
        onChangeText={onChangeMax}
        placeholder="最大"
        placeholderTextColor="#aaa"
      />
      <NeumorphicButton
        style={styles.deleteBtn}
        variant="error"
        title="DEL"
        onPress={onDelete}
      />
    </View>
  );
};

export default RuleCard;
