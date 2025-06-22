#ifndef BUFFER_HELPERS_HPP
#define BUFFER_HELPERS_HPP

#include <cstddef>
#include <cstdint>

/**
 * @file buffer_helpers.hpp
 * @brief 缓冲区操作辅助类集合
 * @details 提供了一套用于缓冲区读写操作的模板类，包括基本的读写操作和带转义功能的读写操作
 * @author Chauncey Ma
 * @date 2025年6月22日
 */

/**
 * @brief 缓冲区读取器
 * @tparam BufferType 缓冲区类型，需要支持 at()、size() 等方法
 * 
 * 提供对任意类型缓冲区的顺序读取功能，支持位置控制和状态查询。
 */
template<typename BufferType>
class BufferReader
{
public:
    using Iterator = typename BufferType::Iterator;
    
    /**
     * @brief 构造函数
     * @param begin_it 起始迭代器
     * @param end_it 结束迭代器
     */
    BufferReader(Iterator begin_it, Iterator end_it);
    
    /**
     * @brief 读取指定数量的字节
     * @param data 存储读取数据的缓冲区
     * @param length 要读取的字节数
     * @return 实际读取的字节数
     */
    size_t read(char* data, size_t length);
    
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
     * @brief 获取可读字节数
     * @return 剩余可读的字节数
     */
    size_t available() const;
    
private:
    Iterator begin_it_;     ///< 起始迭代器
    Iterator end_it_;       ///< 结束迭代器
    Iterator current_it_;   ///< 当前读取位置迭代器
};

/**
 * @brief 缓冲区写入器
 * @tparam BufferType 缓冲区类型，需要支持 at()、size() 等方法
 * 
 * 提供对任意类型缓冲区的顺序写入功能，支持位置控制和状态查询。
 */
template<typename BufferType>
class BufferWriter
{
public:
    using Iterator = typename BufferType::Iterator;
    
    /**
     * @brief 构造函数
     * @param begin_it 起始迭代器
     * @param end_it 结束迭代器
     */
    BufferWriter(Iterator begin_it, Iterator end_it);
    
    /**
     * @brief 写入指定数量的字节
     * @param data 要写入的数据缓冲区
     * @param length 要写入的字节数
     * @return 实际写入的字节数
     */
    size_t write(const char* data, size_t length);
    
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
    
private:
    Iterator begin_it_;     ///< 起始迭代器
    Iterator end_it_;       ///< 结束迭代器
    Iterator current_it_;   ///< 当前写入位置迭代器
};

/**
 * @brief 带填充功能的缓冲区读取器
 * @tparam BufferType 缓冲区类型，需要支持 at()、size() 等方法
 * 
 * 提供带填充处理的缓冲区读取功能，能够识别和处理填充序列，
 * 支持查找起始和结束标记。适用于需要填充的协议数据解析。
 */
template<typename BufferType>
class BufferEscapingReader
{
public:
    using Iterator = typename BufferType::Iterator;
    
    /**
     * @brief 构造函数
     * @param begin_it 起始迭代器
     * @param end_it 结束迭代器
     */
    BufferEscapingReader(Iterator begin_it, Iterator end_it);
    
    /**
     * @brief 读取指定数量的字节并处理填充
     * @param data 存储读取数据的缓冲区
     * @param length 要读取的字节数
     * @return 实际读取的字节数（去填充后），负值表示异常
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
     * @note 在查找过程中会正确处理填充序列
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
    
private:
    Iterator begin_it_;     ///< 起始迭代器
    Iterator end_it_;       ///< 结束迭代器
    Iterator current_it_;   ///< 当前读取位置迭代器
    bool has_error_;        ///< 异常状态标志
    
    static constexpr uint8_t START_MARK1 = 0xAA;
    static constexpr uint8_t START_MARK2 = 0x55;
    static constexpr uint8_t END_MARK1 = 0x55;
    static constexpr uint8_t END_MARK2 = 0xAA;
    static constexpr uint8_t STUFF_BYTE = 0x00;
};

/**
 * @brief 带填充功能的缓冲区写入器
 * @tparam BufferType 缓冲区类型，需要支持 at()、size() 等方法
 * 
 * 提供带填充处理的缓冲区写入功能，自动对需要填充的字节进行填充处理，
 * 支持写入起始和结束标记。适用于需要填充的协议数据封装。
 */
template<typename BufferType>
class BufferEscapingWriter
{
public:
    using Iterator = typename BufferType::Iterator;
    
    /**
     * @brief 构造函数
     * @param begin_it 起始迭代器
     * @param end_it 结束迭代器
     */
    BufferEscapingWriter(Iterator begin_it, Iterator end_it);
    
    /**
     * @brief 写入指定数量的字节并自动处理填充
     * @param data 要写入的数据缓冲区
     * @param length 要写入的字节数
     * @return 实际写入的原始字节数（填充前），负值表示异常
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
    
private:
    Iterator begin_it_;     ///< 起始迭代器
    Iterator end_it_;       ///< 结束迭代器
    Iterator current_it_;   ///< 当前写入位置迭代器
    bool has_error_;        ///< 异常状态标志
    
    static constexpr uint8_t START_MARK1 = 0xAA;
    static constexpr uint8_t START_MARK2 = 0x55;
    static constexpr uint8_t END_MARK1 = 0x55;
    static constexpr uint8_t END_MARK2 = 0xAA;
    static constexpr uint8_t STUFF_BYTE = 0x00;
    
    /**
     * @brief 写入单个字节并处理填充
     * @param byte 要写入的字节
     * @return 写入是否成功
     */
    bool write_stuffed_byte(uint8_t byte);
    
    /**
     * @brief 检查字节是否需要填充
     * @param byte 要检查的字节
     * @return true 如果字节需要填充
     */
    bool needs_stuffing(uint8_t byte) const;
};

// BufferReader 实现
template<typename BufferType>
BufferReader<BufferType>::BufferReader(Iterator begin_it, Iterator end_it)
    : begin_it_(begin_it), end_it_(end_it), current_it_(begin_it)
{
}

template<typename BufferType>
size_t BufferReader<BufferType>::read(char* data, size_t length)
{
    if (!data || length == 0) {
        return 0;
    }
    
    size_t bytes_read = 0;
    
    while (bytes_read < length && current_it_ != end_it_) {
        data[bytes_read] = *current_it_;
        ++current_it_;
        ++bytes_read;
    }
    
    return bytes_read;
}

template<typename BufferType>
bool BufferReader<BufferType>::seek(size_t offset)
{
    Iterator it = begin_it_ + static_cast<typename Iterator::difference_type>(offset);
    if (it <= end_it_) {
        current_it_ = it;
        return true;
    }
    return false;
}

template<typename BufferType>
size_t BufferReader<BufferType>::tell() const
{
    return static_cast<size_t>(current_it_ - begin_it_);
}

template<typename BufferType>
bool BufferReader<BufferType>::is_empty() const
{
    return current_it_ == end_it_;
}

template<typename BufferType>
size_t BufferReader<BufferType>::available() const
{
    return static_cast<size_t>(end_it_ - current_it_);
}

// BufferWriter 实现
template<typename BufferType>
BufferWriter<BufferType>::BufferWriter(Iterator begin_it, Iterator end_it)
    : begin_it_(begin_it), end_it_(end_it), current_it_(begin_it)
{
}

template<typename BufferType>
size_t BufferWriter<BufferType>::write(const char* data, size_t length)
{
    if (!data || length == 0) {
        return 0;
    }
    
    size_t bytes_written = 0;
    
    while (bytes_written < length && current_it_ != end_it_) {
        *current_it_ = data[bytes_written];
        ++current_it_;
        ++bytes_written;
    }
    
    return bytes_written;
}

template<typename BufferType>
bool BufferWriter<BufferType>::seek(size_t offset)
{
    Iterator it = begin_it_ + static_cast<typename Iterator::difference_type>(offset);
    if (it <= end_it_) {
        current_it_ = it;
        return true;
    }
    return false;
}

template<typename BufferType>
size_t BufferWriter<BufferType>::tell() const
{
    return static_cast<size_t>(current_it_ - begin_it_);
}

template<typename BufferType>
bool BufferWriter<BufferType>::is_full() const
{
    return current_it_ == end_it_;
}

template<typename BufferType>
size_t BufferWriter<BufferType>::space() const
{
    return static_cast<size_t>(end_it_ - current_it_);
}

// BufferEscapingReader 实现
template<typename BufferType>
BufferEscapingReader<BufferType>::BufferEscapingReader(Iterator begin_it, Iterator end_it)
    : begin_it_(begin_it), end_it_(end_it), current_it_(begin_it), has_error_(false)
{
}

template<typename BufferType>
int BufferEscapingReader<BufferType>::read(char* data, size_t length)
{
    if (!data || length == 0) {
        return 0;
    }
    
    size_t bytes_read = 0;
    
    while (bytes_read < length && current_it_ != end_it_) {
        uint8_t byte = static_cast<uint8_t>(*current_it_);
        
        // 检查是否是填充字节
        if (byte == STUFF_BYTE && current_it_ != begin_it_) {
            // 获取前一个字节
            Iterator prev_it = current_it_ - 1;
            uint8_t prev_byte = static_cast<uint8_t>(*prev_it);
            if (prev_byte == 0xAA || prev_byte == 0x55) {
                // 这是一个合法的填充字节，跳过它
                ++current_it_;
                continue;
            } else {
                // 异常：填充字节前面不是需要填充的字节
                has_error_ = true;
                return -1;
            }
        }
        
        // 普通数据字节
        data[bytes_read] = static_cast<char>(byte);
        ++bytes_read;
        ++current_it_;
    }
    
    return static_cast<int>(bytes_read);
}

template<typename BufferType>
bool BufferEscapingReader<BufferType>::seek(size_t offset)
{
    Iterator it = begin_it_ + static_cast<typename Iterator::difference_type>(offset);
    if (it <= end_it_) {
        current_it_ = it;
        has_error_ = false;
        return true;
    }
    return false;
}

template<typename BufferType>
size_t BufferEscapingReader<BufferType>::tell() const
{
    return static_cast<size_t>(current_it_ - begin_it_);
}

template<typename BufferType>
bool BufferEscapingReader<BufferType>::is_empty() const
{
    return current_it_ == end_it_;
}

template<typename BufferType>
bool BufferEscapingReader<BufferType>::find_start()
{
    while (current_it_ + 1 < end_it_) {
        if (static_cast<uint8_t>(*current_it_) == START_MARK1 && 
            static_cast<uint8_t>(*(current_it_ + 1)) == START_MARK2) {
            current_it_ += 2;
            has_error_ = false;
            return true;
        }
        ++current_it_;
    }
    
    return false;
}

template<typename BufferType>
bool BufferEscapingReader<BufferType>::find_end()
{
    Iterator search_it = current_it_;
    
    while (search_it + 1 < end_it_) {
        uint8_t byte1 = static_cast<uint8_t>(*search_it);
        uint8_t byte2 = static_cast<uint8_t>(*(search_it + 1));
        
        if (byte1 == END_MARK1 && byte2 == END_MARK2) {
            current_it_ = search_it + 2;
            return true;
        }
        
        // 跳过填充字节
        if (byte2 == STUFF_BYTE && (byte1 == 0xAA || byte1 == 0x55)) {
            search_it += 2; // 跳过原字节和填充字节
        } else {
            search_it += 1;
        }
    }
    
    return false;
}

template<typename BufferType>
size_t BufferEscapingReader<BufferType>::available() const
{
    return static_cast<size_t>(end_it_ - current_it_);
}

// BufferEscapingWriter 实现
template<typename BufferType>
BufferEscapingWriter<BufferType>::BufferEscapingWriter(Iterator begin_it, Iterator end_it)
    : begin_it_(begin_it), end_it_(end_it), current_it_(begin_it), has_error_(false)
{
}

template<typename BufferType>
int BufferEscapingWriter<BufferType>::write(const char* data, size_t length)
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

template<typename BufferType>
bool BufferEscapingWriter<BufferType>::write_start()
{
    if (current_it_ + 1 >= end_it_) {
        has_error_ = true;
        return false;
    }
    
    *current_it_ = static_cast<char>(START_MARK1);
    ++current_it_;
    *current_it_ = static_cast<char>(START_MARK2);
    ++current_it_;
    
    return true;
}

template<typename BufferType>
bool BufferEscapingWriter<BufferType>::write_end()
{
    if (current_it_ + 1 >= end_it_) {
        has_error_ = true;
        return false;
    }
    
    *current_it_ = static_cast<char>(END_MARK1);
    ++current_it_;
    *current_it_ = static_cast<char>(END_MARK2);
    ++current_it_;
    
    return true;
}

template<typename BufferType>
bool BufferEscapingWriter<BufferType>::seek(size_t offset)
{
    Iterator it = begin_it_ + static_cast<typename Iterator::difference_type>(offset);
    if (it <= end_it_) {
        current_it_ = it;
        has_error_ = false;
        return true;
    }
    return false;
}

template<typename BufferType>
size_t BufferEscapingWriter<BufferType>::tell() const
{
    return static_cast<size_t>(current_it_ - begin_it_);
}

template<typename BufferType>
bool BufferEscapingWriter<BufferType>::is_full() const
{
    return current_it_ == end_it_;
}

template<typename BufferType>
size_t BufferEscapingWriter<BufferType>::space() const
{
    return static_cast<size_t>(end_it_ - current_it_);
}

template<typename BufferType>
bool BufferEscapingWriter<BufferType>::write_stuffed_byte(uint8_t byte)
{
    if (current_it_ == end_it_) {
        return false; // 缓冲区已满
    }
    
    // 写入原字节
    *current_it_ = static_cast<char>(byte);
    ++current_it_;
    
    // 检查是否需要填充
    if (needs_stuffing(byte)) {
        if (current_it_ == end_it_) {
            has_error_ = true;
            return false; // 空间不足写入填充字节
        }
        
        // 写入填充字节
        *current_it_ = static_cast<char>(STUFF_BYTE);
        ++current_it_;
    }
    
    return true;
}

template<typename BufferType>
bool BufferEscapingWriter<BufferType>::needs_stuffing(uint8_t byte) const
{
    return (byte == 0xAA || byte == 0x55);
}

#endif // BUFFER_HELPERS_HPP