import React from 'react';
import { ActivityIndicator, ColorSchemeName, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../constants/Colors';
import bluetoothManager, { AppDisplayDevice } from '../services/BluetoothManager';

interface DeviceCardProps {
  device: AppDisplayDevice;
  onConnect: (device: AppDisplayDevice) => void;
  onDisconnect: (device: AppDisplayDevice) => void;
  isConnecting: boolean;
  disabled?: boolean; // 新增：控制整个卡片是否禁用
  colorScheme: ColorSchemeName;
}

const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onConnect,
  onDisconnect,
  isConnecting,
  disabled = false, // 默认不禁用
  colorScheme: propColorScheme, // Rename to avoid conflict in local scope
}) => {
  // Default to 'light' if colorScheme is null or undefined
  const currentColorScheme = propColorScheme || 'light';

  // 处理卡片点击事件
  const handleCardPress = () => {
    if (disabled) return;
    
    // 如果正在连接，点击取消连接
    if (isConnecting) {
      console.log(`DeviceCard: Cancelling connection for ${device.address}`);
      bluetoothManager.cancelConnection(device.address);
      return;
    }
    
    if (device.connectedStatus) {
      onDisconnect(device);
    } else {
      onConnect(device);
    }
  };

  const styles = StyleSheet.create({
    deviceItem: {
      borderRadius: 16, // Material 3: common card border radius
      backgroundColor: currentColorScheme === 'light' ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault, // Material 3: surface color
      marginVertical: 8,
      marginHorizontal: 12,
      padding: 16, // Material 3: common padding for cards
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      elevation: 1, // Material 3: Surface +1dp elevation for cards
      // Material 3 shadows - optimized for both light and dark modes
      shadowColor: currentColorScheme === 'light' ? Colors.light.text : Colors.dark.text, // Black shadow for both modes
      shadowOffset: { width: 0, height: 1 }, // Softer shadow for M3
      shadowOpacity: currentColorScheme === 'light' ? 0.3 : 0.45, // Higher opacity for dark mode for better visibility
      shadowRadius: 3, // Slightly larger radius for better shadow visibility
      opacity: disabled ? 0.5 : 1, // 禁用时减少透明度
    },
    deviceInfo: {
      flex: 1,
      marginRight: 12,
    },
    deviceName: {
      fontSize: 17,
      fontWeight: '600',
      color: Colors[currentColorScheme].text,
    },
    deviceAddress: {
      fontSize: 13,
      color: Colors[currentColorScheme].text,
      opacity: 0.6,
      marginTop: 2,
    },
    deviceStatus: {
      fontSize: 13,
      color: currentColorScheme === 'light' ? '#388E3C' : '#81C784', // Greenish for connected
      fontWeight: '500',
      marginTop: 4,
    },
    connectingStatus: {
      fontSize: 13,
      color: currentColorScheme === 'light' ? '#FF9800' : '#FFB74D', // Orange for connecting
      fontWeight: '500',
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    connectingText: {
      marginLeft: 6,
    },
    statusIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    // 不同状态的色块颜色
    statusConnected: {
      backgroundColor: currentColorScheme === 'light' ? '#4CAF50' : '#81C784', // 绿色 - 已连接
    },
    statusDisconnected: {
      backgroundColor: currentColorScheme === 'light' ? '#F44336' : '#EE5151', // 红色 - 未连接
    },
    statusConnecting: {
      backgroundColor: currentColorScheme === 'light' ? '#FF9800' : '#FFB74D', // 橙色 - 连接中
    },
  });

  // 获取状态指示器的样式
  const getStatusIndicatorStyle = () => {
    if (isConnecting) {
      return [styles.statusIndicator, styles.statusConnecting];
    } else if (device.connectedStatus) {
      return [styles.statusIndicator, styles.statusConnected];
    } else {
      return [styles.statusIndicator, styles.statusDisconnected];
    }
  };

  return (
    <TouchableOpacity 
      style={styles.deviceItem} 
      onPress={handleCardPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name || (device.paired ? "Paired Device" : "Unknown Device")}</Text>
        <Text style={styles.deviceAddress}>{device.address}</Text>
        {device.connectedStatus && !isConnecting && <Text style={styles.deviceStatus}>已连接</Text>}
        {isConnecting && (
          <View style={styles.connectingStatus}>
            <ActivityIndicator 
              size="small" 
              color={currentColorScheme === 'light' ? '#FF9800' : '#FFB74D'} 
            />
            <Text style={[styles.deviceStatus, styles.connectingText, { color: currentColorScheme === 'light' ? '#FF9800' : '#FFB74D' }]}>
              {device.connectedStatus ? '断开中... (点击取消)' : '连接中... (点击取消)'}
            </Text>
          </View>
        )}
      </View>
      
      {/* 状态指示器色块 */}
      <View style={getStatusIndicatorStyle()}>
        {isConnecting ? (
          <ActivityIndicator 
            size="small" 
            color="white"
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export default DeviceCard;
