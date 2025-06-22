import { Svg, Polyline } from 'react-native-svg';
import NeumorphicButton from '@/components/NeumorphicButton';
import Colors from '@/constants/Colors';
import useColorScheme from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, View, TextInput, Alert } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import TemperatureCard from '@/components/TemperatureCard';
import RuleCard from '@/components/RuleCard';
import CommunicationManager from '@/services/CommunicationManager';
import { AlarmConfig } from '@/services/ProtocolService';
import bluetoothManager, { AppDisplayDevice } from '@/services/BluetoothManager';
import RNBClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';

export default function DeviceDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const {
    deviceName,
    deviceAddress, // 新增设备地址参数
    animationOriginX,
    animationOriginY,
    animationOriginWidth,
    animationOriginHeight,
  } = useLocalSearchParams<{
    deviceName: string;
    deviceAddress?: string; // 新增设备地址参数
    animationOriginX?: string;
    animationOriginY?: string;
    animationOriginWidth?: string;
    animationOriginHeight?: string;
  }>();

  const [temperature, setTemperature] = React.useState(23.5);
  const [temperatureHistory, setTemperatureHistory] = React.useState<{ value: number; timestamp: number }[]>([
    { value: 22.1, timestamp: 1718000000000 },
    { value: 22.8, timestamp: 1718000600000 },
    { value: 23.0, timestamp: 1718001200000 },
    { value: 23.5, timestamp: 1718001800000 },
    { value: 23.2, timestamp: 1718002400000 },
    { value: 23.8, timestamp: 1718003000000 },
    { value: 24.0, timestamp: 1718003600000 },
    { value: 22.8, timestamp: 1718004200000 },
    { value: 23.0, timestamp: 1718004800000 },
    { value: 22.1, timestamp: 1718005400000 },
    { value: 22.8, timestamp: 1718006000000 },
    { value: 23.0, timestamp: 1718006600000 },
    { value: 23.5, timestamp: 1718007200000 },
    { value: 23.2, timestamp: 1718007800000 },
    { value: 23.8, timestamp: 1718008400000 },
    { value: 24.0, timestamp: 1718009000000 },
    { value: 23.5, timestamp: 1718009600000 },
    { value: 23.2, timestamp: 1718010200000 },
    { value: 23.8, timestamp: 1718010800000 },
  ]);
  const [rules, setRules] = React.useState<{ min: string; max: string }[]>([
    { min: '20', max: '25' },
  ]);

  const handleRuleChange = (idx: number, key: 'min' | 'max', value: string) => {
    setRules(rules =>
      rules.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );
  };
  const handleDeleteRule = (idx: number) => {
    setRules(rules => rules.filter((_, i) => i !== idx));
  };
  const handleAddRule = () => {
    setRules(rules => [...rules, { min: '', max: '' }]);
  };


  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const originX = parseFloat(animationOriginX || '0');
  const originY = parseFloat(animationOriginY || '100');
  const originWidth = parseFloat(animationOriginWidth || '350');
  const originHeight = parseFloat(animationOriginHeight || '80');
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const cardCenterX = originX + originWidth / 2;
  const cardCenterY = originY + originHeight / 2;
  const offsetX = cardCenterX - centerX;
  const offsetY = cardCenterY - centerY;

  const scale = useSharedValue(originWidth / screenWidth);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(offsetX);
  const translateY = useSharedValue(offsetY);
  const borderRadius = useSharedValue(16);

  // 统计LED和Buzz的状态
  const [ledState, setLedState] = React.useState(false);
  const [buzzState, setBuzzState] = React.useState(false);

  // 通信管理器
  const [communicationManager] = React.useState(() => new CommunicationManager({ debugMode: true }));
  const [isConnected, setIsConnected] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [bluetoothDevice, setBluetoothDevice] = React.useState<AppDisplayDevice | null>(null);

  // 定时器引用
  const pollingTimerRef = React.useRef<number | null>(null);
  // 连接失败计数器
  const connectionFailureCountRef = React.useRef<number>(0);



  useEffect(() => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 50,
    });
    opacity.value = withTiming(1, {
      duration: 250,
      easing: Easing.inOut(Easing.ease),
    });
    translateX.value = withSpring(0, {
      damping: 15,
      stiffness: 50,
    });
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 50,
    });
    borderRadius.value = withTiming(0, {
      duration: 250,
      easing: Easing.inOut(Easing.ease),
    });

    // 不在Detail页面设置全局监听器，避免与主页面冲突
    // 直接尝试连接设备
    connectToDevice();

    // 清理函数
    return () => {
      stopPolling();
      // 不清除全局监听器，让主页面保持控制
    };
  }, []);

  const connectToDevice = async () => {
    if (!deviceAddress) {
      console.error('设备地址未提供');
      Alert.alert('错误', '设备地址未提供，无法连接');
      return;
    }

    setIsConnecting(true);
    try {
      // 直接使用react-native-bluetooth-classic获取绑定设备
      const bondedDevices: BluetoothDevice[] = await RNBClassic.getBondedDevices();
      const device = bondedDevices.find((d: BluetoothDevice) => d.address === deviceAddress);
      
      if (!device) {
        throw new Error('未找到指定设备');
      }

      // 创建AppDisplayDevice格式
      const appDevice: AppDisplayDevice = {
        address: device.address,
        name: device.name || deviceName || '未知设备',
        paired: true,
        connectedStatus: await device.isConnected(),
        instance: device,
      };

      setBluetoothDevice(appDevice);

      // 检查是否已连接
      if (appDevice.connectedStatus) {
        setIsConnected(true);
        setIsConnecting(false);
        await initializeCommunicationAfterConnection();
        return;
      }

      // 尝试连接
      await bluetoothManager.connect(deviceAddress);
      
      // 连接后等待一下再检查状态
      setTimeout(async () => {
        await checkAndInitializeConnection();
      }, 1000);
    } catch (error) {
      console.error('连接设备失败:', error);
      setIsConnecting(false);
      Alert.alert('连接失败', `无法连接到设备: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const checkAndInitializeConnection = async () => {
    if (!deviceAddress) return;
    
    try {
      // 重新检查连接状态
      const bondedDevices: BluetoothDevice[] = await RNBClassic.getBondedDevices();
      const device = bondedDevices.find((d: BluetoothDevice) => d.address === deviceAddress);
      
      if (device && await device.isConnected()) {
        console.log('设备连接成功，初始化通信');
        setIsConnected(true);
        setIsConnecting(false);
        await initializeCommunicationAfterConnection();
      } else {
        console.log('设备连接失败或断开');
        setIsConnected(false);
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('检查连接状态失败:', error);
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  const initializeCommunicationAfterConnection = async () => {
    try {
      if (!deviceAddress) {
        throw new Error('设备地址不可用');
      }

      // 重新获取连接后的设备实例
      const bondedDevices: BluetoothDevice[] = await RNBClassic.getBondedDevices();
      const device = bondedDevices.find((d: BluetoothDevice) => d.address === deviceAddress);
      
      if (!device) {
        throw new Error('未找到设备实例');
      }

      // 确认设备已连接
      const isDeviceConnected = await device.isConnected();
      if (!isDeviceConnected) {
        throw new Error('设备未连接');
      }

      // 更新设备状态
      const appDevice: AppDisplayDevice = {
        address: device.address,
        name: device.name || deviceName || '未知设备',
        paired: true,
        connectedStatus: true,
        instance: device,
      };

      setBluetoothDevice(appDevice);

      // 将蓝牙设备传递给通信管理器
      await communicationManager.connectDevice(device);
      
      // 更新连接状态
      setIsConnected(true);
      setIsConnecting(false);
      
      // 开始轮询
      startPolling();
      
      console.log('通信初始化成功');
    } catch (error) {
      console.error('连接后初始化通信失败:', error);
      setIsConnecting(false);
      Alert.alert('通信初始化失败', `${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const connected = await communicationManager.isDeviceConnected();
      setIsConnected(connected);
    } catch (error) {
      console.error('检查连接状态失败:', error);
      setIsConnected(false);
    }
  };

  const startPolling = () => {
    // 清除现有定时器
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    // 开始1秒间隔的轮询
    pollingTimerRef.current = setInterval(async () => {
      await pollDeviceData();
    }, 1000);
  };

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  const pollDeviceData = async () => {
    try {
      // 优先使用通信管理器的设备连接状态检查
      const commConnected = await communicationManager.isDeviceConnected();
      
      // 更新连接状态
      setIsConnected(commConnected);

      if (!commConnected) {
        console.log('通信管理器显示未连接，停止轮询');
        return;
      }

      // 如果通信管理器认为已连接，再检查蓝牙设备实例（作为备用验证）
      if (bluetoothDevice?.instance) {
        const deviceStillConnected = await bluetoothDevice.instance.isConnected();
        if (!deviceStillConnected) {
          console.log('蓝牙设备实例显示未连接，但通信管理器显示已连接，可能存在状态不一致');
          // 不立即断定连接断开，因为通信管理器是权威状态
        }
      }

      // 获取温度数据
      const temp = await communicationManager.getCurrentTemperature();
      if (temp !== null) {
        setTemperature(temp);

        // 成功获取数据，重置失败计数器
        connectionFailureCountRef.current = 0;

        // 添加到历史记录
        const now = Date.now();
        setTemperatureHistory(prev => {
          const newHistory = [...prev, { value: temp, timestamp: now }];
          // 只保留最近的50个数据点
          return newHistory.slice(-50);
        });
      }

      // 获取RTC时间（可选，用于时间同步检查）
      const rtcTime = await communicationManager.getRTCTime();
      if (rtcTime) {
        console.log('RTC时间:', rtcTime);
      }
    } catch (error) {
      console.error('轮询设备数据失败:', error);
      // 只有在连续失败多次后才认为连接断开
      connectionFailureCountRef.current++;
      
      if (connectionFailureCountRef.current >= 3) {
        console.log('连续3次轮询失败，认为设备已断开连接');
        setIsConnected(false);
        connectionFailureCountRef.current = 0;
      } else {
        console.log(`轮询失败 ${connectionFailureCountRef.current}/3，暂不认为连接断开`);
      }
    }
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
      borderRadius: borderRadius.value,
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const handleGoBack = () => {
    scale.value = withTiming(originWidth / screenWidth, {
      duration: 250,
      easing: Easing.in(Easing.cubic),
    });
    opacity.value = withTiming(0, { duration: 250 });
    translateX.value = withTiming(offsetX, { duration: 250 });
    translateY.value = withTiming(offsetY, { duration: 250 });
    borderRadius.value = withTiming(16, {
      duration: 250,
    }, () => {
      runOnJS(router.back)();
    });
  };


  const handleSync = async () => {
    if (!isConnected) {
      Alert.alert('错误', '设备未连接，无法同步规则');
      return;
    }

    setIsSyncing(true);
    try {
      // 将rules转换为AlarmConfig格式
      // 所有规则之间是OR关系，这里我们为每个规则创建两个报警配置（LED和蜂鸣器）
      const alarmConfigs: AlarmConfig[] = [];

      rules.forEach((rule, index) => {
        const minTemp = parseFloat(rule.min);
        const maxTemp = parseFloat(rule.max);

        // 验证数值
        if (isNaN(minTemp) || isNaN(maxTemp) || minTemp >= maxTemp) {
          throw new Error(`规则${index + 1}的温度范围无效`);
        }

        // 为每个规则创建LED报警配置
        alarmConfigs.push({
          id: 1, // LED
          lowTemp: minTemp,
          highTemp: maxTemp
        });

        // 为每个规则创建蜂鸣器报警配置（如果需要分别控制）
        // 这里暂时只使用LED配置，如果需要分别配置可以取消注释
        alarmConfigs.push({
          id: 0, // 蜂鸣器
          lowTemp: minTemp,
          highTemp: maxTemp
        });
      });

      // 发送配置到设备
      const success = await communicationManager.setAlarmConfigs(alarmConfigs);

      if (success) {
        Alert.alert('成功', '规则同步完成');
      } else {
        Alert.alert('错误', '规则同步失败');
      }
    } catch (error) {
      console.error('同步规则失败:', error);
      Alert.alert('错误', `同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleLED = async () => {
    if (!isConnected) {
      Alert.alert('错误', '设备未连接');
      return;
    }

    try {
      // 调试：显示即将发送的数据包结构
      const protocolService = new (require('../services/ProtocolService')).ProtocolService();
      const testPacket = ledState 
        ? protocolService.createResetLEDRequest()
        : protocolService.createSetLEDRequest();
      
      console.log('=== LED Command Packet Debug ===');
      console.log(`Command: ${ledState ? 'Reset LED' : 'Set LED'}`);
      console.log(protocolService.debugPacketStructure(testPacket));
      console.log('=== End Debug ===');

      const success = ledState
        ? await communicationManager.resetLED()
        : await communicationManager.setLED();

      if (success) {
        setLedState(!ledState);
        console.log(`LED ${!ledState ? '开启' : '关闭'}`);
      } else {
        Alert.alert('错误', `LED ${!ledState ? '开启' : '关闭'}失败`);
      }
    } catch (error) {
      console.error('LED控制失败:', error);
      Alert.alert('错误', `LED控制失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const toggleBuzz = async () => {
    if (!isConnected) {
      Alert.alert('错误', '设备未连接');
      return;
    }

    try {
      const success = buzzState
        ? await communicationManager.resetBuzzer()
        : await communicationManager.setBuzzer();

      if (success) {
        setBuzzState(!buzzState);
        console.log(`蜂鸣器 ${!buzzState ? '开启' : '关闭'}`);
      } else {
        Alert.alert('错误', `蜂鸣器 ${!buzzState ? '开启' : '关闭'}失败`);
      }
    } catch (error) {
      console.error('蜂鸣器控制失败:', error);
      Alert.alert('错误', `蜂鸣器控制失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };


  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    content: {
      flex: 1,
      padding: 0,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
    },
    background: {
      backgroundColor: colorScheme === 'light'
        ? 'rgba(0,0,0,0.1)'
        : 'rgba(0,0,0,0.3)',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: Colors[colorScheme].text,
      marginBottom: 18,
      textAlign: 'left',
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors[colorScheme].text,
      marginBottom: 8,
      marginTop: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    rulesList: {
      marginBottom: 16,
    },
    backButton: {
      width: '100%',
      maxWidth: 200,
      alignSelf: 'center',
      marginTop: 12,
    },
    addRuleButton: {
      width: 60,
      height: 40,
      borderRadius: 40,
      marginHorizontal: 0,
      alignSelf: 'center',
    },
    syncButton: {
      height: 40,
      backgroundColor: colors.tint,
      marginBottom: 12,
    },
    returnButton: {
      height: 40,
      backgroundColor: colors.error,
    },
    smallButtonText: {
      fontSize: 20,
      fontWeight: '500',
    },
    rulesListInline: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    statusText: {
      fontSize: 14,
      color: Colors[colorScheme].text,
      opacity: 0.7,
      flex: 1,
    },
    reconnectButton: {
      height: 32,
      paddingHorizontal: 12,
      backgroundColor: colors.tint,
      marginLeft: 8,
    },
    reconnectButtonText: {
      fontSize: 12,
      fontWeight: '500',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* 背景模糊层 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.background,
          backgroundStyle
        ]}
      />
      <Animated.View style={[styles.content, animatedContainerStyle]}>
        {/* 顶部设备名称 */}
        <Text style={styles.title}>{deviceName || '未知设备'}</Text>

        {/* 连接状态指示 */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isConnecting ? '连接中...' : (isConnected ? '已连接' : '未连接')}
          </Text>
          {!isConnected && !isConnecting && deviceAddress && (
            <NeumorphicButton
              title="重新连接"
              onPress={connectToDevice}
              style={styles.reconnectButton}
              textStyle={styles.reconnectButtonText}
            />
          )}
        </View>

        {/* 温度数据卡片 */}
        <TemperatureCard temperature={temperature} temperatureHistory={temperatureHistory} />

        {/* LED和Buzz控制开关 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>LED和蜂鸣器</Text>
          <View style={styles.rulesListInline}>
            <NeumorphicButton
              title="LED"
              onPress={toggleLED}
              style={{
                marginRight: 8,
                backgroundColor: ledState ? colors.tint : colors.tabIconDefault
              }}
            />
            <NeumorphicButton
              title="蜂鸣器"
              onPress={toggleBuzz}
              style={{
                marginRight: 8,
                backgroundColor: buzzState ? colors.tint : colors.tabIconDefault
              }}
            />
          </View>
        </View>


        {/* 报警规则设置 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>规则</Text>
          <View style={styles.rulesListInline}>
            <NeumorphicButton
              title="+"
              onPress={handleAddRule}
              textStyle={styles.smallButtonText}
              style={styles.addRuleButton}
            />
          </View>
        </View>
        <View style={styles.rulesList}>
          {rules.map((rule, idx) => (
            <RuleCard
              key={idx}
              min={rule.min}
              max={rule.max}
              onChangeMin={v => handleRuleChange(idx, 'min', v)}
              onChangeMax={v => handleRuleChange(idx, 'max', v)}
              onDelete={() => handleDeleteRule(idx)}
            />
          ))}
        </View>

        <View style={styles.backButton}>
          <NeumorphicButton
            title={isSyncing ? "同步中..." : "同步"}
            onPress={handleSync}
            style={[styles.syncButton, { opacity: isSyncing ? 0.5 : 1 }]}
            disabled={isSyncing || !isConnected}
          />
          <NeumorphicButton
            title="返回"
            onPress={handleGoBack}
            style={styles.returnButton}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}


