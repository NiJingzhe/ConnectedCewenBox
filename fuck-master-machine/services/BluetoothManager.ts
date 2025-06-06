import { Alert, Permission, PermissionsAndroid, Platform } from 'react-native';
import RNBClassic, {
    BluetoothDevice,
    BluetoothEventSubscription,
    BluetoothNativeDevice
} from 'react-native-bluetooth-classic';
import { BluetoothErrorHandler } from './ErrorHandler';

// Re-define or import AppDisplayDevice if it's used by the manager's public interface
// For now, let's assume AppDisplayDevice is primarily a concern of the UI layer,
// and the manager will deal with BluetoothDevice or BluetoothNativeDevice,
// or a slightly augmented version if needed for its internal logic.

export interface AppDisplayDevice {
  address: string;
  name: string | null;
  paired: boolean;
  connectedStatus: boolean;
  instance?: BluetoothDevice;
}

type DeviceDiscoveredCallback = (device: AppDisplayDevice) => void;
type ConnectionStatusCallback = (deviceAddress: string, status: 'connected' | 'disconnected' | 'error', error?: Error) => void;
type ScanStatusCallback = (isScanning: boolean) => void;
type PairedDevicesCallback = (devices: AppDisplayDevice[]) => void;
type BluetoothStatusCallback = (status: 'initialized' | 'not_initialized' | 'disabled' | 'permission_denied') => void;


class BluetoothManager {
  private deviceDiscoveredSubscription: BluetoothEventSubscription | null = null;
  private connectionSuccessSubscription: BluetoothEventSubscription | null = null;
  private connectionLostSubscription: BluetoothEventSubscription | null = null;
  private errorSubscription: BluetoothEventSubscription | null = null;
  private bluetoothEnabledSubscription: BluetoothEventSubscription | null = null;
  private bluetoothDisabledSubscription: BluetoothEventSubscription | null = null;
  // TODO: Add listeners for other events like read, etc.

  private onDeviceDiscoveredCallback: DeviceDiscoveredCallback | null = null;
  private onConnectionStatusCallback: ConnectionStatusCallback | null = null;
  private onScanStatusCallback: ScanStatusCallback | null = null;
  private onPairedDevicesCallback: PairedDevicesCallback | null = null;
  private onBluetoothStatusCallback: BluetoothStatusCallback | null = null;

  // 连接状态跟踪
  private activeConnections: Map<string, { promise: Promise<any>; cancelled: boolean }> = new Map();


  private isScanningRef = false; // Internal tracking of scanning state
  private scanTimeoutRef: ReturnType<typeof setTimeout> | null = null;


  constructor() {
    // Consider if any auto-initialization is needed or if it should be explicit
  }

  public setOnDeviceDiscoveredListener(callback: DeviceDiscoveredCallback | null) {
    this.onDeviceDiscoveredCallback = callback;
  }

  public setOnConnectionStatusListener(callback: ConnectionStatusCallback | null) {
    this.onConnectionStatusCallback = callback;
  }
  
  public setOnScanStatusListener(callback: ScanStatusCallback | null) {
    this.onScanStatusCallback = callback;
  }

  public setOnPairedDevicesListener(callback: PairedDevicesCallback | null) {
    this.onPairedDevicesCallback = callback;
  }

  public setOnBluetoothStatusListener(callback: BluetoothStatusCallback | null) {
    this.onBluetoothStatusCallback = callback;
  }


  private async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const permissionsToRequest: Permission[] = [];
        if (Platform.Version >= 31) { // Android 12+
          permissionsToRequest.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            // 某些设备制造商可能仍然需要位置权限
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
        } else { // Android 11 and below
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          // Potentially BLUETOOTH_ADMIN for older versions if needed for pairing, etc.
          // but react-native-bluetooth-classic usually handles this.
        }

        if (permissionsToRequest.length === 0) return true; // No permissions needed (e.g. iOS or older Android handled by lib)

        console.log('BluetoothManager: Requesting permissions:', permissionsToRequest);
        const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
        console.log('BluetoothManager: Permission results:', granted);
        
        const allGranted = permissionsToRequest.every(
          (perm) => granted[perm] === PermissionsAndroid.RESULTS.GRANTED,
        );

        if (!allGranted) {
          const deniedPermissions = permissionsToRequest.filter(
            (perm) => granted[perm] !== PermissionsAndroid.RESULTS.GRANTED
          );
          console.warn('BluetoothManager: Denied permissions:', deniedPermissions);
          Alert.alert('Permissions Denied', 'Bluetooth permissions are required to scan and connect to devices.');
        }
        return allGranted;
      } catch (err) {
        console.warn('BluetoothManager: Bluetooth permissions request failed:', err);
        Alert.alert('Permission Error', 'Failed to request Bluetooth permissions.');
        return false;
      }
    }
    return true; // For iOS, permissions are typically handled differently (e.g., Info.plist)
  }

  public async initialize(): Promise<void> {
    console.log('BluetoothManager: Initializing...');
    try {
      const permissionsGranted = await this.requestBluetoothPermissions();
      if (!permissionsGranted) {
        this.onBluetoothStatusCallback?.('permission_denied');
        return;
      }

      const enabled = await RNBClassic.isBluetoothEnabled();
      if (!enabled) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth to use this feature.',
          [{ text: 'OK', onPress: () => RNBClassic.openBluetoothSettings() }],
        );
        this.onBluetoothStatusCallback?.('disabled');
        return;
      }
      
      this.setupGlobalEventListeners();
      this.onBluetoothStatusCallback?.('initialized');
      console.log('BluetoothManager: Initialized successfully.');
      this.getPairedDevices(); // Fetch initially paired devices
    } catch (error) {
      console.warn('BluetoothManager: Initialization failed:', error);
      Alert.alert('Bluetooth Error', `Failed to initialize Bluetooth: ${(error as Error).message}`);
      this.onBluetoothStatusCallback?.('not_initialized');
    }
  }
  
  private setupGlobalEventListeners() {
    // Device Discovered
    if (this.deviceDiscoveredSubscription) this.deviceDiscoveredSubscription.remove();
    this.deviceDiscoveredSubscription = RNBClassic.onDeviceDiscovered((eventData: BluetoothNativeDevice | {device: BluetoothNativeDevice}) => { // Type eventData more strictly
        let nativeDevice: BluetoothNativeDevice | undefined = undefined;
        
        // The library might pass the device directly or nested under a 'device' property.
        if (eventData && 'address' in eventData && typeof eventData.address === 'string') { // Check if eventData itself is the device
            nativeDevice = eventData as BluetoothNativeDevice;
        } else if (eventData && 'device' in eventData && eventData.device && typeof eventData.device.address === 'string') { // Check for nested device
            nativeDevice = eventData.device as BluetoothNativeDevice;
        } else {
            console.warn("BluetoothManager: Received an unparseable device in onDeviceDiscovered:", eventData);
            return;
        }

        if (nativeDevice && nativeDevice.address) {
            const appDevice: AppDisplayDevice = {
                address: nativeDevice.address,
                name: nativeDevice.name || "Unknown Device",
                paired: !!nativeDevice.bonded, // Ensure boolean
                connectedStatus: false, // Discovered devices are not connected initially
                // instance: nativeDevice, // This might be problematic as BluetoothNativeDevice is not BluetoothDevice
            };
            this.onDeviceDiscoveredCallback?.(appDevice);
        } else {
            console.warn("BluetoothManager: Discovered device has invalid address:", nativeDevice);
        }
    });

    // Connection Success
    if (this.connectionSuccessSubscription) this.connectionSuccessSubscription.remove();
    this.connectionSuccessSubscription = RNBClassic.onDeviceConnected((event: any) => {
        console.log('BluetoothManager: Device connected event:', JSON.stringify(event));
        
        let deviceAddress: string | undefined = undefined;
        
        // Handle different possible event structures
        if (event && event.device && event.device.address) {
            deviceAddress = event.device.address;
        } else if (event && event.address) {
            deviceAddress = event.address;
        } else if (typeof event === 'string') {
            deviceAddress = event;
        }
        
        if (deviceAddress) {
            console.log('BluetoothManager: Device connected:', deviceAddress);
            this.onConnectionStatusCallback?.(deviceAddress, 'connected');
            this.getPairedDevices(); // Refresh paired devices as connection might change pairing status
        } else {
            console.warn('BluetoothManager: Connected event received but could not extract device address:', event);
        }
    });
    
    // Connection Lost
    if (this.connectionLostSubscription) this.connectionLostSubscription.remove();
    this.connectionLostSubscription = RNBClassic.onDeviceDisconnected((event: any) => {
        console.log('BluetoothManager: Device disconnected event:', JSON.stringify(event));
        
        let deviceAddress: string | undefined = undefined;
        
        // Handle different possible event structures
        if (event && event.device && event.device.address) {
            deviceAddress = event.device.address;
        } else if (event && event.address) {
            deviceAddress = event.address;
        } else if (typeof event === 'string') {
            deviceAddress = event;
        }
        
        if (deviceAddress) {
            console.log('BluetoothManager: Device disconnected:', deviceAddress);
            this.onConnectionStatusCallback?.(deviceAddress, 'disconnected');
            this.getPairedDevices(); // Refresh paired devices
        } else {
            console.warn('BluetoothManager: Disconnected event received but could not extract device address:', event);
        }
    });

    // Bluetooth Error
    // This listener is for general errors from the native module.
    if (this.errorSubscription) this.errorSubscription.remove();
    // Using a more generic type for the error event, as the specific type is unclear or causing issues.
    this.errorSubscription = RNBClassic.onError((event: any) => { 
        let errorMessage = "An unknown Bluetooth error occurred.";
        if (event && event.message && typeof event.message === 'string') {
            errorMessage = event.message;
        } else if (event && event.error && typeof event.error.message === 'string') {
            errorMessage = event.error.message;
        } else if (typeof event === 'string') {
            errorMessage = event;
        } else if (event && event.device && event.message && typeof event.message === 'string') {
            // Sometimes the error might be structured with a device and a message
            errorMessage = `Error for device ${event.device.address || 'unknown'}: ${event.message}`;
        }

        console.warn('BluetoothManager: Global Bluetooth Error:', errorMessage);
        // 不显示系统级错误的Alert，只记录日志
        // Alert.alert("Bluetooth System Error", errorMessage);
    });

    // TODO: Add listeners for BluetoothAdapterStatusChanged if needed
    if (this.bluetoothEnabledSubscription) this.bluetoothEnabledSubscription.remove();
    this.bluetoothEnabledSubscription = RNBClassic.onBluetoothEnabled((event) => {
      console.log("BluetoothManager: Bluetooth enabled event:", event);
      // 当蓝牙被启用时，尝试重新初始化
      this.handleBluetoothEnabled();
    });

    if (this.bluetoothDisabledSubscription) this.bluetoothDisabledSubscription.remove();
    this.bluetoothDisabledSubscription = RNBClassic.onBluetoothDisabled((event) => {
      console.log("BluetoothManager: Bluetooth disabled event:", event);
      // 当蓝牙被禁用时，更新状态
      this.handleBluetoothDisabled();
    });
  }

  // 处理蓝牙启用事件
  private async handleBluetoothEnabled(): Promise<void> {
    console.log('BluetoothManager: Handling Bluetooth enabled event');
    try {
      // 检查权限是否仍然有效
      const permissionsGranted = await this.requestBluetoothPermissions();
      if (!permissionsGranted) {
        console.warn('BluetoothManager: Bluetooth enabled but permissions not granted');
        this.onBluetoothStatusCallback?.('permission_denied');
        return;
      }

      // 重新设置事件监听器（如果还没有设置）
      this.setupGlobalEventListeners();
      
      // 更新状态为已初始化
      this.onBluetoothStatusCallback?.('initialized');
      console.log('BluetoothManager: Bluetooth re-initialized after being enabled');
      
      // 刷新配对设备列表
      this.getPairedDevices();
    } catch (error) {
      console.warn('BluetoothManager: Failed to handle Bluetooth enabled event:', error);
      this.onBluetoothStatusCallback?.('not_initialized');
    }
  }

  // 处理蓝牙禁用事件
  private handleBluetoothDisabled(): void {
    console.log('BluetoothManager: Handling Bluetooth disabled event');
    
    // 清理所有活跃连接
    this.activeConnections.clear();
    
    // 停止扫描如果正在进行
    if (this.isScanningRef) {
      this.isScanningRef = false;
      this.onScanStatusCallback?.(false);
      if (this.scanTimeoutRef) {
        clearTimeout(this.scanTimeoutRef);
        this.scanTimeoutRef = null;
      }
    }
    
    // 更新状态为禁用
    this.onBluetoothStatusCallback?.('disabled');
    
    // 清空设备列表
    this.onPairedDevicesCallback?.([]);
    
    console.log('BluetoothManager: Bluetooth disabled, cleared all states');
  }


  public async getPairedDevices(): Promise<void> {
    console.log('BluetoothManager: Getting paired devices...');
    try {
      const bonded: BluetoothDevice[] = await RNBClassic.getBondedDevices();
      const formattedBonded: AppDisplayDevice[] = await Promise.all(
        bonded.map(async (d) => ({
          address: d.address,
          name: d.name || 'Paired Device',
          paired: true,
          connectedStatus: await d.isConnected(),
          instance: d,
        })),
      );
      this.onPairedDevicesCallback?.(formattedBonded);
    } catch (error) {
      console.warn('BluetoothManager: Failed to fetch paired devices:', error);
      // 不显示Alert，因为这可能在后台频繁发生
      // Alert.alert('Error', `Could not fetch paired devices: ${(error as Error).message}`);
      this.onPairedDevicesCallback?.([]); // Send empty list on error
    }
  }

  public async startScan(scanDurationMs: number = 15000): Promise<void> {
    if (this.isScanningRef) {
      console.log('BluetoothManager: Scan already in progress.');
      return;
    }
    console.log('BluetoothManager: Starting scan...');
    this.isScanningRef = true;
    this.onScanStatusCallback?.(true);

    try {
      // 检查权限是否仍然有效
      const permissionsGranted = await this.requestBluetoothPermissions();
      if (!permissionsGranted) {
        console.warn('BluetoothManager: Scan permissions not granted');
        Alert.alert('权限不足', '需要蓝牙权限才能扫描设备。请在设置中授予权限。');
        this.isScanningRef = false;
        this.onScanStatusCallback?.(false);
        return;
      }

      // Permissions and enabled status should be checked during initialize()
      // Or add a check here if initialize is not a prerequisite for scanning.
      const enabled = await RNBClassic.isBluetoothEnabled();
      if (!enabled) {
          Alert.alert("Bluetooth Disabled", "Please enable Bluetooth to scan.");
          this.isScanningRef = false;
          this.onScanStatusCallback?.(false);
          return;
      }
      
      console.log('BluetoothManager: Starting discovery with react-native-bluetooth-classic...');
      await RNBClassic.startDiscovery();
      console.log('BluetoothManager: Discovery started successfully.');

      if (this.scanTimeoutRef) clearTimeout(this.scanTimeoutRef);
      this.scanTimeoutRef = setTimeout(() => {
        console.log(`BluetoothManager: Scan timeout (${scanDurationMs / 1000}s), stopping scan.`);
        this.stopScan('timeout');
      }, scanDurationMs);
    } catch (error) {
      console.warn('BluetoothManager: Failed to start scan:', error);
      const errorMessage = (error as Error).message || 'Unknown error';
      console.warn('BluetoothManager: Detailed scan error:', errorMessage);
      Alert.alert('Scan Error', `Failed to start scanning: ${errorMessage}`);
      this.isScanningRef = false;
      this.onScanStatusCallback?.(false);
      if (this.scanTimeoutRef) {
        clearTimeout(this.scanTimeoutRef);
        this.scanTimeoutRef = null;
      }
    }
  }

  public async stopScan(reason: string = 'manual'): Promise<void> {
    if (!this.isScanningRef) {
      console.log(`BluetoothManager: Stop scan called (${reason}), but scan is not active.`);
      return;
    }
    console.log(`BluetoothManager: Attempting to stop scan (${reason})...`);
    if (this.scanTimeoutRef) {
      clearTimeout(this.scanTimeoutRef);
      this.scanTimeoutRef = null;
    }
    try {
      await RNBClassic.cancelDiscovery();
      console.log(`BluetoothManager: Discovery cancelled (${reason}).`);
    } catch (error) {
      console.warn(`BluetoothManager: Failed to cancel discovery (${reason}):`, error);
      // Don't alert for timeout or unmount reasons, only manual attempts.
      if (reason === 'manual') {
        Alert.alert('Error', `Could not stop scan: ${(error as Error).message}`);
      }
    } finally {
      this.isScanningRef = false;
      this.onScanStatusCallback?.(false);
    }
  }

  private async isDeviceConnected(deviceAddress: string): Promise<boolean> {
    try {
      const connectedDevices = await RNBClassic.getConnectedDevices();
      return connectedDevices.some(device => device.address === deviceAddress);
    } catch (error) {
      console.warn('BluetoothManager: Could not check connection status:', error);
      return false;
    }
  }

  private async clearStaleConnection(deviceAddress: string): Promise<void> {
    try {
      const device = await RNBClassic.getConnectedDevice(deviceAddress);
      if (device) {
        console.log(`BluetoothManager: Clearing stale connection for ${deviceAddress}`);
        await device.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for clean disconnect
      }
    } catch (error) {
      console.log(`BluetoothManager: No stale connection to clear for ${deviceAddress}`);
    }
  }

  public async connect(deviceAddress: string, retryCount: number = 0): Promise<void> {
    const maxRetries = 2;
    console.log(`BluetoothManager: Attempting to connect to ${deviceAddress} (attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    // 声明定时器变量，需要在整个方法中都能访问
    let cancellationCheckInterval: number | undefined;
    
    // 清理函数
    const cleanup = () => {
      if (cancellationCheckInterval) {
        clearInterval(cancellationCheckInterval);
        cancellationCheckInterval = undefined;
      }
    };
    
    if (!deviceAddress || typeof deviceAddress !== 'string') {
      const errorMessage = 'Invalid device address provided for connection';
      console.warn('BluetoothManager: Connection validation failed:', errorMessage);
      Alert.alert('Connection Failed', errorMessage);
      this.onConnectionStatusCallback?.(deviceAddress || 'unknown', 'error', new Error(errorMessage));
      return;
    }
    
    if (this.isScanningRef) {
      console.log('BluetoothManager: Scan in progress, stopping before connecting...');
      await this.stopScan('connection_attempt');
    }
    
    // 检查是否已经有连接正在进行
    if (this.activeConnections.has(deviceAddress)) {
      const existingState = this.activeConnections.get(deviceAddress);
      if (existingState?.cancelled) {
        // 如果已存在的连接已被取消，清理状态并继续新的连接尝试
        this.activeConnections.delete(deviceAddress);
        console.log(`BluetoothManager: Found cancelled connection state for ${deviceAddress}, clearing and proceeding with new connection`);
        // 不返回，继续执行新的连接尝试
      } else {
        console.log(`BluetoothManager: Connection to ${deviceAddress} is already in progress, ignoring duplicate request`);
        return;
      }
    }
    
    try {
      // Check if device is already connected first
      const alreadyConnected = await this.isDeviceConnected(deviceAddress);
      
      if (alreadyConnected) {
        console.log(`BluetoothManager: Device ${deviceAddress} is already connected`);
        this.onConnectionStatusCallback?.(deviceAddress, 'connected');
        this.getPairedDevices(); // Refresh paired list
        cleanup();
        return;
      }
      
      // 创建可取消的连接 Promise
      const connectionState = { promise: null as any, cancelled: false };
      this.activeConnections.set(deviceAddress, connectionState);
      
      // Add a timeout wrapper for the connection attempt
      const connectionPromise = RNBClassic.connectToDevice(deviceAddress);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 20 seconds')), 20000)
      );
      
      // Add a cancellation promise that can be resolved when the connection is cancelled
      const cancellationPromise = new Promise<never>((_, reject) => {
        cancellationCheckInterval = setInterval(() => {
          // 检查连接状态是否已被删除（被取消）或者状态被标记为取消
          if (connectionState.cancelled || !this.activeConnections.has(deviceAddress)) {
            if (cancellationCheckInterval) {
              clearInterval(cancellationCheckInterval);
            }
            reject(new Error('Connection cancelled by user'));
          }
        }, 100); // Check every 100ms
      });
      
      // 将 promise 存储到状态中，包括取消检查
      connectionState.promise = Promise.race([connectionPromise, timeoutPromise, cancellationPromise]);
      
      // 检查是否已被取消
      if (connectionState.cancelled) {
        this.activeConnections.delete(deviceAddress);
        console.log(`BluetoothManager: Connection to ${deviceAddress} was cancelled before completion`);
        this.onConnectionStatusCallback?.(deviceAddress, 'error', new Error('Connection cancelled by user'));
        cleanup();
        return;
      }
      
      const connectedDevice = await connectionState.promise;
      console.log(`BluetoothManager: Successfully initiated connection to ${connectedDevice?.name || deviceAddress}`);
      
      // 清理取消检查定时器
      cleanup();
      
      // 清理连接状态
      this.activeConnections.delete(deviceAddress);
      
      // The global listener `onDeviceConnected` should fire.
      // If not, or for immediate feedback:
      this.onConnectionStatusCallback?.(deviceAddress, 'connected');
      this.getPairedDevices(); // Refresh paired list
    } catch (error) {
      // 清理取消检查定时器
      cleanup();
      
      // 清理连接状态
      this.activeConnections.delete(deviceAddress);
      
      const errorString = (error as Error).message || '';
      const errorName = (error as Error).name || '';
      const fullErrorText = `${errorName}: ${errorString}`;
      
      // 使用错误处理器记录错误
      BluetoothErrorHandler.logError(
        `BluetoothManager: Connection attempt for ${deviceAddress} (attempt ${retryCount + 1})`, 
        fullErrorText, 
        error
      );
      
      console.log(`BluetoothManager: Analyzing connection failure: "${fullErrorText.toLowerCase()}"`);
      
      // 检查错误代码和消息
      const errorCode = (error as any)?.code || '';
      const lowerErrorText = fullErrorText.toLowerCase();
      const isAlreadyConnecting = errorCode === 'ALREADY_CONNECTING' || 
                                  lowerErrorText.includes('already attempting connection');
      
      // 如果已经在连接中，需要等待底层连接完成或超时
      if (isAlreadyConnecting) {
        console.log(`BluetoothManager: Device ${deviceAddress} is already attempting connection at native level, waiting for completion...`);
        
        // 等待底层连接尝试完成（通常需要20-30秒超时）
        // 我们创建一个等待状态，监听连接完成或失败
        const waitForNativeConnectionState = { promise: null as any, cancelled: false };
        this.activeConnections.set(deviceAddress, waitForNativeConnectionState);
        
        try {
          // 等待最多30秒，期间监听连接状态变化
          await new Promise<void>((resolve, reject) => {
            const maxWaitTime = 30000; // 30秒
            const checkInterval = 1000; // 每秒检查一次
            let elapsedTime = 0;
            
            const checkConnection = async () => {
              // 检查是否被取消
              if (waitForNativeConnectionState.cancelled || !this.activeConnections.has(deviceAddress)) {
                console.log(`BluetoothManager: Wait for native connection was cancelled for ${deviceAddress}`);
                resolve();
                return;
              }
              
              elapsedTime += checkInterval;
              
              // 检查设备是否已连接
              try {
                const isConnected = await this.isDeviceConnected(deviceAddress);
                if (isConnected) {
                  console.log(`BluetoothManager: Native connection completed for ${deviceAddress}, device is now connected`);
                  this.onConnectionStatusCallback?.(deviceAddress, 'connected');
                  this.getPairedDevices();
                  resolve();
                  return;
                }
              } catch (error) {
                console.warn(`BluetoothManager: Error checking connection status for ${deviceAddress}:`, error);
              }
              
              // 检查是否超时
              if (elapsedTime >= maxWaitTime) {
                console.log(`BluetoothManager: Wait for native connection timed out for ${deviceAddress}, should be safe to retry now`);
                resolve();
                return;
              }
              
              // 继续等待
              setTimeout(checkConnection, checkInterval);
            };
            
            // 开始检查
            setTimeout(checkConnection, checkInterval);
          });
          
          // 清理等待状态
          this.activeConnections.delete(deviceAddress);
          
          // 如果设备仍未连接，可以尝试重新连接
          const isConnected = await this.isDeviceConnected(deviceAddress);
          if (!isConnected) {
            console.log(`BluetoothManager: After waiting, ${deviceAddress} is not connected, retrying connection...`);
            // 递归重试，但增加重试计数以避免无限循环
            if (retryCount < maxRetries) {
              return this.connect(deviceAddress, retryCount + 1);
            }
          }
          
        } catch (error) {
          this.activeConnections.delete(deviceAddress);
          console.warn(`BluetoothManager: Error while waiting for native connection to complete:`, error);
        }
        
        return;
      }
      
      // 使用错误处理器判断是否可重试
      const isRetryableError = BluetoothErrorHandler.isRetryableError(fullErrorText);
      
      // Retry logic for certain errors
      if (isRetryableError && retryCount < maxRetries) {
        console.log(`BluetoothManager: Retryable connection failure detected, waiting 2 seconds before retry ${retryCount + 2}/${maxRetries + 1}`);
        
        // 创建一个新的连接状态来跟踪重试期间的取消状态
        const retryConnectionState = { promise: null as any, cancelled: false };
        this.activeConnections.set(deviceAddress, retryConnectionState);
        
        // Wait a bit before retrying, but check for cancellation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查在等待期间是否被取消（检查状态或连接是否已被删除）
        if (retryConnectionState.cancelled || !this.activeConnections.has(deviceAddress)) {
          this.activeConnections.delete(deviceAddress);
          console.log(`BluetoothManager: Connection retry to ${deviceAddress} was cancelled during wait period`);
          this.onConnectionStatusCallback?.(deviceAddress, 'error', new Error('Connection cancelled by user'));
          return;
        }
        
        // 在重试前再次检查是否有活跃的连接状态被标记为取消或已被删除
        const currentConnectionState = this.activeConnections.get(deviceAddress);
        if (!currentConnectionState || currentConnectionState.cancelled) {
          this.activeConnections.delete(deviceAddress);
          console.log(`BluetoothManager: Connection retry to ${deviceAddress} was cancelled before retry attempt`);
          this.onConnectionStatusCallback?.(deviceAddress, 'error', new Error('Connection cancelled by user'));
          return;
        }
        
        // Try to clear any stale connections
        await this.clearStaleConnection(deviceAddress);
        
        // Recursive retry - 不显示中间重试的错误
        return this.connect(deviceAddress, retryCount + 1);
      }
      
      // 使用错误处理器获取用户友好的消息
      const userMessage = BluetoothErrorHandler.getUserFriendlyMessage(fullErrorText, retryCount);
      
      // 处理"已连接"的特殊情况
      if (lowerErrorText.includes('already connected')) {
        this.onConnectionStatusCallback?.(deviceAddress, 'connected');
        this.getPairedDevices();
        return;
      }
      
      console.log(`BluetoothManager: Connection failed with user message: ${userMessage}`);
      
      // 使用错误处理器判断是否显示Alert
      if (BluetoothErrorHandler.shouldShowAlert(fullErrorText, retryCount, maxRetries)) {
        Alert.alert('连接失败', userMessage);
      }
      
      this.onConnectionStatusCallback?.(deviceAddress, 'error', error as Error);
    }
  }

  // 取消正在进行的连接
  public cancelConnection(deviceAddress: string): void {
    console.log(`BluetoothManager: Cancelling connection for ${deviceAddress}`);
    
    const connectionState = this.activeConnections.get(deviceAddress);
    if (connectionState) {
      connectionState.cancelled = true;
      console.log(`BluetoothManager: Connection to ${deviceAddress} marked as cancelled`);
      
      // 立即删除连接状态，这样后续的连接尝试可以立即进行
      this.activeConnections.delete(deviceAddress);
      
      // 触发取消事件 - 不显示为错误，而是正常的取消操作
      this.onConnectionStatusCallback?.(deviceAddress, 'disconnected');
    } else {
      console.log(`BluetoothManager: No active connection found for ${deviceAddress} to cancel`);
      
      // 即使没有找到活跃连接，也要确保没有遗留的连接状态
      // 这处理了连接可能已经失败但重试逻辑尚未开始的情况
      this.activeConnections.delete(deviceAddress);
    }
  }

  public async disconnect(deviceAddress: string): Promise<void> {
    console.log(`BluetoothManager: Attempting to disconnect from ${deviceAddress}`);
    
    if (!deviceAddress || typeof deviceAddress !== 'string') {
      const errorMessage = 'Invalid device address provided for disconnection';
      console.warn('BluetoothManager: Disconnection validation failed:', errorMessage);
      Alert.alert('Disconnection Failed', errorMessage);
      this.onConnectionStatusCallback?.(deviceAddress || 'unknown', 'error', new Error(errorMessage));
      return;
    }
    
    try {
      // 创建可取消的断开连接状态
      const disconnectionState = { promise: null as any, cancelled: false };
      this.activeConnections.set(deviceAddress, disconnectionState);
      
      const device = await RNBClassic.getConnectedDevice(deviceAddress);
      if (device) {
        const disconnectPromise = device.disconnect();
        disconnectionState.promise = disconnectPromise;
        
        // 检查是否已被取消
        if (disconnectionState.cancelled) {
          this.activeConnections.delete(deviceAddress);
          console.log(`BluetoothManager: Disconnection from ${deviceAddress} was cancelled`);
          // 断开连接被取消，保持连接状态
          this.onConnectionStatusCallback?.(deviceAddress, 'connected');
          return;
        }
        
        await disconnectPromise;
        console.log(`BluetoothManager: Successfully initiated disconnection from ${device.name || deviceAddress}`);
        
        // 清理断开连接状态
        this.activeConnections.delete(deviceAddress);
        
        // Manually trigger the disconnection callback since the global listener might not fire
        this.onConnectionStatusCallback?.(deviceAddress, 'disconnected');
        this.getPairedDevices(); // Refresh paired devices
      } else {
        // 清理状态
        this.activeConnections.delete(deviceAddress);
        
        const warningMessage = `BluetoothManager: Device ${deviceAddress} not found or not connected. Cannot disconnect.`;
        console.warn(warningMessage);
        this.onConnectionStatusCallback?.(deviceAddress, 'error', new Error(warningMessage));
      }
    } catch (error) {
      // 清理断开连接状态
      this.activeConnections.delete(deviceAddress);
      
      console.warn(`BluetoothManager: Disconnection failed for ${deviceAddress}:`, error);
      Alert.alert('Disconnection Failed', `Could not disconnect from device: ${(error as Error).message}`);
      this.onConnectionStatusCallback?.(deviceAddress, 'error', error as Error);
    }
  }
  
  public isAdapterEnabled(): Promise<boolean> {
    return RNBClassic.isBluetoothEnabled();
  }

  public openBluetoothSettings(): void {
    RNBClassic.openBluetoothSettings();
  }


  public cleanup(): void {
    console.log('BluetoothManager: Cleaning up subscriptions...');
    if (this.deviceDiscoveredSubscription) {
      this.deviceDiscoveredSubscription.remove();
      this.deviceDiscoveredSubscription = null;
    }
    if (this.connectionSuccessSubscription) {
        this.connectionSuccessSubscription.remove();
        this.connectionSuccessSubscription = null;
    }
    if (this.connectionLostSubscription) {
        this.connectionLostSubscription.remove();
        this.connectionLostSubscription = null;
    }
    if (this.errorSubscription) {
        this.errorSubscription.remove();
        this.errorSubscription = null;
    }
    if (this.bluetoothEnabledSubscription) {
        this.bluetoothEnabledSubscription.remove();
        this.bluetoothEnabledSubscription = null;
    }
    if (this.bluetoothDisabledSubscription) {
        this.bluetoothDisabledSubscription.remove();
        this.bluetoothDisabledSubscription = null;
    }
    if (this.scanTimeoutRef) {
      clearTimeout(this.scanTimeoutRef);
      this.scanTimeoutRef = null;
    }
    this.isScanningRef = false;
    this.onScanStatusCallback?.(false);
    
    // 清理活跃连接
    this.activeConnections.clear();
    
    // Reset callbacks
    this.onDeviceDiscoveredCallback = null;
    this.onConnectionStatusCallback = null;
    this.onScanStatusCallback = null;
    this.onPairedDevicesCallback = null;
    this.onBluetoothStatusCallback = null;
  }
}

// Export a singleton instance
const bluetoothManager = new BluetoothManager();
export default bluetoothManager;
