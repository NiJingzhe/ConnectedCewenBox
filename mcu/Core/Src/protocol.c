#include "protocol.h"
#include "main.h"
#include <string.h>

// STM32 CRC32 硬件计算（与标准CRC32不同）
extern CRC_HandleTypeDef hcrc;

uint32_t calculate_crc32(const uint8_t *data, size_t length) {
    if (hcrc.Instance == NULL) {
        // 如果CRC硬件未初始化，返回简单校验和作为备用
        uint32_t sum = 0;
        for (size_t i = 0; i < length; i++) {
            sum += data[i];
        }
        return sum;
    }
    
    // 使用STM32硬件CRC计算
    return HAL_CRC_Calculate(&hcrc, (uint32_t*)data, (length + 3) / 4);
}

// 数据转义处理
int escape_data(const uint8_t *input, size_t input_len, uint8_t *output, size_t output_size) {
    size_t out_pos = 0;
    
    for (size_t i = 0; i < input_len && out_pos < output_size; i++) {
        uint8_t byte = input[i];
        
        if (byte == 0xAA || byte == 0x55) {
            // 需要转义
            if (out_pos + 1 >= output_size) {
                return -1; // 缓冲区不足
            }
            output[out_pos++] = byte;
            output[out_pos++] = ESCAPE_BYTE;
        } else {
            output[out_pos++] = byte;
        }
    }
    
    return out_pos;
}

// 数据去转义处理
int unescape_data(const uint8_t *input, size_t input_len, uint8_t *output, size_t output_size) {
    size_t out_pos = 0;
    
    for (size_t i = 0; i < input_len && out_pos < output_size; i++) {
        uint8_t byte = input[i];
        
        if ((byte == 0xAA || byte == 0x55) && i + 1 < input_len && input[i + 1] == ESCAPE_BYTE) {
            // 这是转义序列
            output[out_pos++] = byte;
            i++; // 跳过转义字节
        } else if ((byte == 0xAA && i + 1 < input_len && input[i + 1] == 0x55) ||
                   (byte == 0x55 && i + 1 < input_len && input[i + 1] == 0xAA)) {
            // 这是起始符或结束符，不应该在数据中出现
            return -1; // 数据包损坏
        } else {
            output[out_pos++] = byte;
        }
    }
    
    return out_pos;
}

// 查找数据包边界
bool find_packet_boundaries(const uint8_t *buffer, size_t buffer_len, size_t *start_pos, size_t *end_pos) {
    bool start_found = false;
    
    for (size_t i = 0; i < buffer_len - 1; i++) {
        if (!start_found && buffer[i] == START_MARK_1 && buffer[i + 1] == START_MARK_2) {
            *start_pos = i + 2; // 跳过起始符
            start_found = true;
            i++; // 跳过下一个字节
            continue;
        }
        
        if (start_found && buffer[i] == END_MARK_1 && buffer[i + 1] == END_MARK_2) {
            // 需要确认这不是转义序列
            bool is_escaped = false;
            if (i > 0 && buffer[i - 1] == ESCAPE_BYTE) {
                // 检查前面是否有0x55
                if (i > 1 && buffer[i - 2] == 0x55) {
                    is_escaped = true;
                }
            }
            
            if (!is_escaped) {
                *end_pos = i;
                return true;
            }
        }
    }
    
    return false;
}

// 构建数据包
int build_packet(uint8_t type, uint16_t packet_id, uint16_t response_id, 
                const uint8_t *data, uint16_t data_len, uint8_t *output, size_t output_size) {
    if (output_size < 16 + data_len * 2) { // 预留转义空间
        return -1;
    }
    
    size_t pos = 0;
    
    // 起始符
    output[pos++] = START_MARK_1;
    output[pos++] = START_MARK_2;
    
    // 构建包头（不转义）
    PacketHeader header;
    header.version = PROTOCOL_VERSION;
    header.type = type;
    header.packet_id = packet_id;
    header.response_id = response_id;
    header.data_length = data_len;
    
    // 准备需要转义的数据（包头+数据）
    uint8_t temp_buffer[MAX_PACKET_SIZE];
    size_t temp_pos = 0;
    
    // 复制包头
    memcpy(temp_buffer + temp_pos, &header, sizeof(PacketHeader));
    temp_pos += sizeof(PacketHeader);
    
    // 复制数据
    if (data && data_len > 0) {
        memcpy(temp_buffer + temp_pos, data, data_len);
        temp_pos += data_len;
    }
    
    // 计算CRC32
    uint32_t crc = calculate_crc32(temp_buffer, temp_pos);
    memcpy(temp_buffer + temp_pos, &crc, sizeof(uint32_t));
    temp_pos += sizeof(uint32_t);
    
    // 转义数据
    int escaped_len = escape_data(temp_buffer, temp_pos, output + pos, output_size - pos - 2);
    if (escaped_len < 0) {
        return -1;
    }
    pos += escaped_len;
    
    // 结束符
    if (pos + 2 > output_size) {
        return -1;
    }
    output[pos++] = END_MARK_1;
    output[pos++] = END_MARK_2;
    
    return pos;
}

// 解析数据包
int parse_packet(const uint8_t *buffer, size_t buffer_len, PacketHeader *header, uint8_t *data, size_t data_size) {
    size_t start_pos, end_pos;
    
    // 查找数据包边界
    if (!find_packet_boundaries(buffer, buffer_len, &start_pos, &end_pos)) {
        return -1; // 未找到完整数据包
    }
    
    // 提取并去转义数据
    uint8_t temp_buffer[MAX_PACKET_SIZE];
    int unescaped_len = unescape_data(buffer + start_pos, end_pos - start_pos, temp_buffer, sizeof(temp_buffer));
    if (unescaped_len < 0) {
        return -1; // 去转义失败
    }
    
    // 检查最小长度
    if (unescaped_len < (int)(sizeof(PacketHeader) + sizeof(uint32_t))) {
        return -1; // 数据包太短
    }
    
    // 提取包头
    memcpy(header, temp_buffer, sizeof(PacketHeader));
    
    // 验证版本
    if (header->version != PROTOCOL_VERSION) {
        return -1; // 版本不匹配
    }
    
    // 验证数据长度
    size_t expected_len = sizeof(PacketHeader) + header->data_length + sizeof(uint32_t);
    if ((size_t)unescaped_len != expected_len) {
        return -1; // 长度不匹配
    }
    
    // 验证CRC32
    uint32_t received_crc;
    memcpy(&received_crc, temp_buffer + unescaped_len - sizeof(uint32_t), sizeof(uint32_t));
    uint32_t calculated_crc = calculate_crc32(temp_buffer, unescaped_len - sizeof(uint32_t));
    if (received_crc != calculated_crc) {
        return -1; // CRC校验失败
    }
    
    // 提取数据
    if (header->data_length > 0) {
        if (data_size < header->data_length) {
            return -1; // 输出缓冲区太小
        }
        memcpy(data, temp_buffer + sizeof(PacketHeader), header->data_length);
    }
    
    return header->data_length;
}

// TLV写入函数
int write_tlv_uint8(uint8_t *buffer, size_t buffer_size, const char *tag, uint8_t value) {
    if (buffer_size < 5) return -1; // 2+2+1
    
    memcpy(buffer, tag, 2);
    uint16_t length = 1;
    memcpy(buffer + 2, &length, 2);
    buffer[4] = value;
    return 5;
}

int write_tlv_uint16(uint8_t *buffer, size_t buffer_size, const char *tag, uint16_t value) {
    if (buffer_size < 6) return -1; // 2+2+2
    
    memcpy(buffer, tag, 2);
    uint16_t length = 2;
    memcpy(buffer + 2, &length, 2);
    memcpy(buffer + 4, &value, 2);
    return 6;
}

int write_tlv_uint64(uint8_t *buffer, size_t buffer_size, const char *tag, uint64_t value) {
    if (buffer_size < 12) return -1; // 2+2+8
    
    memcpy(buffer, tag, 2);
    uint16_t length = 8;
    memcpy(buffer + 2, &length, 2);
    memcpy(buffer + 4, &value, 8);
    return 12;
}

int write_tlv_float32(uint8_t *buffer, size_t buffer_size, const char *tag, float value) {
    if (buffer_size < 8) return -1; // 2+2+4
    
    memcpy(buffer, tag, 2);
    uint16_t length = 4;
    memcpy(buffer + 2, &length, 2);
    memcpy(buffer + 4, &value, 4);
    return 8;
}

int write_tlv_string(uint8_t *buffer, size_t buffer_size, const char *tag, const char *str) {
    uint16_t str_len = strlen(str);
    if (buffer_size < 4 + str_len) return -1;
    
    memcpy(buffer, tag, 2);
    memcpy(buffer + 2, &str_len, 2);
    memcpy(buffer + 4, str, str_len);
    return 4 + str_len;
}

int write_tlv_raw(uint8_t *buffer, size_t buffer_size, const char *tag, const uint8_t *data, uint16_t length) {
    if (buffer_size < 4 + length) return -1;
    
    memcpy(buffer, tag, 2);
    memcpy(buffer + 2, &length, 2);
    if (length > 0) {
        memcpy(buffer + 4, data, length);
    }
    return 4 + length;
}

// TLV读取函数
int read_tlv_uint8(const uint8_t *buffer, size_t buffer_size, const char *tag, uint8_t *value) {
    for (size_t i = 0; i < buffer_size - 4; ) {
        if (memcmp(buffer + i, tag, 2) == 0) {
            uint16_t length;
            memcpy(&length, buffer + i + 2, 2);
            if (length == 1 && i + 4 + length <= buffer_size) {
                *value = buffer[i + 4];
                return 1;
            }
        }
        
        // 跳到下一个TLV
        uint16_t length;
        memcpy(&length, buffer + i + 2, 2);
        i += 4 + length;
    }
    return -1;
}

int read_tlv_uint16(const uint8_t *buffer, size_t buffer_size, const char *tag, uint16_t *value) {
    for (size_t i = 0; i < buffer_size - 4; ) {
        if (memcmp(buffer + i, tag, 2) == 0) {
            uint16_t length;
            memcpy(&length, buffer + i + 2, 2);
            if (length == 2 && i + 4 + length <= buffer_size) {
                memcpy(value, buffer + i + 4, 2);
                return 1;
            }
        }
        
        // 跳到下一个TLV
        uint16_t length;
        memcpy(&length, buffer + i + 2, 2);
        i += 4 + length;
    }
    return -1;
}

int read_tlv_uint64(const uint8_t *buffer, size_t buffer_size, const char *tag, uint64_t *value) {
    for (size_t i = 0; i < buffer_size - 4; ) {
        if (memcmp(buffer + i, tag, 2) == 0) {
            uint16_t length;
            memcpy(&length, buffer + i + 2, 2);
            if (length == 8 && i + 4 + length <= buffer_size) {
                memcpy(value, buffer + i + 4, 8);
                return 1;
            }
        }
        
        // 跳到下一个TLV
        uint16_t length;
        memcpy(&length, buffer + i + 2, 2);
        i += 4 + length;
    }
    return -1;
}

int read_tlv_float32(const uint8_t *buffer, size_t buffer_size, const char *tag, float *value) {
    for (size_t i = 0; i < buffer_size - 4; ) {
        if (memcmp(buffer + i, tag, 2) == 0) {
            uint16_t length;
            memcpy(&length, buffer + i + 2, 2);
            if (length == 4 && i + 4 + length <= buffer_size) {
                memcpy(value, buffer + i + 4, 4);
                return 1;
            }
        }
        
        // 跳到下一个TLV
        uint16_t length;
        memcpy(&length, buffer + i + 2, 2);
        i += 4 + length;
    }
    return -1;
}

int read_tlv_string(const uint8_t *buffer, size_t buffer_size, const char *tag, char *str, size_t str_size) {
    for (size_t i = 0; i < buffer_size - 4; ) {
        if (memcmp(buffer + i, tag, 2) == 0) {
            uint16_t length;
            memcpy(&length, buffer + i + 2, 2);
            if (i + 4 + length <= buffer_size && length < str_size) {
                memcpy(str, buffer + i + 4, length);
                str[length] = '\0';
                return length;
            }
        }
        
        // 跳到下一个TLV
        uint16_t length;
        memcpy(&length, buffer + i + 2, 2);
        i += 4 + length;
    }
    return -1;
}

int read_tlv_raw(const uint8_t *buffer, size_t buffer_size, const char *tag, uint8_t *data, uint16_t *length) {
    for (size_t i = 0; i < buffer_size - 4; ) {
        if (memcmp(buffer + i, tag, 2) == 0) {
            uint16_t tlv_length;
            memcpy(&tlv_length, buffer + i + 2, 2);
            if (i + 4 + tlv_length <= buffer_size && tlv_length <= *length) {
                memcpy(data, buffer + i + 4, tlv_length);
                *length = tlv_length;
                return tlv_length;
            }
        }
        
        // 跳到下一个TLV
        uint16_t tlv_length;
        memcpy(&tlv_length, buffer + i + 2, 2);
        i += 4 + tlv_length;
    }
    return -1;
}
