import { AppDisplayDevice } from "@/services/BluetoothManager";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
    ColorSchemeName,
    Dimensions,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35; // 降低到35%以便更容易触发
const MAX_TRANSLATE = -SCREEN_WIDTH * 0.3; // 最大滑动距离

interface SwipeableDeviceCardProps {
  device: AppDisplayDevice;
  children: React.ReactNode;
  colorScheme: ColorSchemeName;
}

const SwipeableDeviceCard: React.FC<SwipeableDeviceCardProps> = ({
  device,
  children,
  colorScheme,
}) => {
  const translateX = useSharedValue(0);
  const currentColorScheme = colorScheme || "light";
  const cardRef = useRef<View>(null);
  
  // 添加手势方向检测的状态
  const gestureDirection = useSharedValue<'none' | 'horizontal' | 'vertical'>('none');
  const startPosition = useSharedValue({ x: 0, y: 0 });

  const navigateToDetail = () => {
    // 尝试获取卡片的真实位置
    cardRef.current?.measure((x, y, width, height, pageX, pageY) => {
      const cardPosition = {
        x: pageX, // 卡片在屏幕中的X位置
        y: pageY, // 卡片在屏幕中的Y位置
        width: width, // 卡片宽度
        height: height, // 卡片高度
      };

      router.push({
        pathname: "/device-detail",
        params: {
          deviceName: device.name || "未知设备",
          deviceAddress: device.address,
          // 传递动画起始位置信息
          animationOriginX: cardPosition.x.toString(),
          animationOriginY: cardPosition.y.toString(),
          animationOriginWidth: cardPosition.width.toString(),
          animationOriginHeight: cardPosition.height.toString(),
        },
      });
    });
  };  // 创建一个专门用于水平滑动的手势
  const horizontalPanGesture = Gesture.Pan()
    .onStart((event) => {
      // 记录手势开始位置
      startPosition.value = { x: event.x, y: event.y };
      gestureDirection.value = 'none';
    })
    .onUpdate((event) => {
      const deltaX = event.translationX;
      const deltaY = event.translationY;
      
      // 如果还没确定方向，根据滑动距离判断
      if (gestureDirection.value === 'none') {
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // 只有当滑动距离超过阈值时才确定方向
        if (absDeltaX > 15 || absDeltaY > 15) {
          // 水平滑动距离大于垂直滑动距离，且水平滑动向左
          if (absDeltaX > absDeltaY * 1.5 && deltaX < 0) {
            gestureDirection.value = 'horizontal';
          } else {
            gestureDirection.value = 'vertical';
            return; // 如果是垂直滑动，直接返回，不处理
          }
        }
      }

      // 只有确定为水平滑动时才处理
      if (gestureDirection.value === 'horizontal') {
        const newTranslateX = deltaX;
        // 只允许向左滑动，但有阻尼效果
        if (newTranslateX <= 0) {
          // 当超过最大距离时添加阻尼
          const dampedTranslateX =
            newTranslateX < MAX_TRANSLATE
              ? MAX_TRANSLATE + (newTranslateX - MAX_TRANSLATE) * 0.3
              : newTranslateX;
          translateX.value = dampedTranslateX;
        }
      }
    })
    .onEnd(() => {
      // 只有水平滑动才处理导航
      if (gestureDirection.value === 'horizontal') {
        const shouldNavigate = Math.abs(translateX.value) > SWIPE_THRESHOLD;

        if (shouldNavigate) {
          // 滑动距离超过阈值，导航到详情页
          // 先执行一个快速的"拉伸"动画，模拟卡片被拉向详情页
          translateX.value = withTiming(
            -SCREEN_WIDTH * 0.9,
            {
              duration: 200,
              easing: Easing.out(Easing.cubic),
            },
            () => {
              runOnJS(navigateToDetail)();
              // 立即重置位置，为下次滑动做准备
              translateX.value = withSpring(0, {
                damping: 40,
                stiffness: 100,
              });
            }
          );
        } else {
          // 滑动距离不够，回弹
          translateX.value = withSpring(0, {
            damping: 40,
            stiffness: 200,
          });
        }
      }
      
      // 重置方向
      gestureDirection.value = 'none';
    })
    .activeOffsetX([-10, 10]) // 水平方向需要至少10px的滑动才激活
    .failOffsetY([-15, 15]) // 垂直滑动超过15px时手势失败
    .simultaneousWithExternalGesture() // 允许与外部手势同时执行
    .enableTrackpadTwoFingerGesture(false); // 禁用触控板双指手势

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const backgroundStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    const opacity = interpolate(
      progress,
      [0, 0.5, 1],
      [0, 0.7, 1],
      Extrapolate.CLAMP
    );
    const scale = interpolate(
      progress,
      [0, 0.5, 1],
      [0.8, 0.9, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // 添加箭头指示器的动画
  const arrowStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    const translateArrow = interpolate(
      progress,
      [0, 1],
      [20, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateX: translateArrow }],
    };
  });

  const styles = StyleSheet.create({
    container: {
      position: "relative",
    },
    backgroundContainer: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: SCREEN_WIDTH,
      backgroundColor: currentColorScheme === "light" ? "#4CAF50" : "#2E7D32",
      justifyContent: "center",
      alignItems: "flex-end",
      paddingRight: 40,
      borderRadius: 16,
      marginVertical: 8,
      marginHorizontal: 12,
    },
    backgroundContent: {
      alignItems: "center",
      justifyContent: "center",
    },
    backgroundText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
      marginTop: 8,
    },
    backgroundIcon: {
      color: "white",
      fontSize: 28,
    },
    arrowContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 12,
    },
    arrow: {
      color: "white",
      fontSize: 20,
      marginHorizontal: 2,
    },
  });

  return (
    <View style={styles.container} ref={cardRef}>
      {/* 背景提示 */}
      <Animated.View style={[styles.backgroundContainer, backgroundStyle]}>
        <View style={styles.backgroundContent}>
          <Text style={styles.backgroundText}>查看详情</Text>
          <Animated.View style={[styles.arrowContainer, arrowStyle]}>
            <Text style={styles.arrow}>››</Text>
            <Text style={styles.arrow}>››</Text>
            <Text style={styles.arrow}>››</Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* 可滑动的卡片 */}
      <GestureDetector gesture={horizontalPanGesture}>
        <Animated.View style={animatedStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

export default SwipeableDeviceCard;
