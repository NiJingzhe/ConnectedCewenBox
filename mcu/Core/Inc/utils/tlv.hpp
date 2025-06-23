#ifndef TLV_HPP
#define TLV_HPP

#include <cstdint>

class TLV
{
public:
    uint16_t tag;
    uint16_t length;
    void *value;

    TLV(char *buf);
    TLV(uint16_t tag, uint16_t length, void *value);
    void read(char *buf);
};

#endif // TLV_HPP