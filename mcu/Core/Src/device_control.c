#include "device_control.h"
#include "main.h"
#include "DS18B20.h"
#include "cmsis_os.h"
#include <string.h>

// 外部句柄
extern RTC_HandleTypeDef hrtc;
extern TIM_HandleTypeDef htim4;

// 全局变量
AlarmConfig g_alarm_configs[MAX_ALARMS];
TempLogEntry g_temp_log[MAX_LOG_ENTRIES];
uint32_t g_log_count = 0;
uint32_t g_log_write_index = 0;

static bool led_state = false;
static bool buzzer_state = false;
static uint32_t buzzer_end_time = 0;

// LED控制实现
void led_init(void) {
    // LED使用PWM控制，这里可以设置初始状态
    led_off();
}

void led_on(void) {
    // 使用TIM4 CH3 PWM输出控制LED
    HAL_TIM_PWM_Start(&htim4, TIM_CHANNEL_3);
    // 设置占空比为50%用于LED亮度控制
    __HAL_TIM_SET_COMPARE(&htim4, TIM_CHANNEL_3, htim4.Init.Period / 2);
    led_state = true;
}

void led_off(void) {
    HAL_TIM_PWM_Stop(&htim4, TIM_CHANNEL_3);
    led_state = false;
}

void led_toggle(void) {
    if (led_state) {
        led_off();
    } else {
        led_on();
    }
}

bool led_get_state(void) {
    return led_state;
}

// 蜂鸣器控制实现 (使用同一个PWM通道，但可以通过不同参数控制)
void buzzer_init(void) {
    buzzer_off();
}

void buzzer_on(void) {
    // 蜂鸣器需要更高频率的PWM信号
    HAL_TIM_PWM_Start(&htim4, TIM_CHANNEL_3);
    // 设置占空比为50%产生音频信号
    __HAL_TIM_SET_COMPARE(&htim4, TIM_CHANNEL_3, htim4.Init.Period / 2);
    buzzer_state = true;
}

void buzzer_off(void) {
    if (!led_state) { // 如果LED也不亮，才关闭PWM
        HAL_TIM_PWM_Stop(&htim4, TIM_CHANNEL_3);
    }
    buzzer_state = false;
    buzzer_end_time = 0;
}

void buzzer_beep(uint32_t duration_ms) {
    buzzer_on();
    buzzer_end_time = HAL_GetTick() + duration_ms;
}

bool buzzer_get_state(void) {
    // 检查定时蜂鸣是否结束
    if (buzzer_end_time > 0 && HAL_GetTick() >= buzzer_end_time) {
        buzzer_off();
    }
    return buzzer_state;
}

// 温度传感器实现
bool temperature_sensor_init(void) {
    return (DS18B20_Init() == 0);
}

float temperature_get_current(void) {
    if (!temperature_is_sensor_ok()) {
        return -999.0f; // 错误值
    }
    
    // 开始温度转换
    DS18B20_Start();
    
    // 等待转换完成（750ms）
    osDelay(750);
    
    // 读取温度
    short temp_raw = DS18B20_Get_Temp();
    if (temp_raw == -1000) {
        return -999.0f; // 读取失败
    }
    
    // 转换为浮点数（原始值是0.1°C单位）
    return (float)temp_raw / 10.0f;
}

bool temperature_is_sensor_ok(void) {
    return (DS18B20_Check() == 0);
}

// RTC功能实现
bool rtc_is_initialized(void) {
    // 简单检查RTC是否初始化
    return (hrtc.Instance != NULL);
}

bool rtc_get_date(RTCDate *date) {
    if (!rtc_is_initialized() || !date) {
        return false;
    }
    
    RTC_DateTypeDef rtc_date;
    if (HAL_RTC_GetDate(&hrtc, &rtc_date, RTC_FORMAT_BIN) != HAL_OK) {
        return false;
    }
    
    date->year = rtc_date.Year;
    date->month = rtc_date.Month;
    date->day = rtc_date.Date;
    date->weekday = rtc_date.WeekDay;
    
    return true;
}

bool rtc_set_date(const RTCDate *date) {
    if (!rtc_is_initialized() || !date) {
        return false;
    }
    
    // 参数验证
    if (date->year > 99 || date->month < 1 || date->month > 12 ||
        date->day < 1 || date->day > 31 || date->weekday < 1 || date->weekday > 7) {
        return false;
    }
    
    RTC_DateTypeDef rtc_date;
    rtc_date.Year = date->year;
    rtc_date.Month = date->month;
    rtc_date.Date = date->day;
    rtc_date.WeekDay = date->weekday;
    
    return (HAL_RTC_SetDate(&hrtc, &rtc_date, RTC_FORMAT_BIN) == HAL_OK);
}

bool rtc_get_time(RTCTime *time) {
    if (!rtc_is_initialized() || !time) {
        return false;
    }
    
    RTC_TimeTypeDef rtc_time;
    if (HAL_RTC_GetTime(&hrtc, &rtc_time, RTC_FORMAT_BIN) != HAL_OK) {
        return false;
    }
    
    time->hour = rtc_time.Hours;
    time->minute = rtc_time.Minutes;
    time->second = rtc_time.Seconds;
    
    return true;
}

bool rtc_set_time(const RTCTime *time) {
    if (!rtc_is_initialized() || !time) {
        return false;
    }
    
    // 参数验证
    if (time->hour > 23 || time->minute > 59 || time->second > 59) {
        return false;
    }
    
    RTC_TimeTypeDef rtc_time;
    rtc_time.Hours = time->hour;
    rtc_time.Minutes = time->minute;
    rtc_time.Seconds = time->second;
    
    return (HAL_RTC_SetTime(&hrtc, &rtc_time, RTC_FORMAT_BIN) == HAL_OK);
}

uint64_t rtc_get_timestamp(void) {
    if (!rtc_is_initialized()) {
        return 0;
    }
    
    RTCDate date;
    RTCTime time;
    
    if (!rtc_get_date(&date) || !rtc_get_time(&time)) {
        return 0;
    }
    
    // 简单的时间戳计算（从2000年开始）
    // 这里可以实现更精确的时间戳转换
    uint64_t timestamp = 0;
    
    // 年份转换（以2000年为基准）
    timestamp += (uint64_t)(date.year + 2000 - 2000) * 365 * 24 * 3600;
    
    // 月份转换（简化处理）
    const uint8_t days_in_month[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    for (uint8_t i = 1; i < date.month; i++) {
        timestamp += days_in_month[i - 1] * 24 * 3600;
    }
    
    // 日期转换
    timestamp += (date.day - 1) * 24 * 3600;
    
    // 时间转换
    timestamp += time.hour * 3600 + time.minute * 60 + time.second;
    
    return timestamp;
}

// 报警系统实现
void alarm_init(void) {
    // 初始化报警配置
    for (int i = 0; i < MAX_ALARMS; i++) {
        g_alarm_configs[i].id = i;
        g_alarm_configs[i].low_temp = -40.0f;   // 默认下限
        g_alarm_configs[i].high_temp = 80.0f;   // 默认上限
    }
}

void alarm_set_config(uint8_t alarm_id, float low_temp, float high_temp) {
    if (alarm_id < MAX_ALARMS) {
        g_alarm_configs[alarm_id].low_temp = low_temp;
        g_alarm_configs[alarm_id].high_temp = high_temp;
    }
}

void alarm_get_config(uint8_t alarm_id, AlarmConfig *config) {
    if (alarm_id < MAX_ALARMS && config) {
        *config = g_alarm_configs[alarm_id];
    }
}

void alarm_check_temperature(float temperature) {
    // 检查所有报警配置
    for (int i = 0; i < MAX_ALARMS; i++) {
        if (temperature < g_alarm_configs[i].low_temp || 
            temperature > g_alarm_configs[i].high_temp) {
            
            // 触发报警
            if (g_alarm_configs[i].id == 0) {
                // ID 0 = 蜂鸣器
                buzzer_beep(1000); // 蜂鸣1秒
            } else if (g_alarm_configs[i].id == 1) {
                // ID 1 = LED
                led_on();
            }
        }
    }
}

void alarm_reset_all(void) {
    led_off();
    buzzer_off();
}

// 温度日志系统实现
void temp_log_init(void) {
    g_log_count = 0;
    g_log_write_index = 0;
    memset(g_temp_log, 0, sizeof(g_temp_log));
}

void temp_log_add_entry(float temperature) {
    uint64_t timestamp = rtc_get_timestamp();
    
    // 添加日志条目
    g_temp_log[g_log_write_index].timestamp = timestamp;
    g_temp_log[g_log_write_index].temperature = temperature;
    
    // 更新索引
    g_log_write_index = (g_log_write_index + 1) % MAX_LOG_ENTRIES;
    
    // 更新计数
    if (g_log_count < MAX_LOG_ENTRIES) {
        g_log_count++;
    }
}

uint32_t temp_log_get_entries(uint64_t start_time, uint64_t end_time, 
                             TempLogEntry *entries, uint32_t max_entries) {
    if (!entries || max_entries == 0) {
        return 0;
    }
    
    uint32_t found_count = 0;
    uint32_t read_index = (g_log_write_index + MAX_LOG_ENTRIES - g_log_count) % MAX_LOG_ENTRIES;
    
    // 遍历所有日志条目
    for (uint32_t i = 0; i < g_log_count && found_count < max_entries; i++) {
        uint32_t current_index = (read_index + i) % MAX_LOG_ENTRIES;
        
        if (g_temp_log[current_index].timestamp >= start_time && 
            g_temp_log[current_index].timestamp <= end_time) {
            entries[found_count] = g_temp_log[current_index];
            found_count++;
        }
    }
    
    return found_count;
}

void temp_log_clear(void) {
    temp_log_init();
}
