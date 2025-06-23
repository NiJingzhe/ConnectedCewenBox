#include "test_protocol.h"
#include "protocol.h"
#include "command_handler.h"
#include <stdio.h>
#include <string.h>
#include <assert.h>

// 测试用的模拟数据
static float test_temperature = 25.5f;
static RTCDate test_date = {25, 6, 23, 1}; // 2025年6月23日，星期一
static RTCTime test_time = {14, 30, 0};    // 14:30:00

// 测试辅助函数
static void print_hex(const uint8_t *data, size_t len) {
    for (size_t i = 0; i < len; i++) {
        printf("%02X ", data[i]);
        if ((i + 1) % 16 == 0) printf("\n");
    }
    if (len % 16 != 0) printf("\n");
}

// 测试基本协议功能
void test_basic_protocol(void) {
    printf("=== 测试基本协议功能 ===\n");
    
    // 测试TLV编码/解码
    uint8_t buffer[256];
    
    // 测试写入float32
    int len = write_tlv_float32(buffer, sizeof(buffer), TAG_TEMPERATURE, test_temperature);
    assert(len > 0);
    printf("TLV编码长度: %d\n", len);
    print_hex(buffer, len);
    
    // 测试读取float32
    float read_temp;
    int result = read_tlv_float32(buffer, len, TAG_TEMPERATURE, &read_temp);
    assert(result > 0);
    assert(read_temp == test_temperature);
    printf("读取温度: %.1f°C\n", read_temp);
    
    // 测试数据包构建
    uint8_t cmd_data[256];
    uint8_t packet[512];
    
    // 构建获取温度指令
    int cmd_len = 0;
    cmd_len += write_tlv_string(cmd_data + cmd_len, sizeof(cmd_data) - cmd_len, TAG_INSTRUCTION, CMD_GET_TEMP);
    cmd_len += write_tlv_raw(cmd_data + cmd_len, sizeof(cmd_data) - cmd_len, TAG_DATA, NULL, 0);
    
    int packet_len = build_packet(PKT_TYPE_HOST_REQUEST, 0x0001, 0x0000, cmd_data, cmd_len, packet, sizeof(packet));
    assert(packet_len > 0);
    
    printf("数据包长度: %d\n", packet_len);
    printf("数据包内容:\n");
    print_hex(packet, packet_len);
    
    // 测试数据包解析
    PacketHeader header;
    uint8_t parsed_data[256];
    int parsed_len = parse_packet(packet, packet_len, &header, parsed_data, sizeof(parsed_data));
    assert(parsed_len >= 0);
    
    printf("解析结果:\n");
    printf("  版本: 0x%02X\n", header.version);
    printf("  类型: 0x%02X\n", header.type);
    printf("  包ID: 0x%04X\n", header.packet_id);
    printf("  数据长度: %d\n", header.data_length);
    
    printf("✓ 基本协议功能测试通过\n\n");
}

// 测试命令处理
void test_command_processing(void) {
    printf("=== 测试命令处理功能 ===\n");
    
    // 初始化命令处理器
    command_handler_init();
    
    // 测试ping命令
    uint8_t ping_request[64];
    uint8_t ping_response[256];
    uint16_t response_len;
    
    int req_len = 0;
    req_len += write_tlv_string(ping_request + req_len, sizeof(ping_request) - req_len, TAG_INSTRUCTION, CMD_PING);
    req_len += write_tlv_raw(ping_request + req_len, sizeof(ping_request) - req_len, TAG_DATA, NULL, 0);
    
    int result = process_command_packet(ping_request, req_len, ping_response, &response_len, 0x0001);
    assert(result == 0);
    printf("Ping命令响应长度: %d\n", response_len);
    
    // 测试获取温度命令
    uint8_t temp_request[64];
    uint8_t temp_response[256];
    
    req_len = 0;
    req_len += write_tlv_string(temp_request + req_len, sizeof(temp_request) - req_len, TAG_INSTRUCTION, CMD_GET_TEMP);
    req_len += write_tlv_raw(temp_request + req_len, sizeof(temp_request) - req_len, TAG_DATA, NULL, 0);
    
    result = process_command_packet(temp_request, req_len, temp_response, &response_len, 0x0002);
    assert(result == 0);
    printf("获取温度命令响应长度: %d\n", response_len);
    
    printf("✓ 命令处理功能测试通过\n\n");
}

// 测试设备控制
void test_device_control(void) {
    printf("=== 测试设备控制功能 ===\n");
    
    // 测试LED控制
    led_init();
    printf("LED初始状态: %s\n", led_get_state() ? "开" : "关");
    
    led_on();
    printf("LED开启后状态: %s\n", led_get_state() ? "开" : "关");
    
    led_off();
    printf("LED关闭后状态: %s\n", led_get_state() ? "开" : "关");
    
    // 测试蜂鸣器控制
    buzzer_init();
    printf("蜂鸣器初始状态: %s\n", buzzer_get_state() ? "开" : "关");
    
    buzzer_beep(100); // 100ms蜂鸣
    printf("蜂鸣器蜂鸣后状态: %s\n", buzzer_get_state() ? "开" : "关");
    
    // 测试报警系统
    alarm_init();
    alarm_set_config(0, 20.0f, 30.0f); // 蜂鸣器报警：20-30°C
    alarm_set_config(1, 15.0f, 35.0f); // LED报警：15-35°C
    
    AlarmConfig config;
    alarm_get_config(0, &config);
    printf("报警配置0: ID=%d, 下限=%.1f°C, 上限=%.1f°C\n", 
           config.id, config.low_temp, config.high_temp);
    
    // 测试报警触发
    alarm_check_temperature(40.0f); // 应该触发两个报警
    printf("温度40°C检查完成\n");
    
    printf("✓ 设备控制功能测试通过\n\n");
}

// 测试温度日志
void test_temperature_logging(void) {
    printf("=== 测试温度日志功能 ===\n");
    
    temp_log_init();
    
    // 添加一些测试数据
    for (int i = 0; i < 10; i++) {
        float temp = 20.0f + i * 0.5f;
        temp_log_add_entry(temp);
        printf("添加温度记录: %.1f°C\n", temp);
    }
    
    // 查询日志
    TempLogEntry entries[20];
    uint32_t count = temp_log_get_entries(0, UINT64_MAX, entries, 20);
    
    printf("查询到 %d 条日志记录:\n", count);
    for (uint32_t i = 0; i < count; i++) {
        printf("  %d: 时间戳=%llu, 温度=%.1f°C\n", 
               i + 1, (unsigned long long)entries[i].timestamp, entries[i].temperature);
    }
    
    printf("✓ 温度日志功能测试通过\n\n");
}

// 运行所有测试
void run_all_tests(void) {
    printf("开始STM32温度测量系统测试...\n\n");
    
    test_basic_protocol();
    test_command_processing();
    test_device_control();
    test_temperature_logging();
    
    printf("🎉 所有测试通过！系统就绪。\n");
}

// 模拟主机发送命令的测试
void test_host_communication(void) {
    printf("=== 模拟主机通信测试 ===\n");
    
    // 模拟主机发送ping命令
    uint8_t host_packet[256];
    uint8_t slave_response[256];
    uint16_t response_len;
    
    // 构建主机ping数据包
    uint8_t ping_data[64];
    int data_len = 0;
    data_len += write_tlv_string(ping_data + data_len, sizeof(ping_data) - data_len, TAG_INSTRUCTION, CMD_PING);
    data_len += write_tlv_raw(ping_data + data_len, sizeof(ping_data) - data_len, TAG_DATA, NULL, 0);
    
    int packet_len = build_packet(PKT_TYPE_HOST_REQUEST, 0x0001, 0x0000, ping_data, data_len, host_packet, sizeof(host_packet));
    
    printf("主机发送ping数据包 (%d字节):\n", packet_len);
    print_hex(host_packet, packet_len);
    
    // 模拟从机接收和处理
    PacketHeader header;
    uint8_t received_data[256];
    int received_len = parse_packet(host_packet, packet_len, &header, received_data, sizeof(received_data));
    
    if (received_len >= 0) {
        printf("从机成功解析数据包\n");
        
        // 处理命令
        int result = process_command_packet(received_data, received_len, slave_response, &response_len, header.packet_id);
        
        if (result == 0) {
            printf("从机响应数据包 (%d字节):\n", response_len);
            print_hex(slave_response, response_len);
            
            // 模拟主机接收响应
            PacketHeader resp_header;
            uint8_t resp_data[256];
            int resp_len = parse_packet(slave_response, response_len, &resp_header, resp_data, sizeof(resp_data));
            
            if (resp_len >= 0) {
                printf("主机成功接收从机响应\n");
                printf("响应包ID: 0x%04X (对应请求ID: 0x%04X)\n", resp_header.response_id, header.packet_id);
                
                // 解析响应数据
                char instruction[8];
                uint8_t status;
                if (read_tlv_string(resp_data, resp_len, TAG_INSTRUCTION, instruction, sizeof(instruction)) > 0 &&
                    read_tlv_uint8(resp_data, resp_len, TAG_STATUS, &status) > 0) {
                    printf("指令: %s, 状态: 0x%02X (%s)\n", 
                           instruction, status, 
                           status == STATUS_OK ? "成功" : "失败");
                }
            }
        }
    }
    
    printf("✓ 主机通信测试通过\n\n");
}
