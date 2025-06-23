#ifndef ESCAPING_HPP
#define ESCAPING_HPP

#include <cstddef>
#include <cstdint>

/**
 * @brief 带转义功能的缓冲区读取器
 * 
 * 提供带转义处理的缓冲区读取功能，能够识别和处理转义序列，
 * 支持查找起始和结束标记。适用于需要转义的协议数据解析。
 */
class EscapingReader
{
public:
    /**
     * @brief 构造函数
     * @param buffer 缓冲区指针
     * @param length 缓冲区长度
     */
    EscapingReader(const char* buffer, size_t length);
    
    /**
     * @brief 构造函数（指定起始和结束位置）
     * @param begin 起始位置指针
     * @param end 结束位置指针
     */
    EscapingReader(const char* begin, const char* end);
    
    /**
     * @brief 读取指定数量的字节并处理转义
     * @param data 存储读取数据的缓冲区
     * @param length 要读取的字节数
     * @return 实际读取的字节数（去转义后），负值表示异常
     */
    int read(char* data, size_t length);
    
    /**
     * @brief 设置读取位置
     * @param offset 相对于起始位置的偏移量
     * @return 设置是否成功
     */
    bool seek(size_t offset);
    
    /**
     * @brief 获取当前读取位置
     * @return 当前位置偏移量
     */
    size_t tell() const;
    
    /**
     * @brief 检查是否已读完所有数据
     * @return true 如果没有更多数据可读
     */
    bool is_empty() const;
    
    /**
     * @brief 查找起始标记 (0xAA55)
     * @return true 如果找到起始标记
     */
    bool find_start();
    
    /**
     * @brief 查找结束标记 (0x55AA)
     * @return true 如果找到结束标记
     * @note 在查找过程中会正确处理转义序列
     */
    bool find_end();
    
    /**
     * @brief 获取可读字节数
     * @return 剩余可读的字节数
     */
    size_t available() const;
    
    /**
     * @brief 检查是否有异常
     * @return true 如果检测到异常
     */
    bool has_error() const { return has_error_; }
    
    /**
     * @brief 清除异常状态
     */
    void clear_error() { has_error_ = false; }
    
    /**
     * @brief 重置到起始位置
     */
    void reset();
    
private:
    const char* begin_;     ///< 起始位置指针
    const char* end_;       ///< 结束位置指针
    const char* current_;   ///< 当前读取位置指针
    bool has_error_;        ///< 异常状态标志
    
    static constexpr uint8_t START_MARK1 = 0xAA;
    static constexpr uint8_t START_MARK2 = 0x55;
    static constexpr uint8_t END_MARK1 = 0x55;
    static constexpr uint8_t END_MARK2 = 0xAA;
    static constexpr uint8_t STUFF_BYTE = 0x00;
};

/**
 * @brief 带转义功能的缓冲区写入器
 * 
 * 提供带转义处理的缓冲区写入功能，自动对需要转义的字节进行转义处理，
 * 支持写入起始和结束标记。适用于需要转义的协议数据封装。
 */
class EscapingWriter
{
public:
    /**
     * @brief 构造函数
     * @param buffer 缓冲区指针
     * @param length 缓冲区长度
     */
    EscapingWriter(char* buffer, size_t length);
    
    /**
     * @brief 构造函数（指定起始和结束位置）
     * @param begin 起始位置指针
     * @param end 结束位置指针
     */
    EscapingWriter(char* begin, char* end);
    
    /**
     * @brief 写入指定数量的字节并自动处理转义
     * @param data 要写入的数据缓冲区
     * @param length 要写入的字节数
     * @return 实际写入的原始字节数（转义前），负值表示异常
     */
    int write(const char* data, size_t length);
    
    /**
     * @brief 写入起始标记 (0xAA55)
     * @return 写入是否成功
     */
    bool write_start();
    
    /**
     * @brief 写入结束标记 (0x55AA)
     * @return 写入是否成功
     */
    bool write_end();
    
    /**
     * @brief 设置写入位置
     * @param offset 相对于起始位置的偏移量
     * @return 设置是否成功
     */
    bool seek(size_t offset);
    
    /**
     * @brief 获取当前写入位置
     * @return 当前位置偏移量
     */
    size_t tell() const;
    
    /**
     * @brief 检查缓冲区是否已满
     * @return true 如果无法写入更多数据
     */
    bool is_full() const;
    
    /**
     * @brief 获取可写字节数
     * @return 剩余可写的字节数
     */
    size_t space() const;
    
    /**
     * @brief 检查是否有异常
     * @return true 如果检测到异常
     */
    bool has_error() const { return has_error_; }
    
    /**
     * @brief 清除异常状态
     */
    void clear_error() { has_error_ = false; }
    
    /**
     * @brief 重置到起始位置
     */
    void reset();
    
private:
    char* begin_;       ///< 起始位置指针
    char* end_;         ///< 结束位置指针
    char* current_;     ///< 当前写入位置指针
    bool has_error_;    ///< 异常状态标志
    
    static constexpr uint8_t START_MARK1 = 0xAA;
    static constexpr uint8_t START_MARK2 = 0x55;
    static constexpr uint8_t END_MARK1 = 0x55;
    static constexpr uint8_t END_MARK2 = 0xAA;
    static constexpr uint8_t STUFF_BYTE = 0x00;
    
    /**
     * @brief 写入单个字节并处理转义
     * @param byte 要写入的字节
     * @return 写入是否成功
     */
    bool write_stuffed_byte(uint8_t byte);
    
    /**
     * @brief 检查字节是否需要转义
     * @param byte 要检查的字节
     * @return true 如果字节需要转义
     */
    bool needs_stuffing(uint8_t byte) const;
};

// EscapingReader 实现
inline EscapingReader::EscapingReader(const char* buffer, size_t length)
    : begin_(buffer), end_(buffer + length), current_(buffer), has_error_(false)
{
}

inline EscapingReader::EscapingReader(const char* begin, const char* end)
    : begin_(begin), end_(end), current_(begin), has_error_(false)
{
}

inline int EscapingReader::read(char* data, size_t length)
{
    if (!data || length == 0) {
        return 0;
    }
    
    size_t bytes_read = 0;
    
    while (bytes_read < length && current_ < end_) {
        uint8_t byte = static_cast<uint8_t>(*current_);
        
        // 检查是否是转义字节
        if (byte == STUFF_BYTE && current_ != begin_) {
            // 获取前一个字节
            const char* prev_pos = current_ - 1;
            uint8_t prev_byte = static_cast<uint8_t>(*prev_pos);
            if (prev_byte == 0xAA || prev_byte == 0x55) {
                // 这是一个合法的转义字节，跳过它
                ++current_;
                continue;
            } else {
                // 异常：转义字节前面不是需要转义的字节
                has_error_ = true;
                return -1;
            }
        }
        
        // 普通数据字节
        data[bytes_read] = static_cast<char>(byte);
        ++bytes_read;
        ++current_;
    }
    
    return static_cast<int>(bytes_read);
}

inline bool EscapingReader::seek(size_t offset)
{
    const char* new_pos = begin_ + offset;
    if (new_pos <= end_) {
        current_ = new_pos;
        has_error_ = false;
        return true;
    }
    return false;
}

inline size_t EscapingReader::tell() const
{
    return static_cast<size_t>(current_ - begin_);
}

inline bool EscapingReader::is_empty() const
{
    return current_ >= end_;
}

inline bool EscapingReader::find_start()
{
    while (current_ + 1 < end_) {
        if (static_cast<uint8_t>(*current_) == START_MARK1 && 
            static_cast<uint8_t>(*(current_ + 1)) == START_MARK2) {
            current_ += 2;
            has_error_ = false;
            return true;
        }
        ++current_;
    }
    
    return false;
}

inline bool EscapingReader::find_end()
{
    const char* search_pos = current_;
    
    while (search_pos + 1 < end_) {
        uint8_t byte1 = static_cast<uint8_t>(*search_pos);
        uint8_t byte2 = static_cast<uint8_t>(*(search_pos + 1));
        
        if (byte1 == END_MARK1 && byte2 == END_MARK2) {
            current_ = search_pos + 2;
            return true;
        }
        
        // 跳过转义字节
        if (byte2 == STUFF_BYTE && (byte1 == 0xAA || byte1 == 0x55)) {
            search_pos += 2; // 跳过原字节和转义字节
        } else {
            search_pos += 1;
        }
    }
    
    return false;
}

inline size_t EscapingReader::available() const
{
    return static_cast<size_t>(end_ - current_);
}

inline void EscapingReader::reset()
{
    current_ = begin_;
    has_error_ = false;
}

// EscapingWriter 实现
inline EscapingWriter::EscapingWriter(char* buffer, size_t length)
    : begin_(buffer), end_(buffer + length), current_(buffer), has_error_(false)
{
}

inline EscapingWriter::EscapingWriter(char* begin, char* end)
    : begin_(begin), end_(end), current_(begin), has_error_(false)
{
}

inline int EscapingWriter::write(const char* data, size_t length)
{
    if (!data || length == 0) {
        return 0;
    }
    
    size_t bytes_written = 0;
    
    for (size_t i = 0; i < length; ++i) {
        uint8_t byte = static_cast<uint8_t>(data[i]);
        
        if (!write_stuffed_byte(byte)) {
            has_error_ = true;
            break;
        }
        ++bytes_written;
    }
    
    return static_cast<int>(bytes_written);
}

inline bool EscapingWriter::write_start()
{
    if (current_ + 1 >= end_) {
        has_error_ = true;
        return false;
    }
    
    *current_ = static_cast<char>(START_MARK1);
    ++current_;
    *current_ = static_cast<char>(START_MARK2);
    ++current_;
    
    return true;
}

inline bool EscapingWriter::write_end()
{
    if (current_ + 1 >= end_) {
        has_error_ = true;
        return false;
    }
    
    *current_ = static_cast<char>(END_MARK1);
    ++current_;
    *current_ = static_cast<char>(END_MARK2);
    ++current_;
    
    return true;
}

inline bool EscapingWriter::seek(size_t offset)
{
    char* new_pos = begin_ + offset;
    if (new_pos <= end_) {
        current_ = new_pos;
        has_error_ = false;
        return true;
    }
    return false;
}

inline size_t EscapingWriter::tell() const
{
    return static_cast<size_t>(current_ - begin_);
}

inline bool EscapingWriter::is_full() const
{
    return current_ >= end_;
}

inline size_t EscapingWriter::space() const
{
    return static_cast<size_t>(end_ - current_);
}

inline void EscapingWriter::reset()
{
    current_ = begin_;
    has_error_ = false;
}

inline bool EscapingWriter::write_stuffed_byte(uint8_t byte)
{
    if (current_ >= end_) {
        return false; // 缓冲区已满
    }
    
    // 写入原字节
    *current_ = static_cast<char>(byte);
    ++current_;
    
    // 检查是否需要转义
    if (needs_stuffing(byte)) {
        if (current_ >= end_) {
            has_error_ = true;
            return false; // 空间不足写入转义字节
        }
        
        // 写入转义字节
        *current_ = static_cast<char>(STUFF_BYTE);
        ++current_;
    }
    
    return true;
}

inline bool EscapingWriter::needs_stuffing(uint8_t byte) const
{
    return (byte == 0xAA || byte == 0x55);
}

#endif // ESCAPING_HPP