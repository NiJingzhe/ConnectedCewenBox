#include "utils/buffers.hpp"

// CircularBuffer 实现
CircularBuffer::CircularBuffer(char* buffer, size_t length)
    : buf_(buffer), length_(length)
{
}

CircularBuffer::Iterator CircularBuffer::at(size_t position)
{
    return Iterator(this, position % length_);
}

CircularBuffer::Iterator CircularBuffer::begin()
{
    return Iterator(this, (size_t)0);
}

CircularBuffer::Iterator CircularBuffer::end()
{
    return Iterator(this, true);  // 创建无效的end迭代器
}

// Iterator 实现
CircularBuffer::Iterator::Iterator(CircularBuffer* buffer, size_t position)
    : buffer_(buffer), position_(position % buffer->length_), is_end_(false)
{
}

CircularBuffer::Iterator::Iterator(CircularBuffer* buffer, bool is_end)
    : buffer_(buffer), position_(0), is_end_(is_end)
{
}

CircularBuffer::Iterator::reference CircularBuffer::Iterator::operator*() const
{
    if (is_end_) {
        // 对end迭代器解引用是未定义行为，这里抛出异常或返回第一个元素
        // 为了安全起见，返回第一个元素的引用
        return buffer_->buf_[0];
    }
    return buffer_->buf_[position_];
}

CircularBuffer::Iterator::pointer CircularBuffer::Iterator::operator->() const
{
    if (is_end_) {
        return &buffer_->buf_[0];
    }
    return &buffer_->buf_[position_];
}

CircularBuffer::Iterator& CircularBuffer::Iterator::operator++()
{
    if (is_end_) {
        return *this;  // end迭代器不能递增
    }
    position_ = (position_ + 1) % buffer_->length_;
    return *this;
}

CircularBuffer::Iterator& CircularBuffer::Iterator::operator--()
{
    if (is_end_) {
        // end迭代器递减变为最后一个有效位置
        is_end_ = false;
        position_ = buffer_->length_ - 1;
    } else {
        position_ = (position_ == 0) ? buffer_->length_ - 1 : position_ - 1;
    }
    return *this;
}

CircularBuffer::Iterator CircularBuffer::Iterator::operator++(int)
{
    Iterator temp = *this;
    ++(*this);
    return temp;
}

CircularBuffer::Iterator CircularBuffer::Iterator::operator--(int)
{
    Iterator temp = *this;
    --(*this);
    return temp;
}

CircularBuffer::Iterator& CircularBuffer::Iterator::operator+=(difference_type n)
{
    if (is_end_) {
        if (n < 0) {
            // end迭代器向后移动
            is_end_ = false;
            position_ = buffer_->length_ - 1;
            *this += (n + 1);  // 递归处理剩余的移动
        }
        return *this;
    }
    
    if (n >= 0) {
        position_ = (position_ + static_cast<size_t>(n)) % buffer_->length_;
    } else {
        size_t abs_n = static_cast<size_t>(-n);
        size_t cycles = abs_n / buffer_->length_;
        size_t remainder = abs_n % buffer_->length_;
        
        if (remainder <= position_) {
            position_ -= remainder;
        } else {
            position_ = buffer_->length_ - (remainder - position_);
        }
    }
    return *this;
}

CircularBuffer::Iterator& CircularBuffer::Iterator::operator-=(difference_type n)
{
    return *this += (-n);
}

CircularBuffer::Iterator CircularBuffer::Iterator::operator+(difference_type n) const
{
    Iterator result = *this;
    result += n;
    return result;
}

CircularBuffer::Iterator CircularBuffer::Iterator::operator-(difference_type n) const
{
    Iterator result = *this;
    result -= n;
    return result;
}

bool CircularBuffer::Iterator::operator==(const Iterator& other) const
{
    if (buffer_ != other.buffer_) {
        return false;
    }
    if (is_end_ && other.is_end_) {
        return true;
    }
    if (is_end_ != other.is_end_) {
        return false;
    }
    return position_ == other.position_;
}

bool CircularBuffer::Iterator::operator!=(const Iterator& other) const
{
    return !(*this == other);
}

bool CircularBuffer::Iterator::operator<(const Iterator& other) const
{
    if (buffer_ != other.buffer_) {
        return false;
    }
    if (is_end_ && !other.is_end_) {
        return false;  // end迭代器不小于任何有效迭代器
    }
    if (!is_end_ && other.is_end_) {
        return true;   // 有效迭代器总是小于end迭代器
    }
    if (is_end_ && other.is_end_) {
        return false;  // 两个end迭代器相等
    }
    return position_ < other.position_;
}

bool CircularBuffer::Iterator::operator<=(const Iterator& other) const
{
    return *this < other || *this == other;
}

bool CircularBuffer::Iterator::operator>(const Iterator& other) const
{
    return !(*this <= other);
}

bool CircularBuffer::Iterator::operator>=(const Iterator& other) const
{
    return !(*this < other);
}

CircularBuffer::Iterator::difference_type CircularBuffer::Iterator::operator-(const Iterator& other) const
{
    if (buffer_ != other.buffer_) {
        return 0; // 不同缓冲区的迭代器距离为0
    }
    
    if (is_end_ && other.is_end_) {
        return 0;
    }
    if (is_end_ && !other.is_end_) {
        return static_cast<difference_type>(buffer_->length_ - other.position_);
    }
    if (!is_end_ && other.is_end_) {
        return -static_cast<difference_type>(buffer_->length_ - position_);
    }
    
    if (position_ >= other.position_) {
        return static_cast<difference_type>(position_ - other.position_);
    } else {
        return static_cast<difference_type>(buffer_->length_ - (other.position_ - position_));
    }
}

CircularBuffer::Iterator::reference CircularBuffer::Iterator::operator[](difference_type n) const
{
    return *(*this + n);
}

// 友元函数实现
CircularBuffer::Iterator operator+(CircularBuffer::Iterator::difference_type n, 
                                  const CircularBuffer::Iterator& it)
{
    return it + n;
}

// LinearBuffer 实现
LinearBuffer::LinearBuffer(char* buffer, size_t length)
    : buf_(buffer), length_(length)
{
}

LinearBuffer::Iterator LinearBuffer::at(size_t position)
{
    if (position >= length_) {
        // 超出边界，返回end迭代器
        return end();
    }
    return Iterator(this, position);
}

LinearBuffer::Iterator LinearBuffer::begin()
{
    return Iterator(this, static_cast<size_t>(0));
}

LinearBuffer::Iterator LinearBuffer::end()
{
    return Iterator(this, true);  // 创建无效的end迭代器
}

// Iterator 实现
LinearBuffer::Iterator::Iterator(LinearBuffer* buffer, size_t position)
    : buffer_(buffer), position_(position), is_end_(false)
{
    // 如果位置超出边界，设置为end迭代器
    if (position >= buffer->length_) {
        is_end_ = true;
        position_ = buffer->length_;
    }
}

LinearBuffer::Iterator::Iterator(LinearBuffer* buffer, bool is_end)
    : buffer_(buffer), position_(buffer->length_), is_end_(is_end)
{
}

LinearBuffer::Iterator::reference LinearBuffer::Iterator::operator*() const
{
    if (is_end_ || position_ >= buffer_->length_) {
        // 对end迭代器或超出边界的位置解引用是未定义行为
        // 为了安全起见，返回最后一个元素的引用
        return buffer_->buf_[buffer_->length_ - 1];
    }
    return buffer_->buf_[position_];
}

LinearBuffer::Iterator::pointer LinearBuffer::Iterator::operator->() const
{
    if (is_end_ || position_ >= buffer_->length_) {
        return &buffer_->buf_[buffer_->length_ - 1];
    }
    return &buffer_->buf_[position_];
}

LinearBuffer::Iterator& LinearBuffer::Iterator::operator++()
{
    if (is_end_) {
        return *this;  // end迭代器不能递增
    }
    
    ++position_;
    if (position_ >= buffer_->length_) {
        is_end_ = true;
        position_ = buffer_->length_;
    }
    return *this;
}

LinearBuffer::Iterator& LinearBuffer::Iterator::operator--()
{
    if (is_end_) {
        // end迭代器递减变为最后一个有效位置
        if (buffer_->length_ > 0) {
            is_end_ = false;
            position_ = buffer_->length_ - 1;
        }
    } else if (position_ > 0) {
        --position_;
    }
    return *this;
}

LinearBuffer::Iterator LinearBuffer::Iterator::operator++(int)
{
    Iterator temp = *this;
    ++(*this);
    return temp;
}

LinearBuffer::Iterator LinearBuffer::Iterator::operator--(int)
{
    Iterator temp = *this;
    --(*this);
    return temp;
}

LinearBuffer::Iterator& LinearBuffer::Iterator::operator+=(difference_type n)
{
    if (is_end_) {
        if (n < 0 && buffer_->length_ > 0) {
            // end迭代器向后移动
            is_end_ = false;
            position_ = buffer_->length_ - 1;
            *this += (n + 1);  // 递归处理剩余的移动
        }
        return *this;
    }
    
    if (n >= 0) {
        position_ += static_cast<size_t>(n);
        if (position_ >= buffer_->length_) {
            is_end_ = true;
            position_ = buffer_->length_;
        }
    } else {
        size_t abs_n = static_cast<size_t>(-n);
        if (abs_n <= position_) {
            position_ -= abs_n;
        } else {
            position_ = 0;  // 不能小于0，设置为开始位置
        }
    }
    return *this;
}

LinearBuffer::Iterator& LinearBuffer::Iterator::operator-=(difference_type n)
{
    return *this += (-n);
}

LinearBuffer::Iterator LinearBuffer::Iterator::operator+(difference_type n) const
{
    Iterator result = *this;
    result += n;
    return result;
}

LinearBuffer::Iterator LinearBuffer::Iterator::operator-(difference_type n) const
{
    Iterator result = *this;
    result -= n;
    return result;
}

bool LinearBuffer::Iterator::operator==(const Iterator& other) const
{
    if (buffer_ != other.buffer_) {
        return false;
    }
    if (is_end_ && other.is_end_) {
        return true;
    }
    if (is_end_ != other.is_end_) {
        return false;
    }
    return position_ == other.position_;
}

bool LinearBuffer::Iterator::operator!=(const Iterator& other) const
{
    return !(*this == other);
}

bool LinearBuffer::Iterator::operator<(const Iterator& other) const
{
    if (buffer_ != other.buffer_) {
        return false;
    }
    if (is_end_ && !other.is_end_) {
        return false;  // end迭代器不小于任何有效迭代器
    }
    if (!is_end_ && other.is_end_) {
        return true;   // 有效迭代器总是小于end迭代器
    }
    if (is_end_ && other.is_end_) {
        return false;  // 两个end迭代器相等
    }
    return position_ < other.position_;
}

bool LinearBuffer::Iterator::operator<=(const Iterator& other) const
{
    return *this < other || *this == other;
}

bool LinearBuffer::Iterator::operator>(const Iterator& other) const
{
    return !(*this <= other);
}

bool LinearBuffer::Iterator::operator>=(const Iterator& other) const
{
    return !(*this < other);
}

LinearBuffer::Iterator::difference_type LinearBuffer::Iterator::operator-(const Iterator& other) const
{
    if (buffer_ != other.buffer_) {
        return 0; // 不同缓冲区的迭代器距离为0
    }
    
    if (is_end_ && other.is_end_) {
        return 0;
    }
    if (is_end_ && !other.is_end_) {
        return static_cast<difference_type>(buffer_->length_ - other.position_);
    }
    if (!is_end_ && other.is_end_) {
        return static_cast<difference_type>(position_) - static_cast<difference_type>(buffer_->length_);
    }
    
    return static_cast<difference_type>(position_) - static_cast<difference_type>(other.position_);
}

LinearBuffer::Iterator::reference LinearBuffer::Iterator::operator[](difference_type n) const
{
    return *(*this + n);
}

// 友元函数实现
LinearBuffer::Iterator operator+(LinearBuffer::Iterator::difference_type n, 
                                const LinearBuffer::Iterator& it)
{
    return it + n;
}