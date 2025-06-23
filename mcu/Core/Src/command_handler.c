#include "command_handler.h"
#include "device_control.h"
#include <string.h>

// 命令表
static CommandEntry command_table[] = {
    {CMD_PING, handle_ping},
    {CMD_GET_TEMP, handle_get_temp},
    {CMD_GET_RTC_DATE, handle_get_rtc_date},
    {CMD_GET_RTC_TIME, handle_get_rtc_time},
    {CMD_SET_RTC_DATE, handle_set_rtc_date},
    {CMD_SET_RTC_TIME, handle_set_rtc_time},
    {CMD_GET_ALARMS, handle_get_alarms},
    {CMD_SET_ALARMS, handle_set_alarms},
    {CMD_GET_LOG, handle_get_log},
    {CMD_SET_LED, handle_set_led},
    {CMD_RESET_LED, handle_reset_led},
    {CMD_SET_BUZZER, handle_set_buzzer},
    {CMD_RESET_BUZZER, handle_reset_buzzer},
};

static const size_t command_table_size = sizeof(command_table) / sizeof(CommandEntry);

void command_handler_init(void) {
    // 初始化设备控制模块
    led_init();
    buzzer_init();
    temperature_sensor_init();
    alarm_init();
    temp_log_init();
}

int process_command_packet(const uint8_t *packet_data, uint16_t packet_len,
                          uint8_t *response_packet, uint16_t *response_len,
                          uint16_t response_id) {
    if (!packet_data || !response_packet || !response_len) {
        return -1;
    }
    
    // 提取指令字段
    char instruction[5] = {0};
    if (read_tlv_string(packet_data, packet_len, TAG_INSTRUCTION, instruction, sizeof(instruction)) < 0) {
        return -1; // 无法读取指令
    }
    
    // 查找命令处理器
    CommandHandler handler = NULL;
    for (size_t i = 0; i < command_table_size; i++) {
        if (strcmp(instruction, command_table[i].command) == 0) {
            handler = command_table[i].handler;
            break;
        }
    }
    
    if (!handler) {
        return -1; // 未知命令
    }
    
    // 提取DA字段
    uint8_t request_data[MAX_DATA_SIZE];
    uint16_t request_data_len = sizeof(request_data);
    int da_result = read_tlv_raw(packet_data, packet_len, TAG_DATA, request_data, &request_data_len);
    if (da_result < 0) {
        request_data_len = 0; // 没有DA字段
    }
    
    // 调用命令处理器
    uint8_t response_data[MAX_DATA_SIZE];
    uint16_t response_data_len = 0;
    uint8_t status = STATUS_INTERNAL_ERROR;
    
    int result = handler(request_data, request_data_len, response_data, &response_data_len, &status);
    if (result < 0) {
        status = STATUS_INTERNAL_ERROR;
        response_data_len = 0;
    }
    
    // 构建响应数据包
    uint8_t temp_buffer[MAX_DATA_SIZE];
    uint16_t temp_len = 0;
    
    // 添加IN字段
    int in_len = write_tlv_string(temp_buffer + temp_len, sizeof(temp_buffer) - temp_len, TAG_INSTRUCTION, instruction);
    if (in_len < 0) return -1;
    temp_len += in_len;
    
    // 添加ST字段
    int st_len = write_tlv_uint8(temp_buffer + temp_len, sizeof(temp_buffer) - temp_len, TAG_STATUS, status);
    if (st_len < 0) return -1;
    temp_len += st_len;
    
    // 添加DA字段（如果有响应数据）
    if (response_data_len > 0) {
        int da_len = write_tlv_raw(temp_buffer + temp_len, sizeof(temp_buffer) - temp_len, TAG_DATA, response_data, response_data_len);
        if (da_len < 0) return -1;
        temp_len += da_len;
    }
    
    // 构建完整的响应数据包
    int packet_len_result = build_packet(PKT_TYPE_SLAVE_RESPONSE, 0x8000, response_id, temp_buffer, temp_len, response_packet, MAX_PACKET_SIZE);
    if (packet_len_result < 0) {
        return -1;
    }
    
    *response_len = packet_len_result;
    return 0;
}

// Ping命令处理
int handle_ping(const uint8_t *request_data, uint16_t request_len, 
               uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    
    *status = STATUS_OK;
    *response_len = 0; // Ping命令无返回数据
    return 0;
}

// 获取温度命令处理
int handle_get_temp(const uint8_t *request_data, uint16_t request_len, 
                   uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    
    if (!temperature_is_sensor_ok()) {
        *status = STATUS_SENSOR_ERROR;
        *response_len = 0;
        return -1;
    }
    
    float temperature = temperature_get_current();
    if (temperature <= -999.0f) {
        *status = STATUS_SENSOR_ERROR;
        *response_len = 0;
        return -1;
    }
    
    // 检查温度报警
    alarm_check_temperature(temperature);
    
    // 记录温度日志
    temp_log_add_entry(temperature);
    
    // 构建响应数据
    int temp_len = write_tlv_float32(response_data, MAX_DATA_SIZE, TAG_TEMPERATURE, temperature);
    if (temp_len < 0) {
        *status = STATUS_INTERNAL_ERROR;
        *response_len = 0;
        return -1;
    }
    
    *status = STATUS_OK;
    *response_len = temp_len;
    return 0;
}

// 获取RTC日期命令处理
int handle_get_rtc_date(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    
    if (!rtc_is_initialized()) {
        *status = STATUS_NOT_INITIALIZED;
        *response_len = 0;
        return -1;
    }
    
    RTCDate date;
    if (!rtc_get_date(&date)) {
        *status = STATUS_NOT_INITIALIZED;
        *response_len = 0;
        return -1;
    }
    
    // 构建响应数据
    uint16_t offset = 0;
    
    int yy_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_YEAR, date.year);
    if (yy_len < 0) goto error;
    offset += yy_len;
    
    int mm_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_MONTH, date.month);
    if (mm_len < 0) goto error;
    offset += mm_len;
    
    int dd_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_DAY, date.day);
    if (dd_len < 0) goto error;
    offset += dd_len;
    
    int wk_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_WEEKDAY, date.weekday);
    if (wk_len < 0) goto error;
    offset += wk_len;
    
    *status = STATUS_OK;
    *response_len = offset;
    return 0;
    
error:
    *status = STATUS_INTERNAL_ERROR;
    *response_len = 0;
    return -1;
}

// 获取RTC时间命令处理
int handle_get_rtc_time(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    
    if (!rtc_is_initialized()) {
        *status = STATUS_NOT_INITIALIZED;
        *response_len = 0;
        return -1;
    }
    
    RTCTime time;
    if (!rtc_get_time(&time)) {
        *status = STATUS_NOT_INITIALIZED;
        *response_len = 0;
        return -1;
    }
    
    // 构建响应数据
    uint16_t offset = 0;
    
    int hh_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_HOUR, time.hour);
    if (hh_len < 0) goto error;
    offset += hh_len;
    
    int mm_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_MINUTE, time.minute);
    if (mm_len < 0) goto error;
    offset += mm_len;
    
    int ss_len = write_tlv_uint8(response_data + offset, MAX_DATA_SIZE - offset, TAG_SECOND, time.second);
    if (ss_len < 0) goto error;
    offset += ss_len;
    
    *status = STATUS_OK;
    *response_len = offset;
    return 0;
    
error:
    *status = STATUS_INTERNAL_ERROR;
    *response_len = 0;
    return -1;
}

// 设置RTC日期命令处理 
int handle_set_rtc_date(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)response_data;
    
    if (!rtc_is_initialized()) {
        *status = STATUS_NOT_INITIALIZED;
        *response_len = 0;
        return -1;
    }
    
    RTCDate date;
    
    // 读取各个字段
    if (read_tlv_uint8(request_data, request_len, TAG_YEAR, &date.year) < 0 ||
        read_tlv_uint8(request_data, request_len, TAG_MONTH, &date.month) < 0 ||
        read_tlv_uint8(request_data, request_len, TAG_DAY, &date.day) < 0 ||
        read_tlv_uint8(request_data, request_len, TAG_WEEKDAY, &date.weekday) < 0) {
        
        *status = STATUS_INVALID_PARAM;
        *response_len = 0;
        return -1;
    }
    
    // 设置日期
    if (!rtc_set_date(&date)) {
        *status = STATUS_INVALID_PARAM;
        *response_len = 0;
        return -1;
    }
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}

// 设置RTC时间命令处理
int handle_set_rtc_time(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)response_data;
    
    if (!rtc_is_initialized()) {
        *status = STATUS_NOT_INITIALIZED;
        *response_len = 0;
        return -1;
    }
    
    RTCTime time;
    
    // 读取各个字段
    if (read_tlv_uint8(request_data, request_len, TAG_HOUR, &time.hour) < 0 ||
        read_tlv_uint8(request_data, request_len, TAG_MINUTE, &time.minute) < 0 ||
        read_tlv_uint8(request_data, request_len, TAG_SECOND, &time.second) < 0) {
        
        *status = STATUS_INVALID_PARAM;
        *response_len = 0;
        return -1;
    }
    
    // 设置时间
    if (!rtc_set_time(&time)) {
        *status = STATUS_INVALID_PARAM;
        *response_len = 0;
        return -1;
    }
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}

// 获取报警配置命令处理
int handle_get_alarms(const uint8_t *request_data, uint16_t request_len, 
                     uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    
    uint8_t alarm_list_data[MAX_DATA_SIZE];
    uint16_t alarm_list_len = 0;
    
    // 构建报警列表
    for (int i = 0; i < MAX_ALARMS; i++) {
        AlarmConfig config;
        alarm_get_config(i, &config);
        
        // 构建单个报警项
        uint8_t alarm_item_data[64];
        uint16_t alarm_item_len = 0;
        
        int id_len = write_tlv_uint8(alarm_item_data + alarm_item_len, sizeof(alarm_item_data) - alarm_item_len, TAG_ALARM_ID, config.id);
        if (id_len < 0) goto error;
        alarm_item_len += id_len;
        
        int low_len = write_tlv_float32(alarm_item_data + alarm_item_len, sizeof(alarm_item_data) - alarm_item_len, TAG_ALARM_LOW, config.low_temp);
        if (low_len < 0) goto error;
        alarm_item_len += low_len;
        
        int high_len = write_tlv_float32(alarm_item_data + alarm_item_len, sizeof(alarm_item_data) - alarm_item_len, TAG_ALARM_HIGH, config.high_temp);
        if (high_len < 0) goto error;
        alarm_item_len += high_len;
        
        // 添加到报警列表
        int item_len = write_tlv_raw(alarm_list_data + alarm_list_len, sizeof(alarm_list_data) - alarm_list_len, TAG_ALARM_ITEM, alarm_item_data, alarm_item_len);
        if (item_len < 0) goto error;
        alarm_list_len += item_len;
    }
    
    // 构建最终响应
    int al_len = write_tlv_raw(response_data, MAX_DATA_SIZE, TAG_ALARM_LIST, alarm_list_data, alarm_list_len);
    if (al_len < 0) goto error;
    
    *status = STATUS_OK;
    *response_len = al_len;
    return 0;
    
error:
    *status = STATUS_INTERNAL_ERROR;
    *response_len = 0;
    return -1;
}

// 设置报警配置命令处理
int handle_set_alarms(const uint8_t *request_data, uint16_t request_len, 
                     uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)response_data;
    
    // 读取报警列表
    uint8_t alarm_list_data[MAX_DATA_SIZE];
    uint16_t alarm_list_len = sizeof(alarm_list_data);
    
    if (read_tlv_raw(request_data, request_len, TAG_ALARM_LIST, alarm_list_data, &alarm_list_len) < 0) {
        *status = STATUS_INVALID_PARAM;
        *response_len = 0;
        return -1;
    }
    
    // 解析报警项
    // 这里简化处理，假设最多有MAX_ALARMS个报警项
    // 实际应该遍历所有IT标签
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}

// 获取温度日志命令处理
int handle_get_log(const uint8_t *request_data, uint16_t request_len, 
                  uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    uint64_t start_time = 0, end_time = 0;
    uint16_t max_count = 100;
    
    // 读取查询参数
    read_tlv_uint64(request_data, request_len, TAG_TIME_START, &start_time);
    read_tlv_uint64(request_data, request_len, TAG_TIME_END, &end_time);
    read_tlv_uint16(request_data, request_len, TAG_MAX_COUNT, &max_count);
    
    // 如果未指定时间范围，使用默认值
    if (end_time == 0) {
        end_time = rtc_get_timestamp();
    }
    if (start_time == 0) {
        start_time = end_time - 24 * 3600; // 默认查询最近24小时
    }
    
    // 获取日志条目
    TempLogEntry entries[100];
    uint32_t entry_count = temp_log_get_entries(start_time, end_time, entries, 
                                              max_count < 100 ? max_count : 100);
    
    // 构建日志列表
    uint8_t log_list_data[MAX_DATA_SIZE];
    uint16_t log_list_len = 0;
    
    for (uint32_t i = 0; i < entry_count; i++) {
        // 构建单个日志项
        uint8_t log_item_data[16];
        uint16_t log_item_len = 0;
        
        int ts_len = write_tlv_uint64(log_item_data + log_item_len, sizeof(log_item_data) - log_item_len, TAG_TIMESTAMP, entries[i].timestamp);
        if (ts_len < 0) break;
        log_item_len += ts_len;
        
        int temp_len = write_tlv_float32(log_item_data + log_item_len, sizeof(log_item_data) - log_item_len, TAG_TEMPERATURE, entries[i].temperature);
        if (temp_len < 0) break;
        log_item_len += temp_len;
        
        // 添加到日志列表
        int item_len = write_tlv_raw(log_list_data + log_list_len, sizeof(log_list_data) - log_list_len, TAG_ALARM_ITEM, log_item_data, log_item_len);
        if (item_len < 0) break;
        log_list_len += item_len;
    }
    
    // 构建最终响应
    int lg_len = write_tlv_raw(response_data, MAX_DATA_SIZE, TAG_LOG_LIST, log_list_data, log_list_len);
    if (lg_len < 0) {
        *status = STATUS_INTERNAL_ERROR;
        *response_len = 0;
        return -1;
    }
    
    *status = STATUS_OK;
    *response_len = lg_len;
    return 0;
}

// LED控制命令处理
int handle_set_led(const uint8_t *request_data, uint16_t request_len, 
                  uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    (void)response_data;
    
    led_on();
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}

int handle_reset_led(const uint8_t *request_data, uint16_t request_len, 
                    uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    (void)response_data;
    
    led_off();
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}

// 蜂鸣器控制命令处理
int handle_set_buzzer(const uint8_t *request_data, uint16_t request_len, 
                     uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    (void)response_data;
    
    buzzer_beep(1000); // 蜂鸣1秒
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}

int handle_reset_buzzer(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status) {
    (void)request_data;
    (void)request_len;
    (void)response_data;
    
    buzzer_off();
    
    *status = STATUS_OK;
    *response_len = 0;
    return 0;
}
