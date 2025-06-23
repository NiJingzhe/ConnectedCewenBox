#ifndef SERDES_HPP
#define SERDES_HPP

#include <cstdint>
#include "utils/tlv.hpp"
#include "utils/buffer.hpp"

class TLVSerializer
{
public:
    TLVSerializer(BufferWriter& writer);

};

#endif // SERDES_HPP