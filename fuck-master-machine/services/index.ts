// 通信服务模块统一导出
// 使用示例：import { CommunicationManager, ProtocolService, CommunicationUtils } from './services';

export { default as ProtocolService } from './ProtocolService';
export { default as CommunicationManager } from './CommunicationManager';
export { default as CommunicationUtils } from './CommunicationUtils';
export { default as UsageExample } from './UsageExample';

// 导出类型定义
export type {
  RTCDate,
  RTCTime,
  AlarmConfig,
  TemperatureLog,
  ParsedResponse,
  TLVField,
  ProtocolPacket,
} from './ProtocolService';

export type {
  CommunicationConfig,
  DeviceStatus,
  CommunicationCallback,
} from './CommunicationManager';

// 导出常量
export { PROTOCOL_CONSTANTS } from './ProtocolService';

// 导出Hook
export { useDeviceCommunication } from './UsageExample';
