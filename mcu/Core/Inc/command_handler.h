#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <stdint.h>
#include <stdbool.h>
#include "protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

// 命令处理函数类型
typedef int (*CommandHandler)(const uint8_t *request_data, uint16_t request_len, 
                             uint8_t *response_data, uint16_t *response_len, 
                             uint8_t *status);

// 命令处理器结构
typedef struct {
    char command[5];              // 4字符命令 + 结束符
    CommandHandler handler;       // 处理函数
} CommandEntry;

// 初始化命令处理系统
void command_handler_init(void);

// 处理收到的命令数据包
int process_command_packet(const uint8_t *packet_data, uint16_t packet_len,
                          uint8_t *response_packet, uint16_t *response_len,
                          uint16_t response_id);

// 各个命令的处理函数
int handle_ping(const uint8_t *request_data, uint16_t request_len, 
               uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_get_temp(const uint8_t *request_data, uint16_t request_len, 
                   uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_get_rtc_date(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_get_rtc_time(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_set_rtc_date(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_set_rtc_time(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_get_alarms(const uint8_t *request_data, uint16_t request_len, 
                     uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_set_alarms(const uint8_t *request_data, uint16_t request_len, 
                     uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_get_log(const uint8_t *request_data, uint16_t request_len, 
                  uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_set_led(const uint8_t *request_data, uint16_t request_len, 
                  uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_reset_led(const uint8_t *request_data, uint16_t request_len, 
                    uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_set_buzzer(const uint8_t *request_data, uint16_t request_len, 
                     uint8_t *response_data, uint16_t *response_len, uint8_t *status);

int handle_reset_buzzer(const uint8_t *request_data, uint16_t request_len, 
                       uint8_t *response_data, uint16_t *response_len, uint8_t *status);

#ifdef __cplusplus
}
#endif

#endif // COMMAND_HANDLER_H
