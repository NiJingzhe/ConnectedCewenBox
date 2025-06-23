#ifndef DEVICE_CONTROL_H
#define DEVICE_CONTROL_H

#include <stdint.h>
#include <stdbool.h>
#include "protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

// LED控制
void led_init(void);
void led_on(void);
void led_off(void);
void led_toggle(void);
bool led_get_state(void);

// 蜂鸣器控制
void buzzer_init(void);
void buzzer_on(void);
void buzzer_off(void);
void buzzer_beep(uint32_t duration_ms);
bool buzzer_get_state(void);

// 温度传感器
float temperature_get_current(void);
bool temperature_sensor_init(void);
bool temperature_is_sensor_ok(void);

// RTC功能
bool rtc_get_date(RTCDate *date);
bool rtc_set_date(const RTCDate *date);
bool rtc_get_time(RTCTime *time);
bool rtc_set_time(const RTCTime *time);
bool rtc_is_initialized(void);
uint64_t rtc_get_timestamp(void);

// 报警系统
#define MAX_ALARMS 2
extern AlarmConfig g_alarm_configs[MAX_ALARMS];

void alarm_init(void);
void alarm_set_config(uint8_t alarm_id, float low_temp, float high_temp);
void alarm_get_config(uint8_t alarm_id, AlarmConfig *config);
void alarm_check_temperature(float temperature);
void alarm_reset_all(void);

// 温度日志系统
#define MAX_LOG_ENTRIES 100
extern TempLogEntry g_temp_log[MAX_LOG_ENTRIES];
extern uint32_t g_log_count;
extern uint32_t g_log_write_index;

void temp_log_init(void);
void temp_log_add_entry(float temperature);
uint32_t temp_log_get_entries(uint64_t start_time, uint64_t end_time, 
                             TempLogEntry *entries, uint32_t max_entries);
void temp_log_clear(void);

#ifdef __cplusplus
}
#endif

#endif // DEVICE_CONTROL_H
