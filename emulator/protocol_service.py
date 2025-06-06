import struct
import zlib
from datetime import datetime
from typing import Dict, List, Tuple, Any
from protocol_constants import ProtocolConstants as PC

class ProtocolService:
    def __init__(self):
        self.packet_counter = 0
        self.MAX_PACKET_NUMBER = 0x7F

    def _get_next_packet_number(self) -> int:
        self.packet_counter = (self.packet_counter + 1) % (self.MAX_PACKET_NUMBER + 1)
        return self.packet_counter

    def _calculate_crc32(self, data: bytes) -> int:
        # 使用zlib的crc32函数计算CRC32
        return zlib.crc32(data) & 0xFFFFFFFF

    def _encode_tlv(self, tag: str, value: Any) -> bytes:
        if len(tag) != 2:
            raise ValueError(f"TLV tag must be exactly 2 characters, got: {tag}")

        tag_bytes = tag.encode('ascii')
        
        if isinstance(value, str):
            value_bytes = value.encode('utf-8')
        elif isinstance(value, int):
            if value <= 0xFF:
                value_bytes = struct.pack('<B', value)
            elif value <= 0xFFFF:
                value_bytes = struct.pack('<H', value)
            elif value <= 0xFFFFFFFF:
                value_bytes = struct.pack('<I', value)
            else:
                value_bytes = struct.pack('<Q', value)
        elif isinstance(value, float):
            value_bytes = struct.pack('<f', value)
        elif isinstance(value, list):
            # 处理嵌套TLV
            value_bytes = b''.join(self._encode_tlv(item['tag'], item['value']) for item in value)
        else:
            raise ValueError(f"Unsupported TLV value type: {type(value)}")

        length_bytes = struct.pack('<H', len(value_bytes))
        return tag_bytes + length_bytes + value_bytes

    def create_response(self, command: bytes, status: int, data: Dict[str, Any] = None) -> bytes:
        tlv_fields = [
            {'tag': 'IN', 'value': command.decode('ascii')},
            {'tag': 'ST', 'value': status}
        ]

        if data:
            for tag, value in data.items():
                if isinstance(value, dict):
                    nested_tlvs = []
                    for nested_tag, nested_value in value.items():
                        nested_tlvs.append({'tag': nested_tag, 'value': nested_value})
                    tlv_fields.append({'tag': tag, 'value': nested_tlvs})
                else:
                    tlv_fields.append({'tag': tag, 'value': value})

        # 编码所有TLV字段
        data_bytes = b''.join(self._encode_tlv(field['tag'], field['value']) for field in tlv_fields)
        
        # 构建数据包
        packet_number = self._get_next_packet_number()
        response_number = 0  # 设备响应包，响应编号为0
        
        # 计算CRC32的数据
        crc_data = bytes([PC.PacketTypes.DEVICE_RESPONSE]) + \
                   struct.pack('<H', packet_number) + \
                   struct.pack('<H', response_number) + \
                   data_bytes
        
        crc32 = self._calculate_crc32(crc_data)
        
        # 构建完整数据包
        packet = PC.START_BYTES + \
                 bytes([PC.VERSION]) + \
                 bytes([PC.PacketTypes.DEVICE_RESPONSE]) + \
                 struct.pack('<H', packet_number) + \
                 struct.pack('<H', response_number) + \
                 struct.pack('<H', len(data_bytes)) + \
                 struct.pack('<I', crc32) + \
                 data_bytes + \
                 PC.END_BYTES
        
        return packet

    def parse_request(self, data: bytes) -> Tuple[bytes, Dict[str, Any]]:
        if len(data) < 16:
            raise ValueError("数据包太短")

        # 验证起始字节
        if data[:2] != PC.START_BYTES:
            raise ValueError("无效的起始字节")

        # 解析头部
        version = data[2]
        packet_type = data[3]
        packet_number = struct.unpack('<H', data[4:6])[0]
        response_number = struct.unpack('<H', data[6:8])[0]
        data_length = struct.unpack('<H', data[8:10])[0]
        crc32 = struct.unpack('<I', data[10:14])[0]

        # 提取数据部分
        data_start = 14
        data_end = data_start + data_length
        payload = data[data_start:data_end]

        # 验证CRC32
        crc_data = bytes([packet_type]) + \
                   struct.pack('<H', packet_number) + \
                   struct.pack('<H', response_number) + \
                   payload
        
        if self._calculate_crc32(crc_data) != crc32:
            raise ValueError("CRC32校验失败")

        # 验证结束字节
        if data[data_end:data_end+2] != PC.END_BYTES:
            raise ValueError("无效的结束字节")

        # 解析命令和参数
        pos = 0
        command = None
        params = {}

        while pos < len(payload):
            if pos + 4 > len(payload):
                break

            tag = payload[pos:pos+2].decode('ascii')
            length = struct.unpack('<H', payload[pos+2:pos+4])[0]
            value = payload[pos+4:pos+4+length]

            if tag == 'IN':
                command = value
            else:
                # 根据tag类型解析value
                if tag in ['YY', 'MM', 'DD', 'WK', 'HH', 'SS', 'ID', 'ST', 'EC']:
                    params[tag] = value[0]
                elif tag in ['MX']:
                    params[tag] = struct.unpack('<H', value)[0]
                elif tag in ['TS', 'TS1', 'TS2']:
                    params[tag] = struct.unpack('<Q', value)[0]
                elif tag in ['T ', 'L ', 'H ']:
                    params[tag] = struct.unpack('<f', value)[0]
                elif tag in ['AL', 'LG']:
                    # 嵌套TLV的处理
                    nested_pos = 0
                    nested_values = []
                    while nested_pos < len(value):
                        nested_tag = value[nested_pos:nested_pos+2].decode('ascii')
                        nested_length = struct.unpack('<H', value[nested_pos+2:nested_pos+4])[0]
                        nested_value = value[nested_pos+4:nested_pos+4+nested_length]
                        nested_values.append((nested_tag, nested_value))
                        nested_pos += 4 + nested_length
                    params[tag] = nested_values
                else:
                    params[tag] = value.decode('utf-8')

            pos += 4 + length

        return command, params 