#include "DS18B20.h"

#include "stm32f1xx_hal.h"
#include "FreeRTOS.h"
#include "task.h"

// GPIO引脚定义
#define DS18B20_GPIO_Port   GPIOG
#define DS18B20_GPIO_Pin    GPIO_PIN_11

// IO操作宏
#define DS18B20_DQ_OUT_HIGH()   HAL_GPIO_WritePin(DS18B20_GPIO_Port, DS18B20_GPIO_Pin, GPIO_PIN_SET)
#define DS18B20_DQ_OUT_LOW()    HAL_GPIO_WritePin(DS18B20_GPIO_Port, DS18B20_GPIO_Pin, GPIO_PIN_RESET)
#define DS18B20_DQ_IN()         HAL_GPIO_ReadPin(DS18B20_GPIO_Port, DS18B20_GPIO_Pin)

// 微秒时间系统实现
__STATIC_INLINE uint32_t GXT_SYSTICK_IsActiveCounterFlag(void)
{
  return ((SysTick->CTRL & SysTick_CTRL_COUNTFLAG_Msk) == (SysTick_CTRL_COUNTFLAG_Msk));
}

static uint32_t getCurrentMicros(void)
{
  /* Ensure COUNTFLAG is reset by reading SysTick control and status register */
  GXT_SYSTICK_IsActiveCounterFlag();
  uint32_t m = HAL_GetTick();
  const uint32_t tms = SysTick->LOAD + 1;
  __IO uint32_t u = tms - SysTick->VAL;
  if (GXT_SYSTICK_IsActiveCounterFlag()) {
    m = HAL_GetTick();
    u = tms - SysTick->VAL;
  }
  return (m * 1000 + (u * 1000) / tms);
}

//获取系统时间，单位us
uint32_t micros(void)
{
  return getCurrentMicros();
}

// 微秒延时函数（基于系统微秒计时器）
void delay_us(uint32_t delay_time)
{
	uint32_t start_time = micros();
	while((micros() - start_time) < delay_time);
}
// GPIO方向配置函数 - 使用HAL库方式
static void DS18B20_IO_IN(void) {
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = DS18B20_GPIO_Pin;
    GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
    GPIO_InitStruct.Pull = GPIO_PULLUP;
    HAL_GPIO_Init(DS18B20_GPIO_Port, &GPIO_InitStruct);
}

static void DS18B20_IO_OUT(void) {
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = DS18B20_GPIO_Pin;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(DS18B20_GPIO_Port, &GPIO_InitStruct);
}

// 使用头文件中已定义的IO操作宏
// #define DS18B20_DQ_OUT(x) HAL_GPIO_WritePin(DS18B20_GPIO_Port, DS18B20_GPIO_Pin, (x) ? GPIO_PIN_SET : GPIO_PIN_RESET)
// #define DS18B20_DQ_IN()   HAL_GPIO_ReadPin(DS18B20_GPIO_Port, DS18B20_GPIO_Pin)

// 复位DS18B20
void DS18B20_Rst(void) {
    UBaseType_t uxSavedInterruptStatus;
    
    DS18B20_IO_OUT();           // 设置为输出模式
    
    // 进入临界段，禁止中断和任务切换
    uxSavedInterruptStatus = taskENTER_CRITICAL_FROM_ISR();
    
    DS18B20_DQ_OUT_LOW();       // 拉低DQ
    delay_us(480);              // 拉低480us (标准复位脉宽)
    DS18B20_DQ_OUT_HIGH();      // 释放总线
    delay_us(15);               // 等待15us
    
    // 退出临界段，恢复中断
    taskEXIT_CRITICAL_FROM_ISR(uxSavedInterruptStatus);
}

// 等待DS18B20的回应
// 返回1:未检测到DS18B20的存在
// 返回0:存在
uint8_t DS18B20_Check(void) {
    uint8_t retry = 0;
    UBaseType_t uxSavedInterruptStatus;
    
    DS18B20_IO_IN(); // 设置为输入模式
    
    // 进入临界段保护检测时序
    uxSavedInterruptStatus = taskENTER_CRITICAL_FROM_ISR();
    
    // 等待DS18B20拉低总线（存在脉冲开始）
    while (DS18B20_DQ_IN() && retry < 200) {
        retry++;
        delay_us(1);
    }
    if (retry >= 200) {
        taskEXIT_CRITICAL_FROM_ISR(uxSavedInterruptStatus);
        return 1; // 超时，DS18B20不存在
    }
    
    retry = 0;
    // 等待DS18B20释放总线（存在脉冲结束）
    while (!DS18B20_DQ_IN() && retry < 240) {
        retry++;
        delay_us(1);
    }
    
    // 退出临界段
    taskEXIT_CRITICAL_FROM_ISR(uxSavedInterruptStatus);
    
    if (retry >= 240) return 1; // 超时
    
    return 0; // DS18B20存在
}

// 从DS18B20读取一个位
// 返回值：1/0
uint8_t DS18B20_Read_Bit(void) {
    uint8_t data;
    UBaseType_t uxSavedInterruptStatus;
    
    DS18B20_IO_OUT();           // 设置为输出模式
    
    // 进入临界段保护读时序
    uxSavedInterruptStatus = taskENTER_CRITICAL_FROM_ISR();
    
    DS18B20_DQ_OUT_LOW();       // 拉低总线开始读时序
    delay_us(2);                // 延时2us
    DS18B20_DQ_OUT_HIGH();      // 释放总线
    DS18B20_IO_IN();            // 设置为输入模式
    delay_us(11);               // 延时12us后读取数据
    
    if (DS18B20_DQ_IN()) data = 1;
    else data = 0;
    
    delay_us(50);               // 完成读时序
    
    // 退出临界段
    taskEXIT_CRITICAL_FROM_ISR(uxSavedInterruptStatus);
    
    return data;
}

// 从DS18B20读取一个字节
// 返回值：读到的数据
uint8_t DS18B20_Read_Byte(void) {
    uint8_t i, j, dat;
    dat = 0;
    for (i = 1; i <= 8; i++) {
        j = DS18B20_Read_Bit();
        dat = (j << 7) | (dat >> 1); // LSB first
    }
    return dat;
}

// 写一个字节到DS18B20
// dat：要写入的字节
void DS18B20_Write_Byte(uint8_t dat) {
    uint8_t j;
    uint8_t testb;
    UBaseType_t uxSavedInterruptStatus;
    
    DS18B20_IO_OUT(); // 设置为输出模式
    
    for (j = 1; j <= 8; j++) {
        testb = dat & 0x01;
        dat = dat >> 1;
        
        // 每个位的写入都需要临界段保护
        uxSavedInterruptStatus = taskENTER_CRITICAL_FROM_ISR();
        
        if (testb) { // 写1
            DS18B20_DQ_OUT_LOW();   // 拉低总线
            delay_us(2);            // 拉低2us
            DS18B20_DQ_OUT_HIGH();  // 释放总线
            delay_us(60);           // 保持60us
        } else {                    // 写0
            DS18B20_DQ_OUT_LOW();   // 拉低总线
            delay_us(60);           // 拉低60us
            DS18B20_DQ_OUT_HIGH();  // 释放总线
            delay_us(2);            // 延时2us
        }
        
        // 退出临界段
        taskEXIT_CRITICAL_FROM_ISR(uxSavedInterruptStatus);
    }
}

// 开始温度转换
void DS18B20_Start(void) {
    DS18B20_Rst();              // 复位DS18B20
    if (DS18B20_Check() == 0) { // 检查DS18B20是否存在
        DS18B20_Write_Byte(0xCC); // 跳过ROM命令
        DS18B20_Write_Byte(0x44); // 开始温度转换命令
    }
}

// 初始化DS18B20的IO口，同时检测DS的存在
// 返回1:不存在
// 返回0:存在
uint8_t DS18B20_Init(void) {
    // 使能GPIOG时钟
    __HAL_RCC_GPIOG_CLK_ENABLE();
    
    // 初始化GPIO为推挽输出
    DS18B20_IO_OUT();
    DS18B20_DQ_OUT_HIGH(); // 初始状态拉高
    
    DS18B20_Rst();         // 复位DS18B20
    return DS18B20_Check(); // 检查DS18B20是否存在
}

// 从DS18B20得到温度值
// 精度：0.1°C
// 返回值：温度值 （-550~1250，单位：0.1°C）
short DS18B20_Get_Temp(void) {
    uint8_t temp;
    uint8_t TL, TH;
    short tem;
    
    
    DS18B20_Rst();                     // 复位DS18B20
    if (DS18B20_Check() == 0) {        // 检查DS18B20是否存在
        DS18B20_Write_Byte(0xCC);      // 跳过ROM命令
        DS18B20_Write_Byte(0xBE);      // 读暂存器命令
        TL = DS18B20_Read_Byte();      // LSB
        TH = DS18B20_Read_Byte();      // MSB
        
        if (TH > 7) {                  // 负温度处理
            TH = ~TH;
            TL = ~TL;
            temp = 0;                  // 标记为负温度
        } else {
            temp = 1;                  // 标记为正温度
        }
        
        tem = TH;                      // 获得高八位
        tem <<= 8;
        tem += TL;                     // 获得低八位
        tem = (float)tem * 0.625;      // 转换为实际温度值（0.1°C精度）
        
        if (temp) return tem;          // 返回正温度值
        else return -tem;              // 返回负温度值
    }
    
    return -1000; // 读取失败返回错误值
}
void DS18B20_Tem_Transfer(void){
    DS18B20_Start();                   // 开始温度转换
    delay_us(750000);                  // 等待转换完成（750ms）
}