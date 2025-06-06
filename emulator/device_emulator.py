import asyncio
import random
from datetime import datetime
from bleak import BleakServer
from bleak.backends.characteristic import BleakGATTCharacteristic
from protocol_constants import ProtocolConstants as PC
from protocol_service import ProtocolService

class DeviceEmulator:
    def __init__(self):
        self.protocol_service = ProtocolService()
        self.temperature = 25.0  # 初始温度
        self.rtc_offset = 0  # RTC时间偏移
        self.alarms = [
            {'id': 0, 'lowTemp': 10.0, 'highTemp': 30.0},  # 蜂鸣器
            {'id': 1, 'lowTemp': 15.0, 'highTemp': 35.0}   # LED
        ]
        self.temperature_logs = []
        
    async def handle_read(self, characteristic: BleakGATTCharacteristic) -> bytearray:
        # 处理读取请求
        return bytearray([0x00])  # 默认返回

    async def handle_write(self, characteristic: BleakGATTCharacteristic, data: bytearray) -> None:
        try:
            # 解析请求
            command, params = self.protocol_service.parse_request(bytes(data))
            
            # 处理不同类型的命令
            if command == PC.Commands.PING:
                response = self.handle_ping()
            elif command == PC.Commands.GET_TEMP:
                response = self.handle_get_temp()
            elif command == PC.Commands.GET_RTC_DATE:
                response = self.handle_get_rtc_date()
            elif command == PC.Commands.GET_RTC_TIME:
                response = self.handle_get_rtc_time()
            elif command == PC.Commands.SET_RTC_DATE:
                response = self.handle_set_rtc_date(params)
            elif command == PC.Commands.SET_RTC_TIME:
                response = self.handle_set_rtc_time(params)
            elif command == PC.Commands.GET_ALARMS:
                response = self.handle_get_alarms()
            elif command == PC.Commands.SET_ALARMS:
                response = self.handle_set_alarms(params)
            elif command == PC.Commands.GET_LOG:
                response = self.handle_get_log(params)
            else:
                response = self.protocol_service.create_response(
                    command,
                    PC.StatusCodes.INVALID_PARAM,
                    {'ED': '未知命令'}
                )
            
            # 发送响应
            await characteristic.service.server.send_notification(
                characteristic.handle,
                response
            )
            
        except Exception as e:
            print(f"处理请求时出错: {str(e)}")
            # 发送错误响应
            error_response = self.protocol_service.create_response(
                PC.Commands.PING,  # 使用默认命令
                PC.StatusCodes.INTERNAL_ERROR,
                {'ED': str(e)}
            )
            await characteristic.service.server.send_notification(
                characteristic.handle,
                error_response
            )

    def handle_ping(self) -> bytes:
        return self.protocol_service.create_response(
            PC.Commands.PING,
            PC.StatusCodes.OK
        )

    def handle_get_temp(self) -> bytes:
        # 模拟温度波动
        self.temperature += random.uniform(-0.1, 0.1)
        return self.protocol_service.create_response(
            PC.Commands.GET_TEMP,
            PC.StatusCodes.OK,
            {'T ': self.temperature}
        )

    def handle_get_rtc_date(self) -> bytes:
        now = datetime.now()
        return self.protocol_service.create_response(
            PC.Commands.GET_RTC_DATE,
            PC.StatusCodes.OK,
            {
                'YY': now.year % 100,
                'MM': now.month,
                'DD': now.day,
                'WK': now.isoweekday()
            }
        )

    def handle_get_rtc_time(self) -> bytes:
        now = datetime.now()
        return self.protocol_service.create_response(
            PC.Commands.GET_RTC_TIME,
            PC.StatusCodes.OK,
            {
                'HH': now.hour,
                'MM': now.minute,
                'SS': now.second
            }
        )

    def handle_set_rtc_date(self, params: dict) -> bytes:
        # 验证参数
        required = ['YY', 'MM', 'DD', 'WK']
        if not all(key in params for key in required):
            return self.protocol_service.create_response(
                PC.Commands.SET_RTC_DATE,
                PC.StatusCodes.INVALID_PARAM,
                {'ED': '缺少必要参数'}
            )
        
        # 这里可以添加日期验证逻辑
        return self.protocol_service.create_response(
            PC.Commands.SET_RTC_DATE,
            PC.StatusCodes.OK
        )

    def handle_set_rtc_time(self, params: dict) -> bytes:
        # 验证参数
        required = ['HH', 'MM', 'SS']
        if not all(key in params for key in required):
            return self.protocol_service.create_response(
                PC.Commands.SET_RTC_TIME,
                PC.StatusCodes.INVALID_PARAM,
                {'ED': '缺少必要参数'}
            )
        
        # 这里可以添加时间验证逻辑
        return self.protocol_service.create_response(
            PC.Commands.SET_RTC_TIME,
            PC.StatusCodes.OK
        )

    def handle_get_alarms(self) -> bytes:
        alarm_data = []
        for alarm in self.alarms:
            alarm_data.append([
                {'tag': 'ID', 'value': alarm['id']},
                {'tag': 'L ', 'value': alarm['lowTemp']},
                {'tag': 'H ', 'value': alarm['highTemp']}
            ])
        
        return self.protocol_service.create_response(
            PC.Commands.GET_ALARMS,
            PC.StatusCodes.OK,
            {'AL': alarm_data}
        )

    def handle_set_alarms(self, params: dict) -> bytes:
        if 'AL' not in params:
            return self.protocol_service.create_response(
                PC.Commands.SET_ALARMS,
                PC.StatusCodes.INVALID_PARAM,
                {'ED': '缺少报警配置'}
            )
        
        # 更新报警配置
        new_alarms = []
        for alarm_data in params['AL']:
            alarm = {}
            for tag, value in alarm_data:
                if tag == 'ID':
                    alarm['id'] = value
                elif tag == 'L ':
                    alarm['lowTemp'] = value
                elif tag == 'H ':
                    alarm['highTemp'] = value
            new_alarms.append(alarm)
        
        self.alarms = new_alarms
        return self.protocol_service.create_response(
            PC.Commands.SET_ALARMS,
            PC.StatusCodes.OK
        )

    def handle_get_log(self, params: dict) -> bytes:
        if 'TS1' not in params or 'TS2' not in params:
            return self.protocol_service.create_response(
                PC.Commands.GET_LOG,
                PC.StatusCodes.INVALID_PARAM,
                {'ED': '缺少时间范围参数'}
            )
        
        start_time = params['TS1']
        end_time = params['TS2']
        max_count = params.get('MX', 100)
        
        # 生成模拟日志数据
        logs = []
        current_time = start_time
        while current_time <= end_time and len(logs) < max_count:
            temp = 25.0 + random.uniform(-5, 5)
            logs.append([
                {'tag': 'TS', 'value': current_time},
                {'tag': 'T ', 'value': temp}
            ])
            current_time += 300  # 每5分钟一条记录
        
        return self.protocol_service.create_response(
            PC.Commands.GET_LOG,
            PC.StatusCodes.OK,
            {'LG': logs}
        )

async def main():
    # 创建模拟器实例
    emulator = DeviceEmulator()
    
    # 创建BLE服务器
    server = BleakServer()
    
    # 添加服务和特征
    service = await server.add_service("180F")  # 使用标准电池服务UUID
    characteristic = await service.add_characteristic(
        "2A19",  # 使用标准电池电量特征UUID
        read=True,
        write=True,
        notify=True
    )
    
    # 设置处理函数
    characteristic.read_func = emulator.handle_read
    characteristic.write_func = emulator.handle_write
    
    # 启动服务器
    await server.start()
    print("模拟器已启动，等待连接...")
    
    try:
        await asyncio.get_event_loop().create_future()  # 保持运行
    except KeyboardInterrupt:
        print("\n正在关闭模拟器...")
    finally:
        await server.stop()

if __name__ == "__main__":
    asyncio.run(main()) 