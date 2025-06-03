import { BluetoothDevice } from 'react-native-bluetooth-classic';

// 协议常量
export const PROTOCOL_CONSTANTS = {
  START_BYTES: [0xAA, 0x55],
  END_BYTES: [0x55, 0xAA],
  VERSION: 0x01,
  PACKET_TYPES: {
    HOST_REQUEST: 0x00,
    HOST_RESPONSE: 0x01,
    HOST_ERROR: 0x0F,
    DEVICE_REQUEST: 0x10,
    DEVICE_RESPONSE: 0x11,
    DEVICE_ERROR: 0x1F,
  },
  COMMANDS: {
    PING: 'ping',
    GET_TEMP: 'temp',
    GET_RTC_DATE: 'gdat',
    GET_RTC_TIME: 'gtim',
    SET_RTC_DATE: 'sdat',
    SET_RTC_TIME: 'stim',
    GET_ALARMS: 'galm',
    SET_ALARMS: 'salm',
    GET_LOG: 'glog',
  },
  STATUS_CODES: {
    OK: 0x00,
    INVALID_PARAM: 0x01,
    NOT_INITIALIZED: 0x02,
    SENSOR_ERROR: 0x03,
    STORAGE_ERROR: 0x04,
    INTERNAL_ERROR: 0xFF,
  },
  ERROR_CODES: {
    CORRUPT: 0x01,
    UNEXPECTED_RESPONSE: 0x02,
    UNKNOWN_ERROR: 0xFF,
  },
};

// 数据类型接口
export interface TLVField {
  tag: string;
  value: any;
}

export interface ProtocolPacket {
  version: number;
  type: number;
  packetNumber: number;
  responseNumber: number;
  data: TLVField[];
}

export interface ParsedResponse {
  success: boolean;
  command?: string;
  status?: number;
  data?: any;
  error?: {
    code: number;
    description?: string;
  };
}

// 日期时间接口
export interface RTCDate {
  year: number;   // 0-99
  month: number;  // 1-12
  day: number;    // 1-31
  weekday: number; // 1-7
}

export interface RTCTime {
  hour: number;   // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

// 报警配置接口
export interface AlarmConfig {
  id: number;        // 0=蜂鸣器，1=LED
  lowTemp: number;   // 下限温度
  highTemp: number;  // 上限温度
}

// 温度日志接口
export interface TemperatureLog {
  timestamp: number; // Unix时间戳（秒）
  temperature: number; // 温度值（摄氏度）
}

export class ProtocolService {
  private packetCounter = 0;
  private readonly MAX_PACKET_NUMBER = 0x7F;
  
  // STM32 CRC32 实现（需要与硬件一致）
  private crc32Table: number[] = [];
  
  constructor() {
    this.initCRC32Table();
  }

  private initCRC32Table(): void {
    // STM32 CRC32 多项式：0x04C11DB7
    const polynomial = 0x04C11DB7;
    
    for (let i = 0; i < 256; i++) {
      let crc = i << 24;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x80000000) {
          crc = (crc << 1) ^ polynomial;
        } else {
          crc = crc << 1;
        }
      }
      this.crc32Table[i] = crc >>> 0; // 确保无符号32位
    }
  }

  private calculateCRC32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    
    for (let i = 0; i < data.length; i++) {
      const index = ((crc >>> 24) ^ data[i]) & 0xFF;
      crc = ((crc << 8) ^ this.crc32Table[index]) >>> 0;
    }
    
    return crc ^ 0xFFFFFFFF;
  }

  private getNextPacketNumber(): number {
    this.packetCounter = (this.packetCounter + 1) % (this.MAX_PACKET_NUMBER + 1);
    return this.packetCounter;
  }

  // TLV 编码
  private encodeTLV(tag: string, value: any): Uint8Array {
    if (tag.length !== 2) {
      throw new Error(`TLV tag must be exactly 2 characters, got: ${tag}`);
    }

    let valueBytes: Uint8Array;

    if (typeof value === 'string') {
      valueBytes = new TextEncoder().encode(value);
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value <= 0xFF) {
          valueBytes = new Uint8Array([value]);
        } else if (value <= 0xFFFF) {
          valueBytes = new Uint8Array(2);
          new DataView(valueBytes.buffer).setUint16(0, value, true); // little-endian
        } else if (value <= 0xFFFFFFFF) {
          valueBytes = new Uint8Array(4);
          new DataView(valueBytes.buffer).setUint32(0, value, true);
        } else {
          valueBytes = new Uint8Array(8);
          new DataView(valueBytes.buffer).setBigUint64(0, BigInt(value), true);
        }
      } else {
        // float32
        valueBytes = new Uint8Array(4);
        new DataView(valueBytes.buffer).setFloat32(0, value, true);
      }
    } else if (Array.isArray(value)) {
      // 嵌套TLV数组
      const nestedBytes: Uint8Array[] = [];
      for (const item of value) {
        nestedBytes.push(this.encodeTLV(item.tag, item.value));
      }
      const totalLength = nestedBytes.reduce((sum, bytes) => sum + bytes.length, 0);
      valueBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const bytes of nestedBytes) {
        valueBytes.set(bytes, offset);
        offset += bytes.length;
      }
    } else {
      throw new Error(`Unsupported TLV value type: ${typeof value}`);
    }

    const result = new Uint8Array(4 + valueBytes.length);
    const view = new DataView(result.buffer);
    
    // Tag (2 bytes)
    result[0] = tag.charCodeAt(0);
    result[1] = tag.charCodeAt(1);
    
    // Length (2 bytes, little-endian)
    view.setUint16(2, valueBytes.length, true);
    
    // Value
    result.set(valueBytes, 4);
    
    return result;
  }

  // TLV 解码
  private decodeTLV(data: Uint8Array, offset: number = 0): { field: TLVField; nextOffset: number } {
    if (offset + 4 > data.length) {
      throw new Error('TLV data too short for header');
    }

    const view = new DataView(data.buffer, data.byteOffset + offset);
    const tag = String.fromCharCode(data[offset], data[offset + 1]);
    const length = view.getUint16(2, true); // little-endian
    
    if (offset + 4 + length > data.length) {
      throw new Error('TLV data too short for value');
    }

    const valueBytes = data.slice(offset + 4, offset + 4 + length);
    let value: any;

    // 根据tag类型解析value
    switch (tag) {
      case 'T ':
        value = new DataView(valueBytes.buffer, valueBytes.byteOffset).getFloat32(0, true);
        break;
      case 'ST':
      case 'EC':
      case 'YY':
      case 'MM':
      case 'DD':
      case 'WK':
      case 'HH':
      case 'SS':
      case 'ID':
        value = valueBytes[0];
        break;
      case 'MX':
        value = new DataView(valueBytes.buffer, valueBytes.byteOffset).getUint16(0, true);
        break;
      case 'TS':
      case 'TS1':
      case 'TS2':
        value = Number(new DataView(valueBytes.buffer, valueBytes.byteOffset).getBigUint64(0, true));
        break;
      case 'L ':
      case 'H ':
        value = new DataView(valueBytes.buffer, valueBytes.byteOffset).getFloat32(0, true);
        break;
      case 'IN':
        value = new TextDecoder().decode(valueBytes);
        break;
      case 'ED':
        value = new TextDecoder('utf-8').decode(valueBytes);
        break;
      case 'AL':
      case 'LG':
        // 嵌套TLV数组
        value = [];
        let nestedOffset = 0;
        while (nestedOffset < valueBytes.length) {
          const nested = this.decodeTLV(valueBytes, nestedOffset);
          value.push(nested.field);
          nestedOffset = nested.nextOffset;
        }
        break;
      default:
        // 默认按字符串处理
        value = new TextDecoder().decode(valueBytes);
        break;
    }

    return {
      field: { tag, value },
      nextOffset: offset + 4 + length
    };
  }

  // 编码数据包
  private encodePacket(type: number, data: TLVField[], responseNumber: number = 0): Uint8Array {
    const packetNumber = this.getNextPacketNumber();
    
    // 编码数据部分
    const dataBytes: Uint8Array[] = [];
    for (const field of data) {
      dataBytes.push(this.encodeTLV(field.tag, field.value));
    }
    
    const totalDataLength = dataBytes.reduce((sum, bytes) => sum + bytes.length, 0);
    const dataBuffer = new Uint8Array(totalDataLength);
    let offset = 0;
    for (const bytes of dataBytes) {
      dataBuffer.set(bytes, offset);
      offset += bytes.length;
    }

    // 计算CRC32（不包含起始符、版本、数据长度、CRC32和结束符）
    const crcData = new Uint8Array(1 + 2 + 2 + totalDataLength); // 类别 + 包编号 + 响应编号 + 数据
    crcData[0] = type;
    new DataView(crcData.buffer).setUint16(1, packetNumber, true);
    new DataView(crcData.buffer).setUint16(3, responseNumber, true);
    crcData.set(dataBuffer, 5);
    
    const crc32 = this.calculateCRC32(crcData);

    // 构建完整数据包
    const packet = new Uint8Array(2 + 1 + 1 + 2 + 2 + 2 + 4 + totalDataLength + 2);
    const view = new DataView(packet.buffer);
    let pos = 0;

    // 起始符
    packet[pos++] = PROTOCOL_CONSTANTS.START_BYTES[0];
    packet[pos++] = PROTOCOL_CONSTANTS.START_BYTES[1];
    
    // 版本
    packet[pos++] = PROTOCOL_CONSTANTS.VERSION;
    
    // 类别
    packet[pos++] = type;
    
    // 数据包编号
    view.setUint16(pos, packetNumber, true);
    pos += 2;
    
    // 响应编号
    view.setUint16(pos, responseNumber, true);
    pos += 2;
    
    // 数据长度
    view.setUint16(pos, totalDataLength, true);
    pos += 2;
    
    // CRC32
    view.setUint32(pos, crc32, true);
    pos += 4;
    
    // 数据内容
    packet.set(dataBuffer, pos);
    pos += totalDataLength;
    
    // 结束符
    packet[pos++] = PROTOCOL_CONSTANTS.END_BYTES[0];
    packet[pos++] = PROTOCOL_CONSTANTS.END_BYTES[1];

    return packet;
  }

  // 解码数据包
  private decodePacket(buffer: Uint8Array): ProtocolPacket {
    if (buffer.length < 16) { // 最小包长度
      throw new Error('Packet too short');
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset);
    let pos = 0;

    // 检查起始符
    if (buffer[pos] !== PROTOCOL_CONSTANTS.START_BYTES[0] || 
        buffer[pos + 1] !== PROTOCOL_CONSTANTS.START_BYTES[1]) {
      throw new Error('Invalid start bytes');
    }
    pos += 2;

    // 版本
    const version = buffer[pos++];
    
    // 类别
    const type = buffer[pos++];
    
    // 数据包编号
    const packetNumber = view.getUint16(pos, true);
    pos += 2;
    
    // 响应编号
    const responseNumber = view.getUint16(pos, true);
    pos += 2;
    
    // 数据长度
    const dataLength = view.getUint16(pos, true);
    pos += 2;
    
    // CRC32
    const receivedCRC = view.getUint32(pos, true);
    pos += 4;

    // 检查包长度
    if (buffer.length < pos + dataLength + 2) {
      throw new Error('Packet length mismatch');
    }

    // 验证CRC32
    const crcData = new Uint8Array(1 + 2 + 2 + dataLength);
    crcData[0] = type;
    new DataView(crcData.buffer).setUint16(1, packetNumber, true);
    new DataView(crcData.buffer).setUint16(3, responseNumber, true);
    crcData.set(buffer.slice(pos, pos + dataLength), 5);
    
    const calculatedCRC = this.calculateCRC32(crcData);
    if (calculatedCRC !== receivedCRC) {
      throw new Error('CRC32 mismatch');
    }

    // 解析数据部分
    const dataBuffer = buffer.slice(pos, pos + dataLength);
    const data: TLVField[] = [];
    let dataOffset = 0;
    
    while (dataOffset < dataBuffer.length) {
      const result = this.decodeTLV(dataBuffer, dataOffset);
      data.push(result.field);
      dataOffset = result.nextOffset;
    }
    
    pos += dataLength;

    // 检查结束符
    if (buffer[pos] !== PROTOCOL_CONSTANTS.END_BYTES[0] || 
        buffer[pos + 1] !== PROTOCOL_CONSTANTS.END_BYTES[1]) {
      throw new Error('Invalid end bytes');
    }

    return {
      version,
      type,
      packetNumber,
      responseNumber,
      data
    };
  }

  // API 方法

  // Ping命令
  public createPingRequest(): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.PING }
    ]);
  }

  // 获取温度
  public createGetTempRequest(): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.GET_TEMP }
    ]);
  }

  // 获取RTC日期
  public createGetRTCDateRequest(): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.GET_RTC_DATE }
    ]);
  }

  // 获取RTC时间
  public createGetRTCTimeRequest(): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.GET_RTC_TIME }
    ]);
  }

  // 设置RTC日期
  public createSetRTCDateRequest(date: RTCDate): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.SET_RTC_DATE },
      { tag: 'YY', value: date.year },
      { tag: 'MM', value: date.month },
      { tag: 'DD', value: date.day },
      { tag: 'WK', value: date.weekday }
    ]);
  }

  // 设置RTC时间
  public createSetRTCTimeRequest(time: RTCTime): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.SET_RTC_TIME },
      { tag: 'HH', value: time.hour },
      { tag: 'MM', value: time.minute },
      { tag: 'SS', value: time.second }
    ]);
  }

  // 获取报警配置
  public createGetAlarmsRequest(): Uint8Array {
    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.GET_ALARMS }
    ]);
  }

  // 设置报警配置
  public createSetAlarmsRequest(alarms: AlarmConfig[]): Uint8Array {
    const alarmTLVs = alarms.map(alarm => ({
      tag: 'AL',
      value: [
        { tag: 'ID', value: alarm.id },
        { tag: 'L ', value: alarm.lowTemp },
        { tag: 'H ', value: alarm.highTemp }
      ]
    }));

    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.SET_ALARMS },
      ...alarmTLVs
    ]);
  }

  // 获取温度日志
  public createGetLogRequest(startTimestamp: number, endTimestamp: number, maxCount?: number): Uint8Array {
    const data: TLVField[] = [
      { tag: 'IN', value: PROTOCOL_CONSTANTS.COMMANDS.GET_LOG },
      { tag: 'TS1', value: startTimestamp },
      { tag: 'TS2', value: endTimestamp }
    ];

    if (maxCount !== undefined) {
      data.push({ tag: 'MX', value: maxCount });
    }

    return this.encodePacket(PROTOCOL_CONSTANTS.PACKET_TYPES.HOST_REQUEST, data);
  }

  // 解析响应
  public parseResponse(buffer: Uint8Array): ParsedResponse {
    try {
      const packet = this.decodePacket(buffer);
      
      // 检查是否为错误响应
      if (packet.type === PROTOCOL_CONSTANTS.PACKET_TYPES.DEVICE_ERROR) {
        const errorCode = packet.data.find(field => field.tag === 'EC')?.value;
        const errorDescription = packet.data.find(field => field.tag === 'ED')?.value;
        
        return {
          success: false,
          error: {
            code: errorCode || PROTOCOL_CONSTANTS.ERROR_CODES.UNKNOWN_ERROR,
            description: errorDescription
          }
        };
      }

      // 解析正常响应
      const command = packet.data.find(field => field.tag === 'IN')?.value;
      const status = packet.data.find(field => field.tag === 'ST')?.value;
      
      if (status !== PROTOCOL_CONSTANTS.STATUS_CODES.OK) {
        return {
          success: false,
          command,
          status,
          error: {
            code: status || PROTOCOL_CONSTANTS.STATUS_CODES.INTERNAL_ERROR
          }
        };
      }

      // 根据命令类型解析数据
      let responseData: any = {};
      
      switch (command) {
        case PROTOCOL_CONSTANTS.COMMANDS.PING:
          responseData = { ping: 'pong' };
          break;
          
        case PROTOCOL_CONSTANTS.COMMANDS.GET_TEMP:
          responseData.temperature = packet.data.find(field => field.tag === 'T ')?.value;
          break;
          
        case PROTOCOL_CONSTANTS.COMMANDS.GET_RTC_DATE:
          responseData.date = {
            year: packet.data.find(field => field.tag === 'YY')?.value,
            month: packet.data.find(field => field.tag === 'MM')?.value,
            day: packet.data.find(field => field.tag === 'DD')?.value,
            weekday: packet.data.find(field => field.tag === 'WK')?.value
          };
          break;
          
        case PROTOCOL_CONSTANTS.COMMANDS.GET_RTC_TIME:
          responseData.time = {
            hour: packet.data.find(field => field.tag === 'HH')?.value,
            minute: packet.data.find(field => field.tag === 'MM')?.value,
            second: packet.data.find(field => field.tag === 'SS')?.value
          };
          break;
          
        case PROTOCOL_CONSTANTS.COMMANDS.GET_ALARMS:
          const alarmFields = packet.data.filter(field => field.tag === 'AL');
          responseData.alarms = alarmFields.map((alarmField: any) => {
            const alarmData = alarmField.value;
            return {
              id: alarmData.find((f: any) => f.tag === 'ID')?.value,
              lowTemp: alarmData.find((f: any) => f.tag === 'L ')?.value,
              highTemp: alarmData.find((f: any) => f.tag === 'H ')?.value
            };
          });
          break;
          
        case PROTOCOL_CONSTANTS.COMMANDS.GET_LOG:
          const logFields = packet.data.filter(field => field.tag === 'LG');
          responseData.logs = logFields.map((logField: any) => {
            const logData = logField.value;
            return {
              timestamp: logData.find((f: any) => f.tag === 'TS')?.value,
              temperature: logData.find((f: any) => f.tag === 'T ')?.value
            };
          });
          break;
      }

      return {
        success: true,
        command,
        status,
        data: responseData
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: PROTOCOL_CONSTANTS.ERROR_CODES.CORRUPT,
          description: `Parse error: ${(error as Error).message}`
        }
      };
    }
  }

  // 工具方法：将Uint8Array转换为十六进制字符串（用于调试）
  public bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
  }

  // 工具方法：从十六进制字符串创建Uint8Array（用于测试）
  public hexToBytes(hex: string): Uint8Array {
    const hexString = hex.replace(/\s/g, '');
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
  }
}

export default ProtocolService;
