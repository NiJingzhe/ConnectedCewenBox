import React from 'react';
import { View, Text, StyleSheet, Animated, ScrollView } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import Colors from '@/constants/Colors';
import useColorScheme from '@/hooks/useColorScheme';

interface TemperatureHistoryItem {
  value: number;
  timestamp: number;
}

interface TemperatureCardProps {
  temperature: number;
  temperatureHistory: TemperatureHistoryItem[];
}

const showPoints = 20; // Number of points to show in the chart


const TemperatureCard: React.FC<TemperatureCardProps> = ({ temperature, temperatureHistory }) => {
  const [expanded, setExpanded] = React.useState(false);
  const colorScheme = useColorScheme();
  const animated = React.useRef(new Animated.Value(0)).current;
  
  // 调试日志：监控温度历史数据的变化
  React.useEffect(() => {
    console.log('=== TemperatureCard 数据更新 ===');
    console.log(`当前温度: ${temperature}°C`);
    console.log(`历史记录数量: ${temperatureHistory.length}`);
    if (temperatureHistory.length > 0) {
      const latest = temperatureHistory[temperatureHistory.length - 1];
      const latestTime = new Date(latest.timestamp);
      console.log(`最新历史记录: ${latest.value}°C @ ${latestTime.toLocaleString()}`);
    }
    console.log('==============================');
  }, [temperature, temperatureHistory]);
  
  React.useEffect(() => {
    Animated.timing(animated, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  const historyHeight = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200], // 160px for history list when expanded
  });

  const styles = StyleSheet.create({
    tempCard: {
      flexDirection: 'row',
      backgroundColor: colorScheme === 'light' ? '#f8f8f8' : '#2c2c2c',
      borderRadius: 16,
      padding: 0,
      marginHorizontal: 0,
      marginBottom: 0,
      elevation: 2,
      minHeight: 110,
      alignItems: 'stretch',
    },
    tempValueSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingLeft: 24,
    },
    tempValue: {
      fontSize: 40,
      fontWeight: 'bold',
      color: Colors[colorScheme].text,
    },
    tempUnit: {
      fontSize: 18,
      color: Colors[colorScheme].text,
      opacity: 0.7,
      marginLeft: 4,
    },
    ruleLabel: {
      fontSize: 15,
      color: Colors[colorScheme].text,
      opacity: 0.7,
      marginTop: 4,
    },
    lastUpdateText: {
      fontSize: 12,
      color: Colors[colorScheme].text,
      opacity: 0.5,
      marginTop: 2,
    },
    tempChartSection: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingRight: 16,
    },
    historyList: {
      marginTop: 16,
      paddingHorizontal: 24,
    },
    historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: colorScheme === 'light' ? '#e0e0e0' : '#444',
    },
    historyTime: {
      fontSize: 13,
      color: Colors[colorScheme].text,
      opacity: 0.7,
    },
    historyTemp: {
      fontSize: 15,
      color: Colors[colorScheme].text,
      fontWeight: 'bold',
    },
  });

  const chartWidth = 120;
  const chartHeight = 60;
  const min = Math.min(...temperatureHistory.map(item => item.value));
  const max = Math.max(...temperatureHistory.map(item => item.value));
  const range = max - min || 1;

  const lineColor = colorScheme === 'light' ? '#1976D2' : '#90CAF9';
  const padding = 8;

  // Generate points for the line
  const points = temperatureHistory.slice(-showPoints).map((item, index) => {
    const x = padding + (index / (temperatureHistory.slice(-showPoints).length - 1)) * (chartWidth - 2 * padding);
    const y = padding + (1 - (item.value - min) / range) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // Get the nearest 20 history items (latest first)
  const nearestHistory = [...temperatureHistory]
    .slice(-20)
    .reverse();

  function formatTime(ts: number) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }

  return (
    <View>
      <View style={styles.tempCard}>
        <View style={{ flex: 1 }}>        <View style={styles.tempValueSection}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={styles.tempValue}>{temperature.toFixed(1)}</Text>
            <Text style={styles.tempUnit}>°C</Text>
          </View>
          <Text style={styles.ruleLabel}>当前温度</Text>
          {temperatureHistory.length > 0 && (
            <Text style={styles.lastUpdateText}>
              最后更新: {formatTime(temperatureHistory[temperatureHistory.length - 1].timestamp)}
            </Text>
          )}
        </View>
        </View>
        <View style={styles.tempChartSection}>
          <Svg width={chartWidth} height={chartHeight}>
            {/* Draw the connecting line */}
            <Polyline
              points={points}
              fill="none"
              stroke={lineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Draw the dots */}
            {temperatureHistory.slice(-showPoints).map((item, index) => {
              const x = padding + (index / (temperatureHistory.slice(-showPoints).length - 1)) * (chartWidth - 2 * padding);
              const y = padding + (1 - (item.value - min) / range) * (chartHeight - 2 * padding);
              return (
              <Circle
                key={item.timestamp}
                cx={x}
                cy={y}
                r="2"
                fill={lineColor}
              />
              );
            })}
          </Svg>
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Text
            style={{ width: '100%', height: '100%' }}
            onPress={() => setExpanded(e => !e)}
            accessibilityRole="button"
            accessibilityLabel="Expand temperature card"
          />
        </View>
      </View>
      <Animated.View style={[styles.historyList, { height: historyHeight, overflow: 'hidden', opacity: animated }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {nearestHistory.map(item => (
            <View style={styles.historyItem} key={item.timestamp}>
              <Text style={styles.historyTime}>{formatTime(item.timestamp)}</Text>
              <Text style={styles.historyTemp}>{item.value.toFixed(1)}°C</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default TemperatureCard;
