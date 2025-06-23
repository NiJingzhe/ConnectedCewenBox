#include "communication.h"
#include "command_handler.h"
#include "main.h"
#include "cmsis_os.h"
#include <string.h>

// 外部UART句柄
extern UART_HandleTypeDef huart1;

// 通信状态和缓冲区
static CommState comm_state = COMM_STATE_IDLE;
static CommStats comm_stats = {0};

static uint8_t rx_buffer[COMM_RX_BUFFER_SIZE];
static uint8_t tx_buffer[COMM_TX_BUFFER_SIZE];
static volatile uint16_t rx_buffer_pos = 0;
static volatile bool rx_complete = false;
static volatile bool tx_complete = true;

// 数据包ID计数器
static uint16_t packet_id_counter = 0x8000; // 从机数据包ID从0x8000开始

// 函数声明
static void start_uart_receive(void);
static int process_received_data(void);
static void send_response_packet(const uint8_t *packet, uint16_t length);

void communication_init(void) {
    // 初始化通信状态
    comm_state = COMM_STATE_IDLE;
    memset(&comm_stats, 0, sizeof(comm_stats));
    
    rx_buffer_pos = 0;
    rx_complete = false;
    tx_complete = true;
    
    // 初始化命令处理器
    command_handler_init();
    
    // 开始第一次接收
    start_uart_receive();
}

void communication_task(void) {
    // 检查接收完成
    if (rx_complete) {
        rx_complete = false;
        comm_state = COMM_STATE_PROCESSING;
        
        // 处理接收到的数据
        int result = process_received_data();
        if (result < 0) {
            comm_stats.format_errors++;
        }
        
        // 重新开始接收
        start_uart_receive();
        comm_state = COMM_STATE_IDLE;
    }
    
    // 其他处理逻辑...
}

static void start_uart_receive(void) {
    if (comm_state == COMM_STATE_IDLE) {
        comm_state = COMM_STATE_RECEIVING;
        rx_buffer_pos = 0;
        
        // 使用DMA接收单个字节
        HAL_UART_Receive_DMA(&huart1, rx_buffer, 1);
    }
}

static int process_received_data(void) {
    if (rx_buffer_pos < 4) { // 最小数据包长度检查
        return -1;
    }
    
    // 查找完整的数据包
    size_t start_pos, end_pos;
    if (!find_packet_boundaries(rx_buffer, rx_buffer_pos, &start_pos, &end_pos)) {
        return -1; // 没有找到完整数据包
    }
    
    // 解析数据包
    PacketHeader header;
    uint8_t packet_data[MAX_DATA_SIZE];
    
    int data_len = parse_packet(rx_buffer, rx_buffer_pos, &header, packet_data, sizeof(packet_data));
    if (data_len < 0) {
        comm_stats.crc_errors++;
        
        // 发送错误响应
        send_error_response(header.packet_id, ERROR_CODE_CORRUPT, "Packet corrupted");
        return -1;
    }
    
    comm_stats.packets_received++;
    
    // 检查数据包类型
    if (header.type != PKT_TYPE_HOST_REQUEST) {
        // 发送错误响应
        send_error_response(header.packet_id, ERROR_CODE_UNEXPECTED_RESP, "Unexpected packet type");
        return -1;
    }
    
    // 处理命令
    uint8_t response_packet[MAX_PACKET_SIZE];
    uint16_t response_len = 0;
    
    int cmd_result = process_command_packet(packet_data, data_len, response_packet, &response_len, header.packet_id);
    if (cmd_result < 0) {
        // 发送错误响应
        send_error_response(header.packet_id, ERROR_CODE_UNKNOWN, "Command processing failed");
        return -1;
    }
    
    // 发送响应
    send_response_packet(response_packet, response_len);
    
    return 0;
}

static void send_response_packet(const uint8_t *packet, uint16_t length) {
    if (!tx_complete || length > sizeof(tx_buffer)) {
        return;
    }
    
    // 复制数据到发送缓冲区
    memcpy(tx_buffer, packet, length);
    
    // 开始发送
    tx_complete = false;
    comm_state = COMM_STATE_TRANSMITTING;
    
    HAL_UART_Transmit_DMA(&huart1, tx_buffer, length);
}

int send_error_response(uint16_t response_id, uint8_t error_code, const char *error_desc) {
    uint8_t error_data[256];
    uint16_t error_data_len = 0;
    
    // 构建错误数据
    int ec_len = write_tlv_uint8(error_data + error_data_len, sizeof(error_data) - error_data_len, TAG_ERROR_CODE, error_code);
    if (ec_len < 0) return -1;
    error_data_len += ec_len;
    
    if (error_desc && strlen(error_desc) > 0) {
        int ed_len = write_tlv_string(error_data + error_data_len, sizeof(error_data) - error_data_len, TAG_ERROR_DESC, error_desc);
        if (ed_len < 0) return -1;
        error_data_len += ed_len;
    }
    
    // 构建错误数据包
    uint8_t error_packet[MAX_PACKET_SIZE];
    int packet_len = build_packet(PKT_TYPE_SLAVE_ERROR, packet_id_counter++, response_id, error_data, error_data_len, error_packet, sizeof(error_packet));
    if (packet_len < 0) {
        return -1;
    }
    
    // 发送错误响应
    send_response_packet(error_packet, packet_len);
    
    return 0;
}

// UART回调函数
void communication_rx_complete_callback(void) {
    // 检查是否接收到起始符
    if (rx_buffer_pos == 0 && rx_buffer[0] == START_MARK_1) {
        rx_buffer_pos = 1;
        HAL_UART_Receive_DMA(&huart1, &rx_buffer[1], 1);
        return;
    }
    
    if (rx_buffer_pos == 1 && rx_buffer[1] == START_MARK_2) {
        rx_buffer_pos = 2;
        HAL_UART_Receive_DMA(&huart1, &rx_buffer[2], 1);
        return;
    }
    
    // 继续接收数据
    if (rx_buffer_pos >= 2) {
        rx_buffer_pos++;
        
        // 检查是否接收到结束符
        if (rx_buffer_pos >= 4 && 
            rx_buffer[rx_buffer_pos - 2] == END_MARK_1 && 
            rx_buffer[rx_buffer_pos - 1] == END_MARK_2) {
            
            // 检查这不是转义序列
            bool is_escaped = false;
            if (rx_buffer_pos > 4) {
                // 简化的转义检查
                if (rx_buffer[rx_buffer_pos - 3] == ESCAPE_BYTE) {
                    is_escaped = true;
                }
            }
            
            if (!is_escaped) {
                // 接收完成
                rx_complete = true;
                return;
            }
        }
        
        // 继续接收下一个字节
        if (rx_buffer_pos < COMM_RX_BUFFER_SIZE) {
            HAL_UART_Receive_DMA(&huart1, &rx_buffer[rx_buffer_pos], 1);
        } else {
            // 缓冲区溢出，重新开始
            rx_buffer_pos = 0;
            HAL_UART_Receive_DMA(&huart1, rx_buffer, 1);
        }
    } else {
        // 重新开始寻找起始符
        rx_buffer_pos = 0;
        HAL_UART_Receive_DMA(&huart1, rx_buffer, 1);
    }
}

void communication_tx_complete_callback(void) {
    tx_complete = true;
    comm_stats.packets_sent++;
    
    if (comm_state == COMM_STATE_TRANSMITTING) {
        comm_state = COMM_STATE_IDLE;
    }
}

void communication_error_callback(void) {
    // 处理UART错误
    comm_stats.timeout_errors++;
    
    // 重新开始接收
    rx_buffer_pos = 0;
    rx_complete = false;
    
    if (comm_state == COMM_STATE_RECEIVING) {
        start_uart_receive();
    }
}

CommState communication_get_state(void) {
    return comm_state;
}

void communication_get_stats(CommStats *stats) {
    if (stats) {
        *stats = comm_stats;
    }
}

void communication_reset_stats(void) {
    memset(&comm_stats, 0, sizeof(comm_stats));
}
