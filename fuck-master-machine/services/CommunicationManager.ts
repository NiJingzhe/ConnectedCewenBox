import { BluetoothDevice } from "react-native-bluetooth-classic";
import ProtocolService, {
  RTCDate,
  RTCTime,
  AlarmConfig,
  TemperatureLog,
  ParsedResponse,
  PROTOCOL_CONSTANTS,
} from "./ProtocolService";

export interface CommunicationConfig {
  timeoutMs?: number;
  retryCount?: number;
  debugMode?: boolean;
}

export interface DeviceStatus {
  connected: boolean;
  lastPing?: Date;
  lastTemperature?: number;
  lastTemperatureTime?: Date;
}

export type CommunicationCallback = (
  success: boolean,
  data?: any,
  error?: string
) => void;

export class CommunicationManager {
  private protocolService: ProtocolService;
  private device: BluetoothDevice | null = null;
  private config: CommunicationConfig;
  private responseBuffer: Uint8Array = new Uint8Array();
  private pendingRequests: Map<
    string,
    {
      resolve: (value: ParsedResponse) => void;
      reject: (error: Error) => void;
      timeout: any; // 使用any类型避免Node.js/Browser类型冲突
      command: string;
    }
  > = new Map();

  constructor(config: CommunicationConfig = {}) {
    this.protocolService = new ProtocolService();
    this.config = {
      timeoutMs: 5000,
      retryCount: 3,
      debugMode: false,
      ...config,
    };
  }

  // 连接设备
  public async connectDevice(device: BluetoothDevice): Promise<void> {
    try {
      const isConnected = await device.isConnected();
      if (!isConnected) {
        await device.connect();
      }

      this.device = device;
      this.setupDataListener();

      if (this.config.debugMode) {
        console.log("CommunicationManager: Device connected successfully");
      }
    } catch (error) {
      throw new Error(`Failed to connect device: ${(error as Error).message}`);
    }
  }

  // 断开设备连接
  public async disconnectDevice(): Promise<void> {
    if (this.device) {
      try {
        const isConnected = await this.device.isConnected();
        if (isConnected) {
          await this.device.disconnect();
        }
      } catch (error) {
        console.warn("Error disconnecting device:", error);
      } finally {
        this.device = null;
        this.clearPendingRequests();
        this.responseBuffer = new Uint8Array();
      }
    }
  }

  // 设置数据监听器
  private setupDataListener(): void {
    if (!this.device) return;

    this.device.onDataReceived((data) => {
      try {
        // 处理不同的数据格式
        let receivedBytes: Uint8Array;
        if (typeof data.data === "string") {
          // 如果是字符串，将其转换为字节数组
          const encoder = new TextEncoder();
          receivedBytes = encoder.encode(data.data);
        } else {
          // 假设是ArrayBuffer或类似格式
          receivedBytes = new Uint8Array(data.data);
        }
        this.handleReceivedData(receivedBytes);
      } catch (error) {
        console.error("Error handling received data:", error);
      }
    });
  }

  // 处理接收到的数据
  private handleReceivedData(data: Uint8Array): void {
    if (this.config.debugMode) {
      console.log("Received data:", this.protocolService.bytesToHex(data));
    }

    // 将新数据添加到缓冲区
    const newBuffer = new Uint8Array(this.responseBuffer.length + data.length);
    newBuffer.set(this.responseBuffer);
    newBuffer.set(data, this.responseBuffer.length);
    this.responseBuffer = newBuffer;

    // 尝试解析完整的数据包
    this.tryParsePackets();
  }

  // 尝试解析数据包
  private tryParsePackets(): void {
    while (this.responseBuffer.length >= 16) {
      // 最小包长度
      try {
        // 查找起始符
        let startIndex = -1;
        for (let i = 0; i <= this.responseBuffer.length - 2; i++) {
          if (
            this.responseBuffer[i] === 0xaa &&
            this.responseBuffer[i + 1] === 0x55
          ) {
            startIndex = i;
            break;
          }
        }

        if (startIndex === -1) {
          // 没有找到起始符，清空缓冲区
          this.responseBuffer = new Uint8Array();
          break;
        }

        if (startIndex > 0) {
          // 移除起始符之前的无效数据
          this.responseBuffer = this.responseBuffer.slice(startIndex);
        }

        if (this.responseBuffer.length < 16) {
          // 数据不够，等待更多数据
          break;
        }

        // 读取数据长度
        const dataLength = new DataView(
          this.responseBuffer.buffer,
          this.responseBuffer.byteOffset + 10
        ).getUint16(0, true);
        const totalPacketLength = 16 + dataLength; // 头部14字节 + CRC32 4字节 + 数据 + 结束符2字节

        if (this.responseBuffer.length < totalPacketLength) {
          // 数据包不完整，等待更多数据
          break;
        }

        // 提取完整数据包
        const packetBuffer = this.responseBuffer.slice(0, totalPacketLength);
        this.responseBuffer = this.responseBuffer.slice(totalPacketLength);

        // 解析数据包
        const response = this.protocolService.parseResponse(packetBuffer);
        this.handleParsedResponse(response);
      } catch (error) {
        console.error("Error parsing packet:", error);
        // 移除第一个字节，继续尝试
        this.responseBuffer = this.responseBuffer.slice(1);
      }
    }
  }

  // 处理解析后的响应
  private handleParsedResponse(response: ParsedResponse): void {
    if (this.config.debugMode) {
      console.log("Parsed response:", response);
    }

    // 查找对应的待处理请求
    const requestKey = response.command || "unknown";
    const pendingRequest = this.pendingRequests.get(requestKey);

    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(requestKey);
      pendingRequest.resolve(response);
    } else {
      console.warn("Received response for unknown request:", response);
    }
  }

  // 发送请求并等待响应
  private async sendRequest(
    requestData: Uint8Array,
    command: string,
    timeoutMs?: number
  ): Promise<ParsedResponse> {
    if (!this.device) {
      throw new Error("Device not connected");
    }

    const isConnected = await this.device.isConnected();
    if (!isConnected) {
      throw new Error("Device not connected");
    }

    const timeout = timeoutMs || this.config.timeoutMs || 5000;

    return new Promise<ParsedResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(command);
        reject(new Error(`Request timeout for command: ${command}`));
      }, timeout);

      this.pendingRequests.set(command, {
        resolve,
        reject,
        timeout: timeoutId,
        command,
      });

      if (this.config.debugMode) {
        console.log(
          `Sending request for ${command}:`,
          this.protocolService.bytesToHex(requestData)
        );
      }

      // 将Uint8Array转换为Buffer或适当格式
      const buffer = Buffer.from(requestData);
      this.device!.write(buffer).catch((error) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(command);
        reject(new Error(`Failed to send request: ${error.message}`));
      });
    });
  }

  // 清除所有待处理请求
  private clearPendingRequests(): void {
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error("Device disconnected"));
    });
    this.pendingRequests.clear();
  }

  // 检查设备连接状态
  public async isDeviceConnected(): Promise<boolean> {
    if (!this.device) return false;
    return await this.device.isConnected();
  }

  // API 方法

  // Ping设备
  public async ping(): Promise<boolean> {
    try {
      const requestData = this.protocolService.createPingRequest();
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.PING
      );
      return response.success;
    } catch (error) {
      console.error("Ping failed:", error);
      return false;
    }
  }

  // 获取当前温度
  public async getCurrentTemperature(): Promise<number | null> {
    try {
      const requestData = this.protocolService.createGetTempRequest();
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.GET_TEMP
      );

      if (response.success && response.data?.temperature !== undefined) {
        return response.data.temperature;
      }
      return null;
    } catch (error) {
      console.error("Get temperature failed:", error);
      return null;
    }
  }

  // 获取RTC日期
  public async getRTCDate(): Promise<RTCDate | null> {
    try {
      const requestData = this.protocolService.createGetRTCDateRequest();
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.GET_RTC_DATE
      );

      if (response.success && response.data?.date) {
        return response.data.date;
      }
      return null;
    } catch (error) {
      console.error("Get RTC date failed:", error);
      return null;
    }
  }

  // 获取RTC时间
  public async getRTCTime(): Promise<RTCTime | null> {
    try {
      const requestData = this.protocolService.createGetRTCTimeRequest();
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.GET_RTC_TIME
      );

      if (response.success && response.data?.time) {
        return response.data.time;
      }
      return null;
    } catch (error) {
      console.error("Get RTC time failed:", error);
      return null;
    }
  }

  // 设置RTC日期
  public async setRTCDate(date: RTCDate): Promise<boolean> {
    try {
      const requestData = this.protocolService.createSetRTCDateRequest(date);
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.SET_RTC_DATE
      );
      return response.success;
    } catch (error) {
      console.error("Set RTC date failed:", error);
      return false;
    }
  }

  // 设置RTC时间
  public async setRTCTime(time: RTCTime): Promise<boolean> {
    try {
      const requestData = this.protocolService.createSetRTCTimeRequest(time);
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.SET_RTC_TIME
      );
      return response.success;
    } catch (error) {
      console.error("Set RTC time failed:", error);
      return false;
    }
  }

  // 设置完整的日期时间（便利方法）
  public async setRTCDateTime(date: Date): Promise<boolean> {
    const rtcDate: RTCDate = {
      year: date.getFullYear() % 100, // 取后两位
      month: date.getMonth() + 1, // getMonth() 返回 0-11
      day: date.getDate(),
      weekday: date.getDay() === 0 ? 7 : date.getDay(), // 周日为7，其他1-6
    };

    const rtcTime: RTCTime = {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };

    const dateSuccess = await this.setRTCDate(rtcDate);
    if (!dateSuccess) return false;

    const timeSuccess = await this.setRTCTime(rtcTime);
    return timeSuccess;
  }

  // 获取报警配置
  public async getAlarmConfigs(): Promise<AlarmConfig[] | null> {
    try {
      const requestData = this.protocolService.createGetAlarmsRequest();
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.GET_ALARMS
      );

      if (response.success && response.data?.alarms) {
        return response.data.alarms;
      }
      return null;
    } catch (error) {
      console.error("Get alarm configs failed:", error);
      return null;
    }
  }

  // 设置报警配置
  public async setAlarmConfigs(alarms: AlarmConfig[]): Promise<boolean> {
    try {
      const requestData = this.protocolService.createSetAlarmsRequest(alarms);
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.SET_ALARMS
      );
      return response.success;
    } catch (error) {
      console.error("Set alarm configs failed:", error);
      return false;
    }
  }

  // 获取温度日志
  public async getTemperatureLogs(
    startTimestamp: number,
    endTimestamp: number,
    maxCount?: number
  ): Promise<TemperatureLog[] | null> {
    try {
      const requestData = this.protocolService.createGetLogRequest(
        startTimestamp,
        endTimestamp,
        maxCount
      );
      const response = await this.sendRequest(
        requestData,
        PROTOCOL_CONSTANTS.COMMANDS.GET_LOG
      );

      if (response.success && response.data?.logs) {
        return response.data.logs;
      }
      return null;
    } catch (error) {
      console.error("Get temperature logs failed:", error);
      return null;
    }
  }

  // 获取最近24小时的温度日志（便利方法）
  public async getRecentTemperatureLogs(
    hours: number = 24
  ): Promise<TemperatureLog[] | null> {
    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - hours * 3600;
    return this.getTemperatureLogs(startTimestamp, endTimestamp);
  }

  // 获取设备状态
  public async getDeviceStatus(): Promise<DeviceStatus> {
    const status: DeviceStatus = {
      connected: await this.isDeviceConnected(),
    };

    if (status.connected) {
      // 测试连接
      const pingResult = await this.ping();
      if (pingResult) {
        status.lastPing = new Date();
      }

      // 获取当前温度
      const temperature = await this.getCurrentTemperature();
      if (temperature !== null) {
        status.lastTemperature = temperature;
        status.lastTemperatureTime = new Date();
      }
    }

    return status;
  }

  // 执行带重试的操作
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries || this.config.retryCount || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries) {
          if (this.config.debugMode) {
            console.log(
              `Operation failed, retrying... (${attempt + 1}/${retries + 1})`
            );
          }

          // 等待一段时间后重试
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
        }
      }
    }

    throw lastError || new Error("Operation failed after retries");
  }

  // 启用/禁用调试模式
  public setDebugMode(enabled: boolean): void {
    this.config.debugMode = enabled;
  }

  // 设置超时时间
  public setTimeout(timeoutMs: number): void {
    this.config.timeoutMs = timeoutMs;
  }

  // 设置重试次数
  public setRetryCount(count: number): void {
    this.config.retryCount = count;
  }
}

export default CommunicationManager;
