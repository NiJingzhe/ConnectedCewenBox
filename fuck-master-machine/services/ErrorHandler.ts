// 蓝牙错误处理工具类
export class BluetoothErrorHandler {
  // 静默处理的错误类型
  private static readonly SILENT_ERROR_TYPES = [
    'socket might closed',
    'read failed',
    'connection timeout after',
    'already connected',
    'already attempting connection',
    'device not found', // 在某些情况下设备不可用是正常的
    'socket closed'
  ];

  // 可重试的错误类型
  private static readonly RETRYABLE_ERROR_TYPES = [
    'read failed',
    'socket might closed',
    'socket closed',
    'connectionfailedexception',
    'ioexception',
    'timeout'
  ];

  // 判断是否应该静默处理错误
  static shouldSilentlyHandle(errorText: string): boolean {
    const lowerText = errorText.toLowerCase();
    return this.SILENT_ERROR_TYPES.some(type => lowerText.includes(type));
  }

  // 判断错误是否可重试
  static isRetryableError(errorText: string): boolean {
    const lowerText = errorText.toLowerCase();
    return this.RETRYABLE_ERROR_TYPES.some(type => lowerText.includes(type)) &&
           !lowerText.includes('connection timeout after'); // 排除我们自己设置的超时
  }

  // 获取用户友好的错误消息
  static getUserFriendlyMessage(errorText: string, retryCount: number = 0): string {
    const lowerText = errorText.toLowerCase();
    
    if (lowerText.includes('connection timeout after')) {
      return '连接超时，设备可能超出范围或正忙。';
    }
    
    if (lowerText.includes('read failed') || lowerText.includes('socket might closed') || lowerText.includes('socket closed')) {
      return retryCount > 0 
        ? `连接失败，已重试${retryCount + 1}次。设备可能不可用或正被其他应用使用。`
        : '连接被拒绝，设备可能不响应。';
    }
    
    if (lowerText.includes('ioexception')) {
      return '网络通信错误，请重试。';
    }
    
    if (lowerText.includes('connectionfailedexception')) {
      return retryCount > 0
        ? `连接建立失败，已重试${retryCount + 1}次。请确保设备可用。`
        : '连接建立失败，请确保设备可用并重试。';
    }
    
    if (lowerText.includes('already connected')) {
      return '设备已连接。';
    }
    
    if (lowerText.includes('device not found')) {
      return '设备未找到，请确保设备已开启并在范围内。';
    }
    
    if (lowerText.includes('bluetooth not enabled')) {
      return '蓝牙未启用，请开启蓝牙后重试。';
    }
    
    if (lowerText.includes('permission')) {
      return '蓝牙权限不足，请检查应用权限设置。';
    }
    
    // 对于未知错误，提供通用提示
    return '连接失败，请检查设备状态并重试。';
  }

  // 判断是否应该显示Alert给用户
  static shouldShowAlert(errorText: string, retryCount: number, maxRetries: number): boolean {
    const lowerText = errorText.toLowerCase();
    
    // 已连接的情况不显示错误Alert
    if (lowerText.includes('already connected')) {
      return false;
    }
    
    // 已在连接中的情况不显示错误Alert
    if (lowerText.includes('already attempting connection')) {
      return false;
    }
    
    // 只在最终尝试失败时显示Alert
    const isRetryable = this.isRetryableError(errorText);
    return retryCount >= maxRetries || !isRetryable;
  }

  // 获取适当的日志级别
  static getLogLevel(errorText: string): 'log' | 'warn' | 'error' {
    if (this.shouldSilentlyHandle(errorText)) {
      return 'log';
    }
    
    const lowerText = errorText.toLowerCase();
    
    // 严重错误使用 warn 级别
    if (lowerText.includes('permission') || lowerText.includes('bluetooth not enabled')) {
      return 'warn';
    }
    
    // 其他错误使用 log 级别
    return 'log';
  }

  // 统一的错误记录方法
  static logError(context: string, errorText: string, error?: any) {
    const level = this.getLogLevel(errorText);
    const message = `${context}: ${errorText}`;
    
    switch (level) {
      case 'warn':
        console.warn(message);
        break;
      case 'log':
      default:
        console.log(message);
        break;
    }
    
    // 详细错误信息总是使用 log 级别
    if (error) {
      console.log(`${context} details:`, JSON.stringify(error, null, 2));
    }
  }
}
