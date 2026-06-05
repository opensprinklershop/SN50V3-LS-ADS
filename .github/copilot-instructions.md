# GitHub Copilot Instructions for Dragino SN50V3-LB (ADS1115 Edition)

This repository contains a customized, specialized version of the **Dragino SN50V3-LB** LoRaWAN firmware tailored for the **OpenSprinklerShop/SN50V3-LB-ADS** project.

---

## 1. Project Context & Purpose

The purpose of this firmware is to read **4 analog channels** via an external **ADS1115 16-Bit ADC** connected over I2C, alongside the internal battery level, and internal ADCs (ADC1/PA4 and ADC3/PA8).

*   **No Multi-Mode Support (MOD Disabled)**: The `AT+MOD` command and multi-mode branching are disabled/ignored. The firmware operates strictly in this single dedicated ADS1115 measurement mode.
*   **Primary I2C Hardware Mapping**: 
    *   **I2C_SDA**: `PA15` (Pin 7 of internal expansion header)
    *   **I2C_SCL**: `PA14` (Pin 8 of internal expansion header)
    *   Software bit-banged I2C is configured inside `I2C_A.c` and initialized in `bsp.c`.

---

## 2. High-Level Architecture & Payload Flow

*   **Measurement Routine (`bsp.c` -> `BSP_sensor_Read`)**:
    *   Reads the battery voltage (`battery_voltage_measurement()`).
    *   Reads `PA4` as ADC1 (`ADC_Read(1, message)`).
    *   Reads `PA8` as ADC3 (`ADC_Read(3, message)`).
    *   Initializes Software I2C (`I2C_GPIO_MODE_Config()`).
    *   Reads channels A0-A3 of the ADS1115 (`ADS1115_Read_Channel()`).
    *   Puts I2C pins into low-power mode (`I2C_GPIO_MODE_ANALOG()`).
*   **Transmission (`main.c` -> `Send()`)**:
    *   Uplinks are packed into a **strictly 14-byte payload** on `LORAWAN_APP_PORT = 2`.
    *   Payload layout is **Big-Endian**:
        *   `Bytes 0-1`: Batteriespannung (mV)
        *   `Bytes 2-3`: ADC1 / PA4 (mV)
        *   `Bytes 4-5`: ADC3 / PA8 (mV)
        *   `Bytes 6-7`: ADS1115 A0 (raw 16-bit signed)
        *   `Bytes 8-9`: ADS1115 A1 (raw 16-bit signed)
        *   `Bytes 10-11`: ADS1115 A2 (raw 16-bit signed)
        *   `Bytes 12-13`: ADS1115 A3 (raw 16-bit signed)

---

## 3. Key Conventions & Coding Patterns

*   **Software I2C Interaction**:
    *   Use `I2C_Write_reg_Len(0x48, reg, len, buf)` and `I2C_Read_reg_Len(0x48, reg, len, buf)` for ADS1115 interactions.
    *   The ADS1115 resides at address `0x48` (ADDR pin pulled to GND).
*   **Low-Power Stop Modes**:
    *   Maintain low-power GPIO configuration by calling `I2C_GPIO_MODE_ANALOG()` after I2C operations to prevent current leakage during sleep.
*   **Variables Qualifier (`__IO`)**:
    *   Always qualify any variables that are altered inside Interrupt Service Routines (ISRs) in `tremo_it.c` with the `__IO` (volatile) keyword.

---

## 4. Compilation & Verification

*   **GNU ARM GCC (Make)**: Set `export TREMO_SDK_PATH=$(pwd)` from the workspace root, and run `make` inside `Projects/Applications/DRAGINO-LRWAN-AT/`.
*   **Keil MDK-ARM**: Open `project.uvprojx` inside `Projects/Applications/DRAGINO-LRWAN-AT/` or `DRAGINO-LRWAN(AT)/`, build with F7, and execute `utils\genbinary.bat` to generate the raw binary file for flashing.
