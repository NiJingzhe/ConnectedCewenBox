# 蓝牙通信服务

根据 `communication.md` 中定义的通信协议，提供了完整的蓝牙通信封装服务。

## 文件结构

```
services/
├── ProtocolService.ts      # 底层协议编解码服务
├── CommunicationManager.ts # 高级通信管理器
├── CommunicationUtils.ts   # 工具类（数据转换、验证等）
├── UsageExample.tsx        # 使用示例和自定义Hook
├── index.ts               # 统一导出
└── README.md              # 本文档
```

## 快速开始

### 1. 基本使用

```typescript
import { CommunicationManager } from './services';

// 创建通信管理器
const communicationManager = new CommunicationManager({
  timeoutMs: 5000,    // 请求超时时间
  retryCount: 3,      // 重试次数
  debugMode: true     // 调试模式
});

// 连接设备
await communicationManager.connectDevice(bluetoothDevice);

// 获取当前温度
const temperature = await communicationManager.getCurrentTemperature();
console.log(`当前温度: ${temperature}°C`);

// 同步设备时间
const success = await communicationManager.setRTCDateTime(new Date());

// 断开连接
await communicationManager.disconnectDevice();
```

### 2. 使用自定义Hook

```typescript
import { useDeviceCommunication } from './services';

const MyComponent = () => {
  const {
    isConnected,
    currentTemperature,
    lastUpdateTime,
    connect,
    disconnect,
    updateTemperature,
    syncTime,
    setAlarms,
    getHistory
  } = useDeviceCommunication();

  return (
    <View>
      <Text>连接状态: {isConnected ? '已连接' : '未连接'}</Text>
      {currentTemperature && (
        <Text>当前温度: {currentTemperature}°C</Text>
      )}
    </View>
  );
};
```

## API 参考

### CommunicationManager

主要的通信管理类，提供高级API。

#### 构造函数
```typescript
new CommunicationManager(config?: CommunicationConfig)
```

#### 主要方法

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `connectDevice(device)` | 连接蓝牙设备 | `Promise<void>` |
| `disconnectDevice()` | 断开设备连接 | `Promise<void>` |
| `ping()` | 测试设备连接 | `Promise<boolean>` |
| `getCurrentTemperature()` | 获取当前温度 | `Promise<number \| null>` |
| `getRTCDate()` | 获取RTC日期 | `Promise<RTCDate \| null>` |
| `getRTCTime()` | 获取RTC时间 | `Promise<RTCTime \| null>` |
| `setRTCDate(date)` | 设置RTC日期 | `Promise<boolean>` |
| `setRTCTime(time)` | 设置RTC时间 | `Promise<boolean>` |
| `setRTCDateTime(date)` | 设置完整日期时间 | `Promise<boolean>` |
| `getAlarmConfigs()` | 获取报警配置 | `Promise<AlarmConfig[] \| null>` |
| `setAlarmConfigs(alarms)` | 设置报警配置 | `Promise<boolean>` |
| `getTemperatureLogs(start, end, max?)` | 获取温度日志 | `Promise<TemperatureLog[] \| null>` |
| `getRecentTemperatureLogs(hours?)` | 获取最近的温度日志 | `Promise<TemperatureLog[] \| null>` |
| `getDeviceStatus()` | 获取设备状态 | `Promise<DeviceStatus>` |
| `executeWithRetry(operation, maxRetries?)` | 带重试执行操作 | `Promise<T>` |

### ProtocolService

底层协议编解码服务，处理字节级别的通信。

#### 编码方法

| 方法 | 描述 |
|------|------|
| `createPingRequest()` | 创建Ping请求 |
| `createGetTempRequest()` | 创建获取温度请求 |
| `createGetRTCDateRequest()` | 创建获取RTC日期请求 |
| `createGetRTCTimeRequest()` | 创建获取RTC时间请求 |
| `createSetRTCDateRequest(date)` | 创建设置RTC日期请求 |
| `createSetRTCTimeRequest(time)` | 创建设置RTC时间请求 |
| `createGetAlarmsRequest()` | 创建获取报警配置请求 |
| `createSetAlarmsRequest(alarms)` | 创建设置报警配置请求 |
| `createGetLogRequest(start, end, max?)` | 创建获取日志请求 |

#### 解码方法

| 方法 | 描述 |
|------|------|
| `parseResponse(buffer)` | 解析响应数据包 |

### CommunicationUtils

工具类，提供数据转换、验证、格式化等功能。

#### 数据转换

| 方法 | 描述 |
|------|------|
| `dateToRTCDate(date)` | Date对象转RTC日期格式 |
| `dateToRTCTime(date)` | Date对象转RTC时间格式 |
| `rtcToDate(rtcDate, rtcTime)` | RTC格式转Date对象 |
| `getCurrentTimestamp()` | 获取当前Unix时间戳 |
| `getTimestampHoursAgo(hours)` | 获取指定小时前的时间戳 |

#### 数据验证

| 方法 | 描述 |
|------|------|
| `validateRTCDate(date)` | 验证RTC日期格式 |
| `validateRTCTime(time)` | 验证RTC时间格式 |
| `validateAlarmConfig(alarm)` | 验证报警配置 |

#### 数据格式化

| 方法 | 描述 |
|------|------|
| `formatTemperature(temp, decimals?)` | 格式化温度显示 |
| `formatDateTime(date)` | 格式化日期时间 |
| `formatRTCDate(date)` | 格式化RTC日期 |
| `formatRTCTime(time)` | 格式化RTC时间 |
| `formatAlarmConfig(alarm)` | 格式化报警配置 |

#### 数据分析

| 方法 | 描述 |
|------|------|
| `analyzeTemperatureLogs(logs)` | 分析温度日志统计信息 |
| `filterLogsByTimeRange(logs, start, end)` | 按时间范围过滤日志 |
| `checkTemperatureAlarm(temp, alarms)` | 检查温度是否触发报警 |

## 数据类型

### RTCDate
```typescript
interface RTCDate {
  year: number;     // 0-99
  month: number;    // 1-12
  day: number;      // 1-31
  weekday: number;  // 1-7 (1=周一, 7=周日)
}
```

### RTCTime
```typescript
interface RTCTime {
  hour: number;     // 0-23
  minute: number;   // 0-59
  second: number;   // 0-59
}
```

### AlarmConfig
```typescript
interface AlarmConfig {
  id: number;       // 0=蜂鸣器, 1=LED
  lowTemp: number;  // 低温阈值
  highTemp: number; // 高温阈值
}
```

### TemperatureLog
```typescript
interface TemperatureLog {
  timestamp: number;    // Unix时间戳（秒）
  temperature: number;  // 温度值（摄氏度）
}
```

## 错误处理

所有异步方法都会抛出错误，建议使用try-catch处理：

```typescript
try {
  const temperature = await communicationManager.getCurrentTemperature();
  console.log(`温度: ${temperature}°C`);
} catch (error) {
  console.error('获取温度失败:', error.message);
  // 处理错误
}
```

### 常见错误类型

- **连接错误**: 设备未连接或连接断开
- **超时错误**: 请求超时
- **协议错误**: 数据包格式错误或CRC校验失败
- **参数错误**: 传入的参数不合法
- **设备错误**: 设备返回的错误状态码

## 重试机制

使用 `executeWithRetry` 方法可以自动重试失败的操作：

```typescript
const temperature = await communicationManager.executeWithRetry(async () => {
  const temp = await communicationManager.getCurrentTemperature();
  if (temp === null) throw new Error('Temperature read failed');
  return temp;
}, 3); // 最多重试3次
```

## 调试模式

启用调试模式可以查看详细的通信日志：

```typescript
const communicationManager = new CommunicationManager({
  debugMode: true
});

// 或者动态设置
communicationManager.setDebugMode(true);
```

## 性能优化建议

1. **连接管理**: 避免频繁连接断开设备
2. **请求频率**: 控制温度读取频率，避免过于频繁的请求
3. **错误处理**: 适当的错误处理和重试机制
4. **内存管理**: 及时清理不需要的数据和监听器

## 示例应用

查看 `UsageExample.tsx` 文件中的完整示例，包括：

- 设备连接管理
- 温度监控
- 时间同步
- 报警配置
- 历史数据查询
- 自定义Hook的使用

## 注意事项

1. 确保设备支持SPP协议
2. CRC32算法必须与STM32硬件实现一致
3. 时间戳使用Unix格式（秒）
4. 温度范围受DS18B20传感器限制（-40°C到125°C）
5. 所有网络字节序使用小端序（little-endian）
