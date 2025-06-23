#ifndef __DS18B20_H 
#define __DS18B20_H 

#include <stdint.h>

// 时间系统函数声明
uint32_t micros(void);
void delay_us(uint32_t delay_time);

// DS18B20函数声明
uint8_t DS18B20_Init(void);
short DS18B20_Get_Temp(void);
void DS18B20_Start(void);
void DS18B20_Write_Byte(uint8_t dat);
uint8_t DS18B20_Read_Byte(void);
uint8_t DS18B20_Read_Bit(void);
uint8_t DS18B20_Check(void);
void DS18B20_Rst(void);
void DS18B20_Tem_Transfer(void);

#endif
