import NeumorphicButton from '@/components/NeumorphicButton';
import Colors from '@/constants/Colors';
import useColorScheme from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

export default function DeviceDetailScreen() {
  const colorScheme = useColorScheme();
  const { 
    deviceName, 
    deviceAddress,
    animationOriginX,
    animationOriginY,
    animationOriginWidth,
    animationOriginHeight,
  } = useLocalSearchParams<{
    deviceName: string;
    deviceAddress: string;
    animationOriginX?: string;
    animationOriginY?: string;
    animationOriginWidth?: string;
    animationOriginHeight?: string;
  }>();

  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

  // 解析动画起始位置 - 这些是屏幕绝对坐标
  const originX = parseFloat(animationOriginX || '0');
  const originY = parseFloat(animationOriginY || '100');
  const originWidth = parseFloat(animationOriginWidth || '350');
  const originHeight = parseFloat(animationOriginHeight || '80');

  // 计算相对于屏幕中心的偏移量
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  
  // 卡片中心相对于屏幕中心的偏移
  const cardCenterX = originX + originWidth / 2;
  const cardCenterY = originY + originHeight / 2;
  
  const offsetX = cardCenterX - centerX;
  const offsetY = cardCenterY - centerY;

  // 动画值
  const scale = useSharedValue(originWidth / screenWidth); // 根据卡片实际大小计算初始缩放
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(offsetX); // 从卡片相对位置开始
  const translateY = useSharedValue(offsetY); // 从卡片相对位置开始
  const borderRadius = useSharedValue(16); // 从卡片圆角开始

  useEffect(() => {
    // 页面进入动画 - 模拟从卡片位置扩展到全屏
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 50,
    });
    opacity.value = withTiming(1, {
      duration: 250,
      easing: Easing.inOut(Easing.ease),
    });
    // X和Y位置都动画到屏幕中心（0,0）
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
  }, []);

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

  // 背景模糊动画样式
  const backgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  const handleGoBack = () => {
    // 退出动画 - 收缩回卡片位置和大小
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[colorScheme].background,
    },
    content: {
      flex: 1,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: Colors[colorScheme].text,
      marginBottom: 30,
      textAlign: 'center',
    },
    infoContainer: {
      backgroundColor: colorScheme === 'light' ? '#f8f8f8' : '#2c2c2c',
      borderRadius: 16,
      padding: 24,
      marginBottom: 30,
      width: '100%',
      maxWidth: 400,
      elevation: 2,
      shadowColor: Colors[colorScheme].text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: colorScheme === 'light' ? 0.1 : 0.3,
      shadowRadius: 4,
    },
    infoLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors[colorScheme].text,
      marginBottom: 8,
      opacity: 0.7,
    },
    infoValue: {
      fontSize: 18,
      color: Colors[colorScheme].text,
      marginBottom: 20,
      fontWeight: '500',
    },
    backButton: {
      width: '100%',
      maxWidth: 200,
    },
    placeholder: {
      fontSize: 16,
      color: Colors[colorScheme].text,
      opacity: 0.6,
      textAlign: 'center',
      marginTop: 20,
      fontStyle: 'italic',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* 背景模糊层 */}
      <Animated.View 
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colorScheme === 'light' 
              ? 'rgba(0,0,0,0.1)' 
              : 'rgba(0,0,0,0.3)',
          },
          backgroundStyle
        ]}
      />
      
      <Animated.View style={[styles.content, animatedContainerStyle]}>
        <Text style={styles.title}>设备详情</Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>设备名称</Text>
          <Text style={styles.infoValue}>
            {deviceName || '未知设备'}
          </Text>
          
          <Text style={styles.infoLabel}>设备地址</Text>
          <Text style={styles.infoValue}>
            {deviceAddress || 'N/A'}
          </Text>
        </View>

        <Text style={styles.placeholder}>
          更多设备功能即将推出...
        </Text>

        <View style={styles.backButton}>
          <NeumorphicButton
            title="返回"
            onPress={handleGoBack}
            style={{ marginTop: 30 }}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
