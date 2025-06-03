// 通信工具类：提供数据转换、验证等辅助功能

import { RTCDate, RTCTime, AlarmConfig, TemperatureLog } from './ProtocolService';

export class CommunicationUtils {
  
  // 日期时间转换工具

  /**
   * 将JavaScript Date对象转换为RTC日期格式
   */
  static dateToRTCDate(date: Date): RTCDate {
    return {
      year: date.getFullYear() % 100, // 取后两位年份
      month: date.getMonth() + 1, // 月份从0开始，需要+1
      day: date.getDate(),
      weekday: date.getDay() === 0 ? 7 : date.getDay() // 周日为7，其他为1-6
    };
  }

  /**
   * 将JavaScript Date对象转换为RTC时间格式
   */
  static dateToRTCTime(date: Date): RTCTime {
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds()
    };
  }

  /**
   * 将RTC日期和时间合并为JavaScript Date对象
   */
  static rtcToDate(rtcDate: RTCDate, rtcTime: RTCTime, baseYear: number = 2000): Date {
    const fullYear = baseYear + rtcDate.year;
    return new Date(
      fullYear,
      rtcDate.month - 1, // 月份需要-1
      rtcDate.day,
      rtcTime.hour,
      rtcTime.minute,
      rtcTime.second
    );
  }

  /**
   * 获取当前时间的Unix时间戳（秒）
   */
  static getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 获取指定小时数之前的时间戳
   */
  static getTimestampHoursAgo(hours: number): number {
    return this.getCurrentTimestamp() - (hours * 3600);
  }

  /**
   * 将Unix时间戳转换为可读的日期时间字符串
   */
  static timestampToString(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }

  // 数据验证工具

  /**
   * 验证RTC日期是否有效
   */
  static validateRTCDate(date: RTCDate): { valid: boolean; error?: string } {
    if (date.year < 0 || date.year > 99) {
      return { valid: false, error: '年份必须在0-99之间' };
    }
    
    if (date.month < 1 || date.month > 12) {
      return { valid: false, error: '月份必须在1-12之间' };
    }
    
    if (date.day < 1 || date.day > 31) {
      return { valid: false, error: '日期必须在1-31之间' };
    }
    
    if (date.weekday < 1 || date.weekday > 7) {
      return { valid: false, error: '星期必须在1-7之间' };
    }

    // 检查月份和日期的合理性
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (date.day > daysInMonth[date.month - 1]) {
      return { valid: false, error: `${date.month}月最多只有${daysInMonth[date.month - 1]}天` };
    }

    return { valid: true };
  }

  /**
   * 验证RTC时间是否有效
   */
  static validateRTCTime(time: RTCTime): { valid: boolean; error?: string } {
    if (time.hour < 0 || time.hour > 23) {
      return { valid: false, error: '小时必须在0-23之间' };
    }
    
    if (time.minute < 0 || time.minute > 59) {
      return { valid: false, error: '分钟必须在0-59之间' };
    }
    
    if (time.second < 0 || time.second > 59) {
      return { valid: false, error: '秒数必须在0-59之间' };
    }

    return { valid: true };
  }

  /**
   * 验证报警配置是否有效
   */
  static validateAlarmConfig(alarm: AlarmConfig): { valid: boolean; error?: string } {
    if (alarm.id < 0 || alarm.id > 1) {
      return { valid: false, error: '报警ID必须为0（蜂鸣器）或1（LED）' };
    }

    if (alarm.lowTemp >= alarm.highTemp) {
      return { valid: false, error: '低温阈值必须小于高温阈值' };
    }

    if (alarm.lowTemp < -40 || alarm.lowTemp > 125) {
      return { valid: false, error: '低温阈值超出传感器范围（-40°C到125°C）' };
    }

    if (alarm.highTemp < -40 || alarm.highTemp > 125) {
      return { valid: false, error: '高温阈值超出传感器范围（-40°C到125°C）' };
    }

    return { valid: true };
  }

  // 数据格式化工具

  /**
   * 格式化温度值显示
   */
  static formatTemperature(temperature: number, decimals: number = 1): string {
    return `${temperature.toFixed(decimals)}°C`;
  }

  /**
   * 格式化日期时间显示
   */
  static formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  /**
   * 格式化RTC日期显示
   */
  static formatRTCDate(date: RTCDate, baseYear: number = 2000): string {
    const fullYear = baseYear + date.year;
    const weekdays = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    return `${fullYear}-${date.month.toString().padStart(2, '0')}-${date.day.toString().padStart(2, '0')} ${weekdays[date.weekday]}`;
  }

  /**
   * 格式化RTC时间显示
   */
  static formatRTCTime(time: RTCTime): string {
    return `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}:${time.second.toString().padStart(2, '0')}`;
  }

  /**
   * 格式化报警配置显示
   */
  static formatAlarmConfig(alarm: AlarmConfig): string {
    const deviceName = alarm.id === 0 ? '蜂鸣器' : 'LED指示灯';
    return `${deviceName}: ${this.formatTemperature(alarm.lowTemp)} ~ ${this.formatTemperature(alarm.highTemp)}`;
  }

  // 数据分析工具

  /**
   * 计算温度日志的统计信息
   */
  static analyzeTemperatureLogs(logs: TemperatureLog[]): {
    count: number;
    min: number;
    max: number;
    average: number;
    latest: TemperatureLog | null;
    oldest: TemperatureLog | null;
  } {
    if (logs.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        average: 0,
        latest: null,
        oldest: null
      };
    }

    const temperatures = logs.map(log => log.temperature);
    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    const average = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;

    // 按时间戳排序获取最新和最旧的记录
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    const oldest = sortedLogs[0];
    const latest = sortedLogs[sortedLogs.length - 1];

    return {
      count: logs.length,
      min,
      max,
      average,
      latest,
      oldest
    };
  }

  /**
   * 过滤指定时间范围内的温度日志
   */
  static filterLogsByTimeRange(
    logs: TemperatureLog[], 
    startTimestamp: number, 
    endTimestamp: number
  ): TemperatureLog[] {
    return logs.filter(log => 
      log.timestamp >= startTimestamp && log.timestamp <= endTimestamp
    );
  }

  /**
   * 检查温度是否触发报警
   */
  static checkTemperatureAlarm(
    temperature: number, 
    alarms: AlarmConfig[]
  ): { triggered: boolean; alarmType: string; alarmId: number } | null {
    for (const alarm of alarms) {
      if (temperature < alarm.lowTemp) {
        return {
          triggered: true,
          alarmType: '低温报警',
          alarmId: alarm.id
        };
      }
      
      if (temperature > alarm.highTemp) {
        return {
          triggered: true,
          alarmType: '高温报警',
          alarmId: alarm.id
        };
      }
    }
    
    return null;
  }

  // 错误处理工具

  /**
   * 格式化错误信息
   */
  static formatError(error: Error | string): string {
    if (typeof error === 'string') {
      return error;
    }
    
    return error.message || '未知错误';
  }

  /**
   * 检查是否为超时错误
   */
  static isTimeoutError(error: Error): boolean {
    return error.message.toLowerCase().includes('timeout');
  }

  /**
   * 检查是否为连接错误
   */
  static isConnectionError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('connect') || 
           message.includes('disconnect') || 
           message.includes('not connected');
  }

  // 调试工具

  /**
   * 创建带时间戳的日志函数
   */
  static createLogger(prefix: string) {
    return (message: string, ...args: any[]) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${prefix}: ${message}`, ...args);
    };
  }

  /**
   * 将字节数组转换为可读的十六进制字符串
   */
  static bytesToHexString(bytes: number[] | Uint8Array): string {
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  }

  /**
   * 创建设备状态报告
   */
  static createDeviceStatusReport(
    temperature: number | null,
    date: RTCDate | null,
    time: RTCTime | null,
    alarms: AlarmConfig[] | null
  ): string {
    const lines: string[] = [];
    
    lines.push('=== 设备状态报告 ===');
    lines.push(`报告时间: ${this.formatDateTime(new Date())}`);
    lines.push('');
    
    if (temperature !== null) {
      lines.push(`当前温度: ${this.formatTemperature(temperature)}`);
    } else {
      lines.push('当前温度: 无法读取');
    }
    
    if (date && time) {
      lines.push(`设备时间: ${this.formatRTCDate(date)} ${this.formatRTCTime(time)}`);
    } else {
      lines.push('设备时间: 无法读取');
    }
    
    if (alarms && alarms.length > 0) {
      lines.push('');
      lines.push('报警配置:');
      alarms.forEach(alarm => {
        lines.push(`  ${this.formatAlarmConfig(alarm)}`);
      });
    } else {
      lines.push('报警配置: 无法读取');
    }
    
    return lines.join('\n');
  }
}

export default CommunicationUtils;
