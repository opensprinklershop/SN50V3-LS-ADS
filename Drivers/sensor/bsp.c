#include "tremo_gpio.h"
#include "bsp.h"
#include "gpio_exti.h"
#include "tremo_delay.h"
#include "tremo_iwdg.h"
#include "lora_config.h"
#include "tremo_adc.h"
#include "log.h"
#include "tremo_uart.h"
#include "I2C_A.h"
#include "lora_app.h"
#include "I2C_sensor.h"
#include "ds18b20.h"
#include "weight.h"
#include "tfsensor.h"
#include "ult.h"
#include "pwm.h"
#include "TMP117_I2C.h"
#include "sht3x.h"

#define VBAT_FACTOR     3.06f

bool uplink_pin_status_pb15=0,uplink_pin_status_pa4=0,uplink_pin_status_pa8=0;
uint16_t bat_record=3400;
bool tmp117_connect_status;
uint8_t icnumber=0;
bool bh1750flags=0;
uint8_t mode2_flag=0;
static uint8_t flags=0;
extern uint8_t workmode;
extern uint8_t inmode,inmode2,inmode3;
extern uint16_t power_5v_time;
extern uint32_t count1,count2;
extern uint8_t pwm_timer;
extern uint16_t IC1[4],IC2[4];
static float tmp117_temp_record=10;

void BLE_power_Init(void)
{
	 //reset
	 rcc_enable_peripheral_clk(RCC_PERIPHERAL_GPIOD, true);
	 gpio_set_iomux(GPIOD, GPIO_PIN_10, 0);
	 gpio_init(GPIOD, GPIO_PIN_10, GPIO_MODE_OUTPUT_PP_LOW); 
	 delay_ms(300);	 
	 gpio_init(GPIOD, GPIO_PIN_10, GPIO_MODE_OUTPUT_PP_HIGH); 
		 
	 delay_ms(200);	
	
	 uint8_t buf[8];
	 lora_config_deveui_get(buf);
	 LOG_PRINTF(LL_DEBUG,"AT+NAME%02X%02X%02X%02X%02X%02X%02X%02X\r\n", 
							buf[0], buf[1], buf[2], buf[3], buf[4], buf[5], buf[6], buf[7]);

	 delay_ms(50);
		
	 gpio_init(GPIOD, GPIO_PIN_10, GPIO_MODE_OUTPUT_PP_LOW); 
	 delay_ms(200);	 
	 gpio_init(GPIOD, GPIO_PIN_10, GPIO_MODE_OUTPUT_PP_HIGH); 
}

void BSP_sensor_Init( void  )
{		
	 BLE_power_Init();	
	 GPIO_EXTI4_IoInit(0);
	 GPIO_EXTI8_IoInit(0);		
	 GPIO_EXTI15_IoInit(0);
	
	 if((workmode==1)||(workmode==3)||(workmode==12))
	 {
		 I2C_GPIO_MODE_Config();
		 if(check_sht20_connect()==1)
		 {
			 flags=1;
			 LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is STH2x\r\n");
			 delay_ms(20);
		 }
		 
		 if(check_sht31_connect()==1)
		 {
			 flags=2;
			 LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is STH3x\r\n");
			 delay_ms(20);
		 }
		 
		 if(flags==0)
		 {
			 uint16_t luxtemp;
			 luxtemp=bh1750_read();
			 if(luxtemp!=0)
			 {
				flags=3;
				LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is BH1750\r\n");	
        delay_ms(20);				 
			 }
		 }
		 
		 if(flags==0)
		 {
			 LOG_PRINTF(LL_DEBUG,"\n\rNo I2C device detected\r\n");
			 delay_ms(20);
		 }	 
     I2C_GPIO_MODE_ANALOG();	
	 }
	 else if(workmode==2)
	 {
	  POWER_IoInit();
		delay_ms(500); 
		
		GPIO_ULT_INPUT_Init();
		GPIO_ULT_OUTPUT_Init();	
		delay_ms(100);
		if(gpio_read(ULT_Echo_PORT, ULT_Echo_PIN)==0)
		{  
			mode2_flag=2;	 
			LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is ultrasonic distance measurement\r\n");
			delay_ms(20);
			GPIO_ULT_INPUT_DeInit();
			GPIO_ULT_OUTPUT_DeInit();			
		}	 
    else
		{			
			I2C_GPIO_MODE_Config();
			if(waitbusy(2)<999)
			{
			 mode2_flag=1;			
			 LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is LIDAR_Lite_v3HP\r\n");
			 delay_ms(20);
			}				
			
			if(mode2_flag==0)
			{	 
				if(check_deceive()==1)
				{
					mode2_flag=3;
					LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is TF-series sensor\r\n");	
					delay_ms(20);
				}	
				else
				{	
					LOG_PRINTF(LL_DEBUG,"\n\rNo distance measurement device detected\r\n");	
          delay_ms(20);					
				}					
			} 
		}		
    I2C_GPIO_MODE_ANALOG();			
		POWER_IoDeInit();			 
	 }
	 else if(workmode==5)
	 {
	  POWER_IoInit();	
		WEIGHT_SCK_Init();
		WEIGHT_DOUT_Init();
		Get_Maopi();
    delay_ms(500);
		Get_Maopi();	
		WEIGHT_SCK_DeInit();
		WEIGHT_DOUT_DeInit();				
		POWER_IoDeInit();		
		LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is HX711\r\n");	
    delay_ms(20);		 
	 }
	 else if((workmode==7)||(workmode==9))	
	 {
		 GPIO_EXTI4_IoInit(inmode2);
		 GPIO_EXTI15_IoInit(inmode3);		 
	 }	
	 else if(workmode==11)
	 {
		TMP117_I2C_GPIO_MODE_Config();
		get_tmp117_temp();		 
		if(tmp117_connect_status==1)
		{
			LOG_PRINTF(LL_DEBUG,"\n\rUse Sensor is TMP117\r\n");	
			delay_ms(30);		
		}			
	 }
	 
	 if((workmode!=3)&&(workmode!=8))
	 {
		GPIO_EXTI8_IoInit(inmode);	
	 }
	 
	 if((workmode==3)||(workmode==8))
	 {
		 GPIO_EXTI15_IoInit(inmode3);
	 }

	 SHT3X_Init(0x44);	 
	 POWER_IoDeInit();	
	 GPIO_BLE_STATUS_Ioinit();
	 
	 rcc_enable_peripheral_clk(RCC_PERIPHERAL_GPIOB, true);
	 gpio_set_iomux(LED_RGB_PORT, LED_RED_PIN, 0);
	 gpio_init(LED_RGB_PORT, LED_RED_PIN, GPIO_MODE_OUTPUT_PP_LOW);	
	 gpio_set_iomux(LED_RGB_PORT, LED_GREEN_PIN, 0);
	 gpio_init(LED_RGB_PORT, LED_GREEN_PIN, GPIO_MODE_OUTPUT_PP_LOW);
	 gpio_set_iomux(LED_RGB_PORT, LED_BLUE_PIN, 0);	
	 gpio_init(LED_RGB_PORT, LED_BLUE_PIN, GPIO_MODE_OUTPUT_PP_LOW);
	
	 rcc_enable_peripheral_clk(RCC_PERIPHERAL_GPIOC, true);
	 gpio_init(GPIO_USERKEY_PORT, GPIO_USERKEY_PIN, GPIO_MODE_INPUT_PULL_UP);
	 gpio_config_interrupt(GPIO_USERKEY_PORT, GPIO_USERKEY_PIN, GPIO_INTR_FALLING_EDGE);
	 gpio_config_stop3_wakeup(GPIO_USERKEY_PORT, GPIO_USERKEY_PIN,true,GPIO_LEVEL_LOW);
	 NVIC_SetPriority(GPIO_IRQn, 3);
	 /* NVIC config */
	 NVIC_EnableIRQ(GPIO_IRQn);	
}

uint16_t ADS1115_Read_Channel(uint8_t channel)
{
	uint8_t config_hi = 0;
	uint8_t config_lo = 0x83; // 128 SPS, Single-shot, disable comparator
	
	// Select channel (Single-ended to GND)
	// 0: AIN0 vs GND -> MUX = 100
	// 1: AIN1 vs GND -> MUX = 101
	// 2: AIN2 vs GND -> MUX = 110
	// 3: AIN3 vs GND -> MUX = 111
	// We use PGA = 001 for +/- 4.096V full scale range
	switch(channel)
	{
		case 0: config_hi = 0xC3; break; // 1(OS) + 100(MUX) + 001(PGA) + 1(Mode)
		case 1: config_hi = 0xD3; break; // 1(OS) + 101(MUX) + 001(PGA) + 1(Mode)
		case 2: config_hi = 0xE3; break; // 1(OS) + 110(MUX) + 001(PGA) + 1(Mode)
		case 3: config_hi = 0xF3; break; // 1(OS) + 111(MUX) + 001(PGA) + 1(Mode)
		default: return 0;
	}
	
	uint8_t config_buf[2] = {config_hi, config_lo};
	if (I2C_Write_reg_Len(0x48, 0x01, 2, config_buf) != 0)
	{
		return 0xFFFF;
	}
	
	delay_ms(15);
	
	uint8_t data_buf[2] = {0, 0};
	if (I2C_Read_reg_Len(0x48, 0x00, 2, data_buf) != 0)
	{
		return 0xFFFF;
	}
	
	return (data_buf[0] << 8) | data_buf[1];
}

void ADS1115_Read_All(sensor_t *sensor_data, uint8_t message)
{
	I2C_GPIO_MODE_Config();
	delay_ms(5);
	
	sensor_data->ads1115_ch0 = ADS1115_Read_Channel(0);
	sensor_data->ads1115_ch1 = ADS1115_Read_Channel(1);
	sensor_data->ads1115_ch2 = ADS1115_Read_Channel(2);
	sensor_data->ads1115_ch3 = ADS1115_Read_Channel(3);
	
	I2C_GPIO_MODE_ANALOG();
	
	if (message == 1)
	{
		if (sensor_data->ads1115_ch0 == 0xFFFF && 
			sensor_data->ads1115_ch1 == 0xFFFF && 
			sensor_data->ads1115_ch2 == 0xFFFF && 
			sensor_data->ads1115_ch3 == 0xFFFF)
		{
			LOG_PRINTF(LL_DEBUG, "ADS1115 Connection Status: FAILED (Check Address 0x48, Pin 4 SCL, Pin 5 SDA, Pin 2 +5V!)\r\n");
		}
		else
		{
			LOG_PRINTF(LL_DEBUG, "ADS1115 Connection Status: SUCCESS (ADS1115 Detected!)\r\n");
			delay_ms(20);
			LOG_PRINTF(LL_DEBUG, "ADS1115 Ch0:%d, Ch1:%d, Ch2:%d, Ch3:%d\r\n", 
					   (int16_t)sensor_data->ads1115_ch0, 
					   (int16_t)sensor_data->ads1115_ch1, 
					   (int16_t)sensor_data->ads1115_ch2, 
					   (int16_t)sensor_data->ads1115_ch3);
		}
		delay_ms(20);
	}
}

void BSP_sensor_Read( sensor_t *sensor_data , uint8_t message ,uint8_t mod_temp)
{		
	delay_ms(50);
	iwdg_reload();
	sensor_data->bat_mv=battery_voltage_measurement();
	if((sensor_data->bat_mv>4300)||(sensor_data->bat_mv<2500)||(sensor_data->bat_mv-bat_record>200)||(bat_record-sensor_data->bat_mv>200))
	{
		sensor_data->bat_mv=battery_voltage_measurement();
		
		if((sensor_data->bat_mv>4300)||(sensor_data->bat_mv<2500))
		{
			if((sensor_data->bat_mv-bat_record>200)||(bat_record-sensor_data->bat_mv>200))
			{
				sensor_data->bat_mv=battery_voltage_measurement();
				
				if((sensor_data->bat_mv>4300)||(sensor_data->bat_mv<2500))
				{
					sensor_data->bat_mv=bat_record;					
				}
			}
		}
	}
	
	if((sensor_data->bat_mv<4300)&&(sensor_data->bat_mv>2500))
	{
		bat_record=sensor_data->bat_mv;
	}

	if(message==1)
	{				
		LOG_PRINTF(LL_DEBUG,"\r\nBat_voltage:%d mv\n\r",sensor_data->bat_mv);
		delay_ms(20);				
	}	
			
	POWER_open_time(1000);
	sensor_data->ADC_4 = ADC_Read(1, message); // Reads PA4 (ADC1)
	sensor_data->ADC_8 = ADC_Read(3, message); // Reads PA8 (ADC3)
	ADS1115_Read_All(sensor_data, message);   // Reads 4 ADS1115 channels
	POWER_IoDeInit();	
}

uint16_t battery_voltage_measurement(void)
{
	uint16_t bat_mv;

	#if defined LB_LS
  bat_mv=6*adc_in1_measurement(ADC_SOLAR_LEVEL_PORT,ADC_SOLAR_LEVEL_PIN,GPIO_SOLAR_BAT_CHANNEL);	
	#else
	gpio_set_iomux(ADC_BAT_OUTPUT_PORT, ADC_BAT_OUTPUT_PIN, 0);
	gpio_init(ADC_BAT_OUTPUT_PORT, ADC_BAT_OUTPUT_PIN, GPIO_MODE_OUTPUT_PP_LOW);	
	
  bat_mv=6*adc_in1_measurement(ADC_BAT_LEVEL_PORT,ADC_BAT_LEVEL_PIN,GPIO_ADC_BAT_CHANNEL);

//	LOG_PRINTF(LL_DEBUG,"%d\r\n",adc_in1_measurement(ADC_BAT_LEVEL_PORT,ADC_BAT_LEVEL_PIN,GPIO_ADC_BAT_CHANNEL));
	
	gpio_set_iomux(ADC_BAT_OUTPUT_PORT, ADC_BAT_OUTPUT_PIN, 0);
	gpio_init(ADC_BAT_OUTPUT_PORT, ADC_BAT_OUTPUT_PIN, GPIO_MODE_ANALOG);	
	#endif		
	return bat_mv;
}

float DS18B20_Read(uint8_t temp,uint8_t message)
{
	float temp_ds=0;
	if(temp==1)
	{
		temp_ds=DS18B20_GetTemp_SkipRom(temp);
		if(message==1)
		{			
			if((temp_ds>=-55)&&(temp_ds<=125))
			{
				LOG_PRINTF(LL_DEBUG,"DS18B20_temp1:%.1f\r\n",temp_ds);
				delay_ms(20);
			}
			else
			{
				LOG_PRINTF(LL_DEBUG,"DS18B20_temp1:null\r\n");
				delay_ms(20);
			}
		}			
	}
	else if(temp==2)
	{
		temp_ds=DS18B20_GetTemp_SkipRom(temp);
		if(message==1)
		{			
			if((temp_ds>=-55)&&(temp_ds<=125))
			{
				LOG_PRINTF(LL_DEBUG,"DS18B20_temp2:%.1f\r\n",temp_ds);
				delay_ms(20);
			}
			else
			{
				LOG_PRINTF(LL_DEBUG,"DS18B20_temp2:null\r\n");
				delay_ms(20);
			}
		}		
	}	
	else if(temp==3)
	{
		temp_ds=DS18B20_GetTemp_SkipRom(temp);
		if(message==1)
		{			
			if((temp_ds>=-55)&&(temp_ds<=125))
			{
				LOG_PRINTF(LL_DEBUG,"DS18B20_temp3:%.1f\r\n",temp_ds);
				delay_ms(20);
			}
			else
			{
				LOG_PRINTF(LL_DEBUG,"DS18B20_temp3:null\r\n");
				delay_ms(20);
			}
		}			
	}		
	return temp_ds;
}

uint16_t ADC_Read(uint8_t temp,uint8_t message)
{
	uint16_t adc_temp=0;
	if(temp==1)
	{
		adc_temp=adc_in1_measurement(ADC_IN3_LEVEL_PORT,ADC_IN3_LEVEL_PIN,GPIO_ADC_IN3_CHANNEL);
		if(message==1)
		{				
			LOG_PRINTF(LL_DEBUG,"ADC_PA4:%.3f V\r\n",(adc_temp/1000.0));
			delay_ms(20);
		}		
	}
	else if(temp==2)
	{
		adc_temp=adc_in1_measurement(ADC_IN2_LEVEL_PORT,ADC_IN2_LEVEL_PIN,GPIO_ADC_IN2_CHANNEL);
		if(message==1)
		{				
			LOG_PRINTF(LL_DEBUG,"ADC_PA5:%.3f V\r\n",(adc_temp/1000.0));
			delay_ms(20);
		}		
	}	
	else if(temp==3)
	{
		adc_temp=adc_in1_measurement(ADC_IN1_LEVEL_PORT,ADC_IN1_LEVEL_PIN,GPIO_ADC_IN1_CHANNEL);
		if(message==1)
		{				
			LOG_PRINTF(LL_DEBUG,"ADC_PA8:%.3f V\r\n",(adc_temp/1000.0));
			delay_ms(20);
		}			
	}		
  return adc_temp;	
}

bool Digital_input_Read(uint8_t temp,uint8_t message)
{
	bool pin_status=0;
	if(temp==1)
	{		
		pin_status=gpio_read(GPIO_EXTI4_PORT, GPIO_EXTI4_PIN);
		if(message==1)
		{				
			LOG_PRINTF(LL_DEBUG,"PA4_status:%d\r\n",pin_status);
			delay_ms(20);
		}
		uplink_pin_status_pa4=pin_status;		
	}
	else if(temp==2)
	{
		pin_status=gpio_read(GPIO_EXTI8_PORT, GPIO_EXTI8_PIN);	
		if(message==1)
		{				
			LOG_PRINTF(LL_DEBUG,"PA8_status:%d\r\n",pin_status);
			delay_ms(20);
		}
		uplink_pin_status_pa8=pin_status;
	}	
	else if(temp==3)
	{
		pin_status=gpio_read(GPIO_EXTI15_PORT, GPIO_EXTI15_PIN);	
		if(message==1)
		{				
			LOG_PRINTF(LL_DEBUG,"PB15_status:%d\r\n",pin_status);
			delay_ms(20);
		}	
		uplink_pin_status_pb15=pin_status;		
	}	
  return pin_status;	
}

uint16_t middle_value(uint16_t value[])
{
	uint16_t a,b,c,temp;
	a = value[1];
	b = value[2];
	c = value[3];
	
  if (a > b)
  {
    temp = a;
    a = b;
    b = temp;
  }
	
  if (a > c)
  {
    temp = a;
    a = c;
    c = temp;
  }
	
  if (b > c)
  {
    temp = b;
    b = c;
    c = temp;
  }
	
	return b;
}

void display_message(void)
{
	delay_ms(50);
	float bat_temp=0.0;
  bat_temp=battery_voltage_measurement()/1000.0;
  if(bat_temp>3750)
	{
	  bat_temp=battery_voltage_measurement()/1000.0;
	}			
	LOG_PRINTF(LL_DEBUG,"\r\nBattery: %.3f V\r\n",bat_temp);
  delay_ms(50);				
	
	float ds_temp=0.0;
	ds_temp=DS18B20_GetTemp_SkipRom(1);
	if((ds_temp>=-55)&&(ds_temp<=125))
	{
		LOG_PRINTF(LL_DEBUG,"Temperature (PC13): %.1f\r\n",ds_temp);
	}
	else
	{
		LOG_PRINTF(LL_DEBUG,"Temperature (PC13): NULL\r\n");		
	}
	delay_ms(50);	
	
	bool pin_status1=0,pin_status2=0,pin_status3=0;
	pin_status1=gpio_read(GPIO_EXTI8_PORT, GPIO_EXTI8_PIN);	
	pin_status2=gpio_read(GPIO_EXTI4_PORT, GPIO_EXTI4_PIN);
	pin_status3=gpio_read(GPIO_EXTI15_PORT, GPIO_EXTI15_PIN);	
	LOG_PRINTF(LL_DEBUG,"PA8: %d ; PA4: %d , PB15: %d\r\n",pin_status1,pin_status2,pin_status3);
	delay_ms(50);	
}
/************************ (C) COPYRIGHT STMicroelectronics *****END OF FILE****/
