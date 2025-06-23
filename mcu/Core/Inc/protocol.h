#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// 协议版本
#define PROTOCOL_VERSION 0x02

// 数据包类型
#define PKT_TYPE_HOST_REQUEST  0x00
#define PKT_TYPE_HOST_RESPONSE 0x01
#define PKT_TYPE_HOST_ERROR    0x0F
#define PKT_TYPE_SLAVE_REQUEST 0x10  
#define PKT_TYPE_SLAVE_RESPONSE 0x11
#define PKT_TYPE_SLAVE_ERROR   0x1F

// 起始符和结束符
#define START_MARK_1 0xAA
#define START_MARK_2 0x55
#define END_MARK_1   0x55
#define END_MARK_2   0xAA

// 转义填充字节
#define ESCAPE_BYTE  0x00

// 最大数据包大小
#define MAX_PACKET_SIZE 512
#define MAX_DATA_SIZE   (MAX_PACKET_SIZE - 16) // 减去头部和尾部

// 错误码定义
#define ERROR_CODE_CORRUPT           0x01
#define ERROR_CODE_UNEXPECTED_RESP   0x02
#define ERROR_CODE_UNKNOWN           0xFF

// 状态码定义
#define STATUS_OK                0x00
#define STATUS_INVALID_PARAM     0x01
#define STATUS_NOT_INITIALIZED   0x02
#define STATUS_SENSOR_ERROR      0x03
#define STATUS_STORAGE_ERROR     0x04
#define STATUS_INTERNAL_ERROR    0xFF

// 指令定义
#define CMD_PING        "ping"
#define CMD_GET_TEMP    "temp"
#define CMD_GET_RTC_DATE "gdat"
#define CMD_GET_RTC_TIME "gtim"
#define CMD_SET_RTC_DATE "sdat"
#define CMD_SET_RTC_TIME "stim"
#define CMD_GET_ALARMS  "galm"
#define CMD_SET_ALARMS  "salm"
#define CMD_GET_LOG     "glog"
#define CMD_SET_LED     "sled"
#define CMD_RESET_LED   "rled"
#define CMD_SET_BUZZER  "sbzr"
#define CMD_RESET_BUZZER "rbzr"

// TLV标签定义
#define TAG_INSTRUCTION  "IN"
#define TAG_DATA         "DA"
#define TAG_STATUS       "ST"
#define TAG_ERROR_CODE   "EC"
#define TAG_ERROR_DESC   "ED"
#define TAG_TEMPERATURE  "T "  // 注意有空格
#define TAG_YEAR         "YY"
#define TAG_MONTH        "MM"
#define TAG_DAY          "DD"
#define TAG_WEEKDAY      "WK"
#define TAG_HOUR         "HH"
#define TAG_MINUTE       "MM"
#define TAG_SECOND       "SS"
#define TAG_ALARM_LIST   "AL"
#define TAG_ALARM_ITEM   "IT"
#define TAG_ALARM_ID     "ID"
#define TAG_ALARM_LOW    "L"
#define TAG_ALARM_HIGH   "H"
#define TAG_LOG_LIST     "LG"
#define TAG_TIMESTAMP    "TS"
#define TAG_TIME_START   "T1"
#define TAG_TIME_END     "T2"
#define TAG_MAX_COUNT    "MX"

// 数据包头结构（不包括起始符和结束符）
typedef struct {
    uint8_t version;      // 版本
    uint8_t type;         // 类别
    uint16_t packet_id;   // 数据包编号
    uint16_t response_id; // 响应编号
    uint16_t data_length; // 数据长度
} __attribute__((packed)) PacketHeader;

// TLV结构
typedef struct {
    char tag[2];      // 标签（2字节ASCII）
    uint16_t length;  // 长度
    uint8_t *value;   // 值指针
} TLVField;

// 报警配置结构
typedef struct {
    uint8_t id;       // 报警通道ID（0=蜂鸣器，1=LED）
    float low_temp;   // 下限温度
    float high_temp;  // 上限温度
} AlarmConfig;

// 温度日志条目
typedef struct {
    uint64_t timestamp;  // 时间戳（秒）
    float temperature;   // 温度值
} TempLogEntry;

// RTC日期结构
typedef struct {
    uint8_t year;     // 年（0-99）
    uint8_t month;    // 月（1-12）
    uint8_t day;      // 日（1-31）
    uint8_t weekday;  // 星期几（1-7）
} RTCDate;

// RTC时间结构
typedef struct {
    uint8_t hour;     // 时（0-23）
    uint8_t minute;   // 分（0-59）
    uint8_t second;   // 秒（0-59）
} RTCTime;

// 函数声明
uint32_t calculate_crc32(const uint8_t *data, size_t length);
int escape_data(const uint8_t *input, size_t input_len, uint8_t *output, size_t output_size);
int unescape_data(const uint8_t *input, size_t input_len, uint8_t *output, size_t output_size);
bool find_packet_boundaries(const uint8_t *buffer, size_t buffer_len, size_t *start_pos, size_t *end_pos);
int build_packet(uint8_t type, uint16_t packet_id, uint16_t response_id, 
                const uint8_t *data, uint16_t data_len, uint8_t *output, size_t output_size);
int parse_packet(const uint8_t *buffer, size_t buffer_len, PacketHeader *header, uint8_t *data, size_t data_size);

// TLV操作函数
int write_tlv_uint8(uint8_t *buffer, size_t buffer_size, const char *tag, uint8_t value);
int write_tlv_uint16(uint8_t *buffer, size_t buffer_size, const char *tag, uint16_t value);
int write_tlv_uint64(uint8_t *buffer, size_t buffer_size, const char *tag, uint64_t value);
int write_tlv_float32(uint8_t *buffer, size_t buffer_size, const char *tag, float value);
int write_tlv_string(uint8_t *buffer, size_t buffer_size, const char *tag, const char *str);
int write_tlv_raw(uint8_t *buffer, size_t buffer_size, const char *tag, const uint8_t *data, uint16_t length);

int read_tlv_uint8(const uint8_t *buffer, size_t buffer_size, const char *tag, uint8_t *value);
int read_tlv_uint16(const uint8_t *buffer, size_t buffer_size, const char *tag, uint16_t *value);
int read_tlv_uint64(const uint8_t *buffer, size_t buffer_size, const char *tag, uint64_t *value);
int read_tlv_float32(const uint8_t *buffer, size_t buffer_size, const char *tag, float *value);
int read_tlv_string(const uint8_t *buffer, size_t buffer_size, const char *tag, char *str, size_t str_size);
int read_tlv_raw(const uint8_t *buffer, size_t buffer_size, const char *tag, uint8_t *data, uint16_t *length);

#ifdef __cplusplus
}
#endif

#endif // PROTOCOL_H
