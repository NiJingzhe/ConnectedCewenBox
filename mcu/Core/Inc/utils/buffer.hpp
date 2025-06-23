#ifndef BUFFER_NORMAL_HPP
#define BUFFER_NORMAL_HPP

#include <cstddef>
#include <cstdint>
#include <bit>
#include <algorithm>

/**
 * @file buffer_normal.hpp
 * @brief 缓冲区操作辅助类集合
 * @details 提供了一套直接操作原始缓冲区的读写类
 * @author Chauncey Ma
 * @date 2025年6月23日
 */

/**
 * @brief 缓冲区读取器
 * @details 直接操作原始缓冲区的顺序读取功能，支持位置控制和状态查询。
 *          使用小端字节序进行数据读取。
 */
class BufferReader
{
public:
    /** @brief 字节序配置，默认为小端序 */
    static const auto endian = std::endian::little;

    /**
     * @brief 构造函数
     * @param begin 缓冲区起始指针
     * @param end 缓冲区结束指针
     */
    BufferReader(const char *begin, const char *end);
    
    /**
     * @brief 构造函数
     * @param begin 缓冲区起始指针
     * @param length 缓冲区长度
     */
    BufferReader(const char *begin, size_t length);
    
    /**
     * @brief 读取原始数据
     * @param buf 目标缓冲区
     * @param len 要读取的字节数
     * @return 实际读取的字节数，失败返回-1
     */
    int read_raw(char *buf, size_t len);
    
    /**
     * @brief 预览原始数据（不移动读取位置）
     * @param buf 目标缓冲区
     * @param len 要预览的字节数
     * @return 实际预览的字节数，失败返回-1
     */
    int peek_raw(char *buf, size_t len) const;
    
    /**
     * @brief 读取单个字符
     * @param ch 输出字符
     * @return 成功返回1，失败返回-1
     */
    int read(char &ch);
    
    /**
     * @brief 读取类型化数据
     * @tparam T 数据类型
     * @param value 输出值
     * @return 成功返回读取字节数，失败返回-1
     */
    template <typename T>
    int read(T &value);
    
    /**
     * @brief 预览单个字符（不移动读取位置）
     * @param ch 输出字符
     * @return 成功返回1，失败返回-1
     */
    int peek(char &ch) const;
    
    /**
     * @brief 预览类型化数据（不移动读取位置）
     * @tparam T 数据类型
     * @param value 输出值
     * @return 成功返回数据字节数，失败返回-1
     */
    template <typename T>
    int peek(T &value) const;
    
    /**
     * @brief 获取当前读取位置
     * @return 相对于缓冲区起始位置的偏移量
     */
    size_t tell() const;
    
    /**
     * @brief 获取可用（剩余）字节数
     * @return 剩余可读取的字节数
     */
    size_t available() const;
    
    /**
     * @brief 检查是否已到达缓冲区末尾
     * @return true表示已到末尾，false表示还有数据可读
     */
    bool is_end() const;
    
    /**
     * @brief 设置读取位置
     * @param pos 相对于缓冲区起始位置的绝对偏移量
     */
    void seek(size_t pos);
    
    /**
     * @brief 重置读取位置到缓冲区开始
     */
    void reset();
    
    /**
     * @brief 相对移动读取位置
     * @param pos 相对偏移量，正数向前，负数向后
     */
    void shift(signed long pos);

private:
    const char *begin_;   ///< 缓冲区起始指针
    const char *end_;     ///< 缓冲区结束指针
    const char *current_; ///< 当前读取位置指针
};

/**
 * @brief 缓冲区写入器
 * @details 直接操作原始缓冲区的顺序写入功能，支持位置控制和状态查询。
 *          使用小端字节序进行数据写入。
 */
class BufferWriter
{
public:
    /** @brief 字节序配置，默认为小端序 */
    static const auto endian = std::endian::little;

    /**
     * @brief 构造函数
     * @param begin 缓冲区起始指针
     * @param end 缓冲区结束指针
     */
    BufferWriter(char *begin, char *end);
    
    /**
     * @brief 构造函数
     * @param begin 缓冲区起始指针
     * @param length 缓冲区长度
     */
    BufferWriter(char *begin, size_t length);
    
    /**
     * @brief 写入原始字符数据
     * @param buf 源数据缓冲区
     * @param len 要写入的字节数
     * @return 实际写入的字节数，失败返回-1
     */
    int write_raw(const char *buf, size_t len);
    
    /**
     * @brief 写入原始void数据
     * @param buf 源数据缓冲区
     * @param len 要写入的字节数
     * @return 实际写入的字节数，失败返回-1
     */
    int write_raw(const void *buf, size_t len);
    
    /**
     * @brief 写入单个字符
     * @param ch 要写入的字符
     * @return 成功返回1，失败返回-1
     */
    int write(char ch);
    
    /**
     * @brief 写入类型化数据
     * @tparam T 数据类型
     * @param value 要写入的值
     * @return 成功返回写入字节数，失败返回-1
     */
    template <typename T>
    int write(const T &value);
    
    /**
     * @brief 获取当前写入位置
     * @return 相对于缓冲区起始位置的偏移量
     */
    size_t tell() const;
    
    /**
     * @brief 获取可用（剩余）空间字节数
     * @return 剩余可写入的字节数
     */
    size_t available() const;
    
    /**
     * @brief 检查是否已到达缓冲区末尾
     * @return true表示已到末尾，false表示还有space可写
     */
    bool is_end() const;
    
    /**
     * @brief 设置写入位置
     * @param pos 相对于缓冲区起始位置的绝对偏移量
     */
    void seek(size_t pos);
    
    /**
     * @brief 重置写入位置到缓冲区开始
     */
    void reset();
    
    /**
     * @brief 相对移动写入位置
     * @param pos 相对偏移量，正数向前，负数向后
     */
    void shift(signed long pos);

private:
    char *begin_;   ///< 缓冲区起始指针
    char *end_;     ///< 缓冲区结束指针
    char *current_; ///< 当前写入位置指针
};

// Template implementations
template <typename T>
int BufferReader::peek(T &value) const
{
    if (sizeof(T) > available())
        return -1; // Not enough data

    if constexpr (std::endian::native == endian)
    {
        std::copy(current_, current_ + sizeof(T), reinterpret_cast<char *>(&value));
    }
    else
    {
        std::reverse_copy(current_, current_ + sizeof(T), reinterpret_cast<char *>(&value));
    }
    return sizeof(T);
}

template <typename T>
int BufferReader::read(T &value)
{
    auto len = peek(value);
    if (len > 0)
    {
        current_ += len;
    }
    return len;
}

template <typename T>
int BufferWriter::write(const T &value)
{
    if (sizeof(T) > available())
        return -1; // Not enough space
        
    if constexpr (std::endian::native == endian)
    {
        std::copy(reinterpret_cast<const char *>(&value),
                  reinterpret_cast<const char *>(&value) + sizeof(T), current_);
    }
    else
    {
        std::reverse_copy(reinterpret_cast<const char *>(&value),
                          reinterpret_cast<const char *>(&value) + sizeof(T), current_);
    }

    current_ += sizeof(T);
    return sizeof(T);
}

#endif // BUFFER_NORMAL_HPP