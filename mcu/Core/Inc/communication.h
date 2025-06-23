#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <stdint.h>
#include <stdbool.h>
#include "protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

// 通信缓冲区大小
#define COMM_RX_BUFFER_SIZE 1024
#define COMM_TX_BUFFER_SIZE 1024

// 通信状态
typedef enum {
    COMM_STATE_IDLE,
    COMM_STATE_RECEIVING,
    COMM_STATE_PROCESSING,
    COMM_STATE_TRANSMITTING
} CommState;

// 通信统计信息
typedef struct {
    uint32_t packets_received;
    uint32_t packets_sent;
    uint32_t crc_errors;
    uint32_t format_errors;
    uint32_t timeout_errors;
} CommStats;

// 初始化通信模块
void communication_init(void);

// 通信任务（在RTOS任务中调用）
void communication_task(void);

// UART接收完成回调
void communication_rx_complete_callback(void);

// UART发送完成回调
void communication_tx_complete_callback(void);

// UART错误回调
void communication_error_callback(void);

// 获取通信状态
CommState communication_get_state(void);

// 获取通信统计信息
void communication_get_stats(CommStats *stats);

// 重置通信统计信息
void communication_reset_stats(void);

// 发送错误响应
int send_error_response(uint16_t response_id, uint8_t error_code, const char *error_desc);

#ifdef __cplusplus
}
#endif

#endif // COMMUNICATION_H
