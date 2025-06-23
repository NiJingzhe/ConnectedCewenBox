#include "utils/buffer.hpp"
#include <algorithm>
#include <cstring>

// BufferReader implementations

BufferReader::BufferReader(const char *begin, const char *end)
    : begin_(begin), end_(end), current_(begin)
{
}

BufferReader::BufferReader(const char *begin, size_t length)
    : begin_(begin), end_(begin + length), current_(begin)
{
}

int BufferReader::read_raw(char *buf, size_t len)
{
    size_t available_bytes = available();
    if (len > available_bytes)
    {
        len = available_bytes;
    }
    
    if (len == 0)
        return -1;
    
    std::copy(current_, current_ + len, buf);
    current_ += len;
    return static_cast<int>(len);
}

int BufferReader::peek_raw(char *buf, size_t len) const
{
    size_t available_bytes = available();
    if (len > available_bytes)
    {
        len = available_bytes;
    }
    
    if (len == 0)
        return -1;
    
    std::copy(current_, current_ + len, buf);
    return static_cast<int>(len);
}

int BufferReader::read(char &ch)
{
    if (is_end())
        return -1;
    
    ch = *current_;
    current_++;
    return 1;
}

int BufferReader::peek(char &ch) const
{
    if (is_end())
        return -1;
    
    ch = *current_;
    return 1;
}

size_t BufferReader::tell() const
{
    return current_ - begin_;
}

size_t BufferReader::available() const
{
    return end_ - current_;
}

bool BufferReader::is_end() const
{
    return current_ >= end_;
}

void BufferReader::seek(size_t pos)
{
    const char *new_pos = begin_ + pos;
    if (new_pos >= begin_ && new_pos <= end_)
    {
        current_ = new_pos;
    }
}

void BufferReader::reset()
{
    current_ = begin_;
}

void BufferReader::shift(signed long pos)
{
    const char *new_pos = current_ + pos;
    if (new_pos >= begin_ && new_pos <= end_)
    {
        current_ = new_pos;
    }
}

// BufferWriter implementations

BufferWriter::BufferWriter(char *begin, char *end)
    : begin_(begin), end_(end), current_(begin)
{
}

BufferWriter::BufferWriter(char *begin, size_t length)
    : begin_(begin), end_(begin + length), current_(begin)
{
}

int BufferWriter::write_raw(const char *buf, size_t len)
{
    size_t available_space = available();
    if (len > available_space)
    {
        len = available_space;
    }
    
    if (len == 0)
        return -1;
    
    std::copy(buf, buf + len, current_);
    current_ += len;
    return static_cast<int>(len);
}

int BufferWriter::write_raw(const void *buf, size_t len)
{
    return write_raw(static_cast<const char *>(buf), len);
}

int BufferWriter::write(char ch)
{
    if (is_end())
        return -1;
    
    *current_ = ch;
    current_++;
    return 1;
}

size_t BufferWriter::tell() const
{
    return current_ - begin_;
}

size_t BufferWriter::available() const
{
    return end_ - current_;
}

bool BufferWriter::is_end() const
{
    return current_ >= end_;
}

void BufferWriter::seek(size_t pos)
{
    char *new_pos = begin_ + pos;
    if (new_pos >= begin_ && new_pos <= end_)
    {
        current_ = new_pos;
    }
}

void BufferWriter::reset()
{
    current_ = begin_;
}

void BufferWriter::shift(signed long pos)
{
    char *new_pos = current_ + pos;
    if (new_pos >= begin_ && new_pos <= end_)
    {
        current_ = new_pos;
    }
}