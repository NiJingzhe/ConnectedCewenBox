import useColorScheme from '@/hooks/useColorScheme';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import DeviceCard from '../components/DeviceCard';
import NeumorphicButton from '../components/NeumorphicButton';
import SwipeableDeviceCard from '../components/SwipeableDeviceCard';
import Colors from '../constants/Colors';
import bluetoothManager, { AppDisplayDevice } from '../services/BluetoothManager';

export default function Index() {
  const colorScheme = useColorScheme();
  const [pairedDevices, setPairedDevices] = useState<AppDisplayDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<AppDisplayDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingPaired, setIsLoadingPaired] = useState(true);
  const [bluetoothStatus, setBluetoothStatus] = useState<'initializing' | 'initialized' | 'not_initialized' | 'disabled' | 'permission_denied'>('initializing');
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  // BluetoothManager Listeners Setup - Only run once
  useEffect(() => {
    bluetoothManager.setOnBluetoothStatusListener((status) => {
      console.log("UI: Bluetooth Status Update - ", status);
      setBluetoothStatus(status);
      if (status === 'initialized') {
        setIsLoadingPaired(false);
      } else if (status === 'permission_denied' || status === 'disabled' || status === 'not_initialized') {
        setIsLoadingPaired(false);
      }
    });

    bluetoothManager.setOnPairedDevicesListener((devices) => {
      console.log("UI: Paired Devices Update - ", devices.length);
      setPairedDevices(devices);
      setIsLoadingPaired(false);
    });

    bluetoothManager.setOnDeviceDiscoveredListener((device) => {
      setDiscoveredDevices(prev => {
        if (!prev.some(d => d.address === device.address)) {
          return [device, ...prev]; // Add new device to the top
        }
        return prev;
      });
    });

    bluetoothManager.setOnScanStatusListener((scanning) => {
      console.log("UI: Scan Status Update - ", scanning);
      setIsScanning(scanning);
      if (scanning) {
        setDiscoveredDevices([]); // Clear previous results when new scan starts
      }
    });

    const setupConnectionListener = () => {
      bluetoothManager.setOnConnectionStatusListener((deviceAddress, status, error) => {
        console.log(`UI: Connection Status Update for ${deviceAddress} - ${status}`);
        setIsConnecting(null);

        if (status === 'connected') {
          //Alert.alert("Connected", `Successfully connected to device ${deviceAddress}.`);

          // Immediately show connected status for better UX
          setPairedDevices(prev => {
            // If device already exists in paired list, update it
            const existingDevice = prev.find(d => d.address === deviceAddress);
            if (existingDevice) {
              return prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: true } : d);
            }

            // If device doesn't exist, we'll add it when getPairedDevices() is called
            return prev;
          });

          // Remove from discovered devices
          setDiscoveredDevices(prev => prev.filter(d => d.address !== deviceAddress));

          // Add a small delay to ensure Bluetooth stack has updated the connection status
          setTimeout(() => {
            bluetoothManager.getPairedDevices();
          }, 500);
        } else if (status === 'disconnected') {
          //Alert.alert("Disconnected", `Device ${deviceAddress} has disconnected.`);
          // Update paired devices to show disconnected status immediately
          setPairedDevices(prev => prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: false } : d));
          // Also refresh from Bluetooth stack to ensure accuracy
          setTimeout(() => {
            bluetoothManager.getPairedDevices();
          }, 500);
        } else if (status === 'error') {
          // BluetoothManager now handles error alerts with retry logic,
          // so we just update the UI state without showing duplicate alerts
          console.log(`UI: Connection error for ${deviceAddress}: ${error?.message}`);

          // Update both lists to show error/disconnected status
          setPairedDevices(prev => prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: false } : d));
          setDiscoveredDevices(prev => prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: false } : d));
        }
      });
    };

    // 初始设置监听器
    setupConnectionListener();

    bluetoothManager.initialize();

    return () => {
      bluetoothManager.cleanup();
    };
  }, []);

  // 确保在应用状态变化时重新设置连接监听器
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('应用状态变化:', nextAppState);
      if (nextAppState === 'active') {
        console.log('应用变为活跃状态，重新设置连接监听器');
        // 重新设置连接状态监听器，防止被其他页面覆盖
        bluetoothManager.setOnConnectionStatusListener((deviceAddress, status, error) => {
          console.log(`UI: Connection Status Update for ${deviceAddress} - ${status}`);
          setIsConnecting(null);

          if (status === 'connected') {
            setPairedDevices(prev => {
              const existingDevice = prev.find(d => d.address === deviceAddress);
              if (existingDevice) {
                return prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: true } : d);
              }
              return prev;
            });

            setDiscoveredDevices(prev => prev.filter(d => d.address !== deviceAddress));

            setTimeout(() => {
              bluetoothManager.getPairedDevices();
            }, 500);
          } else if (status === 'disconnected') {
            setPairedDevices(prev => prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: false } : d));
            setTimeout(() => {
              bluetoothManager.getPairedDevices();
            }, 500);
          } else if (status === 'error') {
            console.log(`UI: Connection error for ${deviceAddress}: ${error?.message}`);
            setPairedDevices(prev => prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: false } : d));
            setDiscoveredDevices(prev => prev.map(d => d.address === deviceAddress ? { ...d, connectedStatus: false } : d));
          }
        });
      }
    };

    // 监听应用状态变化
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const handleStartScan = useCallback(() => {
    if (bluetoothStatus !== 'initialized') {
      Alert.alert("Bluetooth Not Ready", "Bluetooth is not initialized or enabled. Please check settings.");
      if (bluetoothStatus === 'disabled') bluetoothManager.openBluetoothSettings();
      return;
    }
    bluetoothManager.startScan();
  }, [bluetoothStatus]);

  const handleStopScan = useCallback((reason: string = "manual") => {
    bluetoothManager.stopScan(reason);
    setIsScanning(false);
  }, []);

  const handleConnectAttempt = useCallback(async (device: AppDisplayDevice) => {
    if (isConnecting) return;
    setIsConnecting(device.address);
    //Alert.alert("Connecting...", `Attempting to connect to ${device.name || device.address}`);
    await bluetoothManager.connect(device.address);
  }, [isConnecting]);

  const handleDisconnectDevice = useCallback(async (device: AppDisplayDevice) => {
    if (isConnecting) return;
    setIsConnecting(device.address);
    //Alert.alert("Disconnecting...", `Attempting to disconnect from ${device.name || device.address}`);
    await bluetoothManager.disconnect(device.address);
  }, [isConnecting]);

  // Material 3 Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: Colors[colorScheme].text,
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '500',
      color: Colors[colorScheme].text,
      paddingHorizontal: 4,
      flex: 1, // 让标题占据剩余空间
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 4,
      paddingRight: 12, // 增加右侧间距
    },
    list: {
      flexGrow: 0, // 不让列表自动增长
      paddingHorizontal: 0,
    },
    pairedDevicesList: {
      flexGrow: 0,
      paddingHorizontal: 0,
    },
    discoveredListContainer: {
      marginBottom: 16,
      borderRadius: 12,
      marginHorizontal: 4,
    },
    bluetoothStatusContainer: {
      backgroundColor: colorScheme === 'light' ? '#FFF8E1' : '#332800',
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      marginHorizontal: 4,
    },
    bluetoothStatusText: {
      textAlign: 'center',
      fontSize: 14,
      color: colorScheme === 'light' ? '#8D4E00' : '#FFCC02',
      fontWeight: '500',
      marginBottom: 8,
    },
    scanButton: {
      width: 60,
      height: 40, // 减小高度
      borderRadius: 40,
      marginHorizontal: 0,
      alignSelf: 'center', // 垂直居中对齐
    },
    stopButton: {
      width: 60,
      height: 40, // 减小高度
      borderRadius: 40,
      marginHorizontal: 0,
      alignSelf: 'center', // 垂直居中对齐
    },
    smallButtonText: {
      fontSize: 14, // 小按钮使用更小的文字
      fontWeight: '500',
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 32,
      marginBottom: 32,
      fontSize: 14,
      color: Colors[colorScheme].text,
      opacity: 0.6,
      paddingHorizontal: 16,
    },
    loadingIndicator: {
      marginTop: 32,
      marginBottom: 32,
    },
  });

  const renderDeviceItem = ({ item }: { item: AppDisplayDevice }) => {
    const isCurrentlyConnecting = !!isConnecting && isConnecting === item.address;
    const isAnyDeviceConnecting = !!isConnecting; // 检查是否有任何设备正在连接

    return (
      <SwipeableDeviceCard device={item} colorScheme={colorScheme}>
        <DeviceCard
          device={item}
          onConnect={handleConnectAttempt}
          onDisconnect={handleDisconnectDevice}
          isConnecting={isCurrentlyConnecting}
          disabled={isAnyDeviceConnecting && !isCurrentlyConnecting} // 其他设备连接时禁用
          colorScheme={colorScheme}
        />
      </SwipeableDeviceCard>
    );
  };

  let bluetoothMessage = "";
  if (bluetoothStatus === 'initializing') {
    bluetoothMessage = "正在初始化蓝牙...";
  } else if (bluetoothStatus === 'permission_denied') {
    bluetoothMessage = "蓝牙权限被拒绝。请在设置中启用权限。";
  } else if (bluetoothStatus === 'disabled') {
    bluetoothMessage = "蓝牙已禁用。";
  } else if (bluetoothStatus === 'not_initialized') {
    bluetoothMessage = "蓝牙初始化失败。";
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>设备管理</Text>

        {bluetoothStatus !== 'initialized' && bluetoothStatus !== 'initializing' && (
          <View style={styles.bluetoothStatusContainer}>
            <Text style={styles.bluetoothStatusText}>{bluetoothMessage}</Text>
            {bluetoothStatus === 'disabled' &&
              <NeumorphicButton
                title="打开蓝牙设置"
                onPress={() => bluetoothManager.openBluetoothSettings()}
              />
            }
          </View>
        )}

        <Text style={styles.sectionTitle}>已配对设备 ({pairedDevices.length})</Text>
        {isLoadingPaired && bluetoothStatus === 'initializing' ? (
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} style={styles.loadingIndicator} />
        ) : pairedDevices.length > 0 ? (
          <FlatList
            data={pairedDevices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.address}
            style={styles.pairedDevicesList}
            scrollEnabled={false} // 禁用列表滚动
            nestedScrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>未找到已配对的设备。</Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {isScanning
              ? `正在扫描设备... (${discoveredDevices.length})`
              : `扫描结果 (${discoveredDevices.length})`}
          </Text>
          {!isScanning ? (
            <NeumorphicButton
              title="Scan"
              onPress={handleStartScan}
              disabled={bluetoothStatus !== 'initialized' || !!isConnecting || isScanning}
              style={styles.scanButton}
              textStyle={styles.smallButtonText}
            />
          ) : (
            <NeumorphicButton
              title="Stop"
              onPress={() => handleStopScan("manual")}
              style={styles.stopButton}
              textStyle={styles.smallButtonText}
              variant="error"
            />
          )}
        </View>

        <View style={styles.discoveredListContainer}>
          {discoveredDevices.length > 0 ? (
            discoveredDevices.map((item) => {
              const isCurrentlyConnecting = !!isConnecting && isConnecting === item.address;
              const isAnyDeviceConnecting = !!isConnecting; // 检查是否有任何设备正在连接
              return (
                <SwipeableDeviceCard key={item.address} device={item} colorScheme={colorScheme}>
                  <DeviceCard
                    device={item}
                    onConnect={handleConnectAttempt}
                    onDisconnect={handleDisconnectDevice}
                    isConnecting={isCurrentlyConnecting}
                    disabled={isAnyDeviceConnecting && !isCurrentlyConnecting} // 其他设备连接时禁用
                    colorScheme={colorScheme}
                  />
                </SwipeableDeviceCard>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              {isScanning ? "正在搜索设备..." : "暂无扫描结果"}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
