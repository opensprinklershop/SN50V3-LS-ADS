# Dragino SN50V3-LB ADS1115 Firmware

Dieses Repository enthält die modifizierte Open-Source-Firmware für das **Dragino SN50V3-LB** LoRaWAN-Sensor-Modul. 

Die Firmware wurde speziell für das Auslesen von **4 zusätzlichen analogen Messkanälen** über einen externen **ADS1115 16-Bit ADC** angepasst. Zu diesem Zweck bedient sie primär die I2C-Schnittstelle.

Das Projekt wird auf GitHub unter **[OpenSprinklerShop/SN50V3-LB-ADS](https://github.com/OpenSprinklerShop/SN50V3-LB-ADS)** publiziert.

---

## 1. Features & Modifikationen

*   **ADS1115 Integration**: Kontinuierliches Auslesen der 4 Analogkanäle des ADS1115 über I2C.
*   **Fokussierter Payload**: Reduzierung der LoRaWAN-Uplinks auf die wesentlichen Daten: Batteriestand, interner ADC1 (PA4), interner ADC3 (PA8) sowie die 4 Kanäle des ADS1115 (jeweils als 16-Bit-Werte).
*   **Deaktivierung der MOD-Modi**: Die ursprüngliche `AT+MOD`-Funktion wurde vollständig deaktiviert. Die Firmware läuft ausschließlich in diesem dedizierten Messmodus, um maximale Effizienz, Stabilität und extrem niedrigen Stromverbrauch im Sleep-Modus zu garantieren.

---

## 2. Hardware-Anschluss & Verkabelung

Der ADS1115 wird an die 11-polige Klemmleiste des SN50V3-LB angeschlossen. Der ADS1115 benötigt 5V Betriebsspannung und wird über den geschalteten Pin 2 versorgt. Um Energie zu sparen und Einschaltströme zu stabilisieren, schaltet die Firmware den 5V-Pin **1000ms** vor der Messung ein und schaltet ihn direkt nach der Messung wieder aus.

### Anschlussbelegung (Pinout)

| Klemme (Pin) | Bezeichnung | ADS1115 Pin | Beschreibung |
| :---: | :--- | :---: | :--- |
| **1** | 3.3V Dauerspannung | - | Nicht belegen für ADS1115 |
| **2** | **+5V geschaltet** | **VDD / VCC** | Betriebsspannung ADS1115 (wird gesteuert) |
| **3** | PA4 (ADC1) | - | Freier analoger Eingang 1 (0..3.3V) |
| **4** | **SCL** | **SCL** | I2C Clock (Software-I2C auf PA14) |
| **5** | **SDA** | **SDA** | I2C Data (Software-I2C auf PA15) |
| **6** | PC13 | - | Digitaler I/O |
| **7** | PB9 | - | Digitaler I/O |
| **8** | PB8 | - | Digitaler I/O |
| **9** | PA8 (ADC3) | - | Freier analoger Eingang 3 (0..3.3V) |
| **10**| PB15 | - | Digitaler I/O |
| **11**| **GND** | **GND & ADDR**| Masse-Bezug & Adresse (ADDR auf GND = `0x48`) |

### Wichtige Hardware-Hinweise:
*   **I2C Pull-Up Widerstände**: Stellen Sie sicher, dass auf Ihrem ADS1115-Breakout-Board bereits Pull-Up-Widerstände (z.B. 4.7kΩ oder 10kΩ nach 5V/3.3V) für SDA und SCL verbaut sind. Falls nicht, müssen diese extern hinzugefügt werden.
*   **Referenzspannung & Signalpegel**: Da der ADS1115 hier mit 5V versorgt wird, ist die Spannungsversorgung vollständig 5V-konform. An den analogen Eingängen des ADS1115 dürfen Spannungen von bis zu 5V (maximal 5.3V) anliegen. Die Pegel der I2C-Leitungen (SDA/SCL) sind dank Open-Drain-Schaltung auf der MCU-Seite 3.3V-kompatibel (die meisten ADS1115-Boards funktionieren problemlos direkt mit den 3.3V-I2C-Leitungen des SN50V3-LB).

---

## 3. LoRaWAN Payload-Format (14 Bytes)

Jeder Uplink besteht aus exakt **14 Bytes** im Big-Endian-Format (MSB zuerst).

| Byte-Index | Name | Datentyp | Wertebereich / Skalierung | Beschreibung |
| :---: | :--- | :---: | :---: | :--- |
| **0 - 1** | Batterie-Spannung | `uint16` | z.B. 3600 | Batteriespannung in Millivolt (mV) |
| **2 - 3** | ADC1 (PA4) | `uint16` | z.B. 1200 | Interner Analogwert PA4 (Spannung in mV) |
| **4 - 5** | ADC3 (PA8) | `uint16` | z.B. 2400 | Interner Analogwert PA8 (Spannung in mV) |
| **6 - 7** | ADS1115 Kanal 0 | `int16` | `0` bis `32767` | Raw-Wert ADS1115 A0 (0V = 0, 5V = 32767) |
| **8 - 9** | ADS1115 Kanal 1 | `int16` | `0` bis `32767` | Raw-Wert ADS1115 A1 (0V = 0, 5V = 32767) |
| **10 - 11**| ADS1115 Kanal 2 | `int16` | `0` bis `32767` | Raw-Wert ADS1115 A2 (0V = 0, 5V = 32767) |
| **12 - 13**| ADS1115 Kanal 3 | `int16` | `0` bis `32767` | Raw-Wert ADS1115 A3 (0V = 0, 5V = 32767) |

---

## 4. Payload-Dekodierung (The Things Network v3 / ChirpStack)

Der ADS1115 liefert einen vorzeichenbehafteten 16-Bit-Wert (`int16`). Da der ADS1115 mit 5V betrieben wird, entspricht ein Messwert von `0V` dem Wert `0`, und eine Eingangsspannung von `5V` entspricht dem Maximalwert `32767` (bzw. skaliert mit der jeweiligen Referenzspannung).

### Berechnungsformeln:
$$\text{Spannung (V)} = \frac{\text{Raw-Wert}}{32767.0} \times 5.0$$
$$\text{Spannung (mV)} = \frac{\text{Raw-Wert}}{32767.0} \times 5000.0$$

### Wichtiger Hinweis zu unbeschalteten (schwebenden) Pins:
Wenn an den Kanälen (A0–A3) des ADS1115 **nichts** angeschlossen ist, befinden sich die Eingänge im **schwebenden Zustand (floating)**. Sie fangen minimale statische Aufladungen der Umgebung ein, wodurch typischerweise Rauschen im Bereich von **`4300` bis `4400`** (entspricht ca. 0.6V) gemessen wird. Dies ist völlig normal.
*   Wird ein Pin direkt mit **GND** verbunden, fällt der Wert sofort auf **`0`**.
*   Wird ein Pin direkt mit **5V** verbunden, steigt der Wert auf **`32767`**.

### Beispiel-Uplink (Hex):
`0E 1C 04 B0 09 C4 4E 20 00 00 1B 58 7F FF`

*   `0E 1C` (Byte 0-1) = `3612` -> **3612 mV** (Batterie)
*   `04 B0` (Byte 2-3) = `1200` -> **1200 mV** (ADC1 / PA4)
*   `09 C4` (Byte 4-5) = `2500` -> **2500 mV** (ADC3 / PA8)
*   `4E 20` (Byte 6-7) = `20000` -> $\frac{20000}{32767} \times 5000\text{ mV} =$ **3051.8 mV (3.05V)** (ADS1115 A0)
*   `00 00` (Byte 8-9) = `0` -> **0 mV (0V)** (ADS1115 A1)
*   `1B 58` (Byte 10-11) = `7000` -> $\frac{7000}{32767} \times 5000\text{ mV} =$ **1068.1 mV (1.07V)** (ADS1115 A2)
*   `7F FF` (Byte 12-13) = `32767` -> **5000 mV (5.0V)** (ADS1115 A3)

### JavaScript Decoder (TTN v3 Payload Formatter)

```javascript
function decodeUplink(input) {
  var bytes = input.bytes;
  var decoded = {};

  if (bytes.length === 14) {
// 1. Batterie-Spannung (mV)
decoded.battery_mv = (bytes[0] << 8) | bytes[1];

// 2. Interner ADC1 (PA4) in mV
decoded.adc_pa4_mv = (bytes[2] << 8) | bytes[3];

// 3. Interner ADC3 (PA8) in mV
decoded.adc_pa8_mv = (bytes[4] << 8) | bytes[5];

// Hilfsfunktion für signed 16-bit
function readInt16(b1, b2) {
  var val = (b1 << 8) | b2;
  return val >= 0x8000 ? val - 0x10000 : val;
}

// 4. ADS1115 Kanäle (umgerechnet in mV basierend auf 0..5V-Skalierung)
var ch0_raw = readInt16(bytes[6], bytes[7]);
var ch1_raw = readInt16(bytes[8], bytes[9]);
var ch2_raw = readInt16(bytes[10], bytes[11]);
var ch3_raw = readInt16(bytes[12], bytes[13]);

// Falls ein I2C-Fehler vorliegt (Rückgabewert 0xFFFF / -1), setzen wir null
decoded.ads1115_a0_mv = (ch0_raw === -1) ? null : Math.round((ch0_raw / 32767.0) * 5000.0);
decoded.ads1115_a1_mv = (ch1_raw === -1) ? null : Math.round((ch1_raw / 32767.0) * 5000.0);
decoded.ads1115_a2_mv = (ch2_raw === -1) ? null : Math.round((ch2_raw / 32767.0) * 5000.0);
decoded.ads1115_a3_mv = (ch3_raw === -1) ? null : Math.round((ch3_raw / 32767.0) * 5000.0);
  }

  return {
data: decoded,
warnings: [],
errors: []
  };
}
```

---

## 5. Testen & Fehlerdiagnose über das Terminal

Über den UART-Terminal-Anschluss (COM-Port, Baudrate `9600`, Newline `CR+LF`) kann die Funktion und Verkabelung direkt getestet werden:

### AT-Testbefehl:
```text
AT+GETSENSORVALUE=0
```

### Ausgabe bei ERFOLGREICHER Erkennung (SUCCESS):
Wenn der ADS1115 korrekt verkabelt ist, aktiviert die Firmware Pin 2 (+5V), wartet 1000ms und gibt folgende Meldung aus:
```text
Bat_voltage:3612 mv
ADS1115 Connection Status: SUCCESS (ADS1115 Detected!)
ADS1115 Ch0:4394, Ch1:4384, Ch2:4365, Ch3:4369
```
*(Hinweis: Ch0..Ch3 zeigen hier schwebende Rauschwerte, da kein Sensor angeschlossen ist.)*

### Ausgabe bei FEHLERHAFTER Erkennung (FAILED):
Wenn die Verkabelung fehlerhaft ist, die Adresse nicht `0x48` ist oder keine Stromversorgung anliegt:
```text
Bat_voltage:3612 mv
ADS1115 Connection Status: FAILED (Check Address 0x48, Pin 4 SCL, Pin 5 SDA, Pin 2 +5V!)
```
In diesem Fall werden im LoRaWAN-Payload alle Kanäle als `65535` (bzw. `-1`) übertragen, was im Decoder als `null` interpretiert wird.

---

## 6. Kompilieren & Installieren der Firmware

### A. Über GNU ARM GCC (Makefile)
1. Installieren Sie die ARM GCC Toolchain (`gcc-arm-none-eabi`).
2. Setzen Sie den Tremo-SDK-Pfad in Ihrer Shell:
   ```bash
   export TREMO_SDK_PATH=$(pwd)
   ```
3. Kompilieren Sie das Projekt:
   ```bash
   cd Projects/Applications/DRAGINO-LRWAN-AT
   make clean
   make
   ```
4. Die Flash-Dateien (`.bin`, `.hex`) befinden sich anschließend im generierten Build-Ordner.

### B. Über Keil uVision
1. Öffnen Sie die Projektdatei `Projects/Applications/DRAGINO-LRWAN-AT/project.uvprojx` (oder `DRAGINO-LRWAN(AT)/project.uvprojx`) in Keil MDK-ARM (v5 oder neuer).
2. Klicken Sie auf **Build (F7)**.
3. Erzeugen Sie die flashbare Binärdatei durch Ausführen der Batch-Datei im Anwendungsordner:
   ```cmd
   utils\genbinary.bat
   ```

---

## 6. Firmware flashen (Upload)

### Automatisiertes Flash-Skript (Empfohlen)
Im Root-Verzeichnis dieses Projekts befindet sich das PowerShell-Skript `flash_firmware.ps1`. Dieses Skript automatisiert den gesamten Prozess:
1. Prüft/installiert die GNU ARM GCC Toolchain (one-time Download).
2. Kompiliert die Firmware im Git-Bash-Kontext.
3. Führt einen Sicherheits-Check der Binärgröße durch (verhindert das Überschreiben der DevEUI / Keys bei `0x0803E000`).
4. Flasht das Gerät über **COM3** mit 115200 Baudrate.

**Ausführung:**
1. Schieben Sie den Board-Schalter auf **'ISP'**.
2. Drücken Sie kurz die **RESET-Taste** auf dem Board.
3. Öffnen Sie die PowerShell und führen Sie aus:
   ```powershell
   powershell -File .\flash_firmware.ps1
   ```
4. Nach erfolgreichem Flash-Vorgang den Schalter wieder auf **'Flash'** schieben und erneut **RESET** drücken.

### Manuelles Flashen
*   Detaillierte Flash-Anleitungen finden Sie in den offiziellen Handbüchern:
    *   [UART Flash Anleitung](http://wiki.dragino.com/xwiki/bin/view/Main/UART%20Access%20for%20LoRa%20ST%20v4%20base%20model/)
    *   [OTA Firmware Update](http://wiki.dragino.com/xwiki/bin/view/Main/Firmware%20OTA%20Update%20for%20Sensors/)
    *   [Original Dragino Wiki für SN50v3-LB](https://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20LoRaWAN%20End%20Nodes/SN50v3-LB/)
