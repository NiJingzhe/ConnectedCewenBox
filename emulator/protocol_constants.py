class ProtocolConstants:
    START_BYTES = bytes([0xAA, 0x55])
    END_BYTES = bytes([0x55, 0xAA])
    VERSION = 0x01
    
    class PacketTypes:
        HOST_REQUEST = 0x00
        HOST_RESPONSE = 0x01
        HOST_ERROR = 0x0F
        DEVICE_REQUEST = 0x10
        DEVICE_RESPONSE = 0x11
        DEVICE_ERROR = 0x1F
    
    class Commands:
        PING = b'ping'
        GET_TEMP = b'temp'
        GET_RTC_DATE = b'gdat'
        GET_RTC_TIME = b'gtim'
        SET_RTC_DATE = b'sdat'
        SET_RTC_TIME = b'stim'
        GET_ALARMS = b'galm'
        SET_ALARMS = b'salm'
        GET_LOG = b'glog'
    
    class StatusCodes:
        OK = 0x00
        INVALID_PARAM = 0x01
        NOT_INITIALIZED = 0x02
        SENSOR_ERROR = 0x03
        STORAGE_ERROR = 0x04
        INTERNAL_ERROR = 0xFF
    
    class ErrorCodes:
        CORRUPT = 0x01
        UNEXPECTED_RESPONSE = 0x02
        UNKNOWN_ERROR = 0xFF 