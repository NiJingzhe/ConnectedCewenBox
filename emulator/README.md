# 蓝牙温度计模拟器

这是一个用Python实现的蓝牙温度计设备模拟器，用于模拟与手机APP的通信。

## 功能特性

- 完整实现通信协议
- 支持所有设备命令
- 模拟温度数据
- 实时时钟（RTC）功能
- 报警配置管理
- 温度日志记录

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行模拟器

```bash
python device_emulator.py
```

## 支持的命令

- PING：测试连接
- GET_TEMP：获取当前温度
- GET_RTC_DATE：获取RTC日期
- GET_RTC_TIME：获取RTC时间
- SET_RTC_DATE：设置RTC日期
- SET_RTC_TIME：设置RTC时间
- GET_ALARMS：获取报警配置
- SET_ALARMS：设置报警配置
- GET_LOG：获取温度日志

## 注意事项

1. 需要Python 3.7或更高版本
2. 需要系统支持蓝牙功能
3. 在macOS上运行需要管理员权限 