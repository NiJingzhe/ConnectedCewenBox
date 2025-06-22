#ifndef CIRCULAR_BUFFER_HPP
#define CIRCULAR_BUFFER_HPP

#include <cstddef>
#include <iterator>

class CircularBuffer
{
public:
    class Iterator;
    
    // 构造函数
    explicit CircularBuffer(char* buffer, size_t length);
    
    // 获取指定位置的迭代器（会自动取模）
    Iterator at(size_t position);
    
    // 获取缓冲区大小
    size_t size() const { return length_; }
    
    // 获取开始和结束迭代器
    Iterator begin();
    Iterator end();
    
    // 迭代器类
    class Iterator
    {
    public:
        using iterator_category = std::random_access_iterator_tag;
        using value_type = char;
        using difference_type = std::ptrdiff_t;
        using pointer = char*;
        using reference = char&;
        
        // 构造函数
        Iterator(CircularBuffer* buffer, size_t position);
        
        // 创建无效迭代器的构造函数
        Iterator(CircularBuffer* buffer, bool is_end);
        
        // 解引用操作
        reference operator*() const;
        pointer operator->() const;
        
        // 前置递增/递减
        Iterator& operator++();
        Iterator& operator--();
        
        // 后置递增/递减
        Iterator operator++(int);
        Iterator operator--(int);
        
        // 随机访问操作
        Iterator& operator+=(difference_type n);
        Iterator& operator-=(difference_type n);
        Iterator operator+(difference_type n) const;
        Iterator operator-(difference_type n) const;
        
        // 比较操作
        bool operator==(const Iterator& other) const;
        bool operator!=(const Iterator& other) const;
        bool operator<(const Iterator& other) const;
        bool operator<=(const Iterator& other) const;
        bool operator>(const Iterator& other) const;
        bool operator>=(const Iterator& other) const;
        
        // 距离计算
        difference_type operator-(const Iterator& other) const;
        
        // 下标访问
        reference operator[](difference_type n) const;
        
        // 检查是否为有效迭代器
        bool is_valid() const { return !is_end_; }
        
    private:
        CircularBuffer* buffer_;
        size_t position_;
        bool is_end_;  // 标记是否为end迭代器
    };
    
private:
    char* buf_;
    size_t length_;
};

// 友元函数声明
CircularBuffer::Iterator operator+(CircularBuffer::Iterator::difference_type n, 
                                  const CircularBuffer::Iterator& it);

class LinearBuffer
{
public:
    class Iterator;
    
    // 构造函数
    explicit LinearBuffer(char* buffer, size_t length);
    
    // 获取指定位置的迭代器（会检查边界）
    Iterator at(size_t position);
    
    // 获取缓冲区大小
    size_t size() const { return length_; }
    
    // 获取开始和结束迭代器
    Iterator begin();
    Iterator end();
    
    // 迭代器类
    class Iterator
    {
    public:
        using iterator_category = std::random_access_iterator_tag;
        using value_type = char;
        using difference_type = std::ptrdiff_t;
        using pointer = char*;
        using reference = char&;
        
        // 构造函数
        Iterator(LinearBuffer* buffer, size_t position);
        
        // 创建无效迭代器的构造函数
        Iterator(LinearBuffer* buffer, bool is_end);
        
        // 解引用操作
        reference operator*() const;
        pointer operator->() const;
        
        // 前置递增/递减
        Iterator& operator++();
        Iterator& operator--();
        
        // 后置递增/递减
        Iterator operator++(int);
        Iterator operator--(int);
        
        // 随机访问操作
        Iterator& operator+=(difference_type n);
        Iterator& operator-=(difference_type n);
        Iterator operator+(difference_type n) const;
        Iterator operator-(difference_type n) const;
        
        // 比较操作
        bool operator==(const Iterator& other) const;
        bool operator!=(const Iterator& other) const;
        bool operator<(const Iterator& other) const;
        bool operator<=(const Iterator& other) const;
        bool operator>(const Iterator& other) const;
        bool operator>=(const Iterator& other) const;
        
        // 距离计算
        difference_type operator-(const Iterator& other) const;
        
        // 下标访问
        reference operator[](difference_type n) const;
        
        // 检查是否为有效迭代器
        bool is_valid() const { return !is_end_ && position_ < buffer_->length_; }
        
    private:
        LinearBuffer* buffer_;
        size_t position_;
        bool is_end_;  // 标记是否为end迭代器
    };
    
private:
    char* buf_;
    size_t length_;
};

// 友元函数声明
LinearBuffer::Iterator operator+(LinearBuffer::Iterator::difference_type n, 
                                const LinearBuffer::Iterator& it);


#endif // CIRCULAR_BUFFER_HPP