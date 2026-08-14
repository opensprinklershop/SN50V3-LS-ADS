/**
 * Payload Decoder für 3x Truebner SMT50 Sensoren am SN50V3-LS
 * 
 * Dekodiert einen 14-Byte LoRaWAN-Uplink für eine Konfiguration mit 3 Sensoren.
 * 
 * WICHTIG: Die internen ADC-Eingänge PA4 und PA8 können nur bis 1.1V messen und
 * sind daher ausschließlich für die SMT50-Temperatur (typisch 0.2..1.0V) geeignet.
 * Die Bodenfeuchte (0..3V) MUSS deshalb immer an den ADS1115 (A0..A2) angeschlossen
 * werden. Die drei Temperatur-Signale werden über PA4, PA8 und den freien
 * ADS1115-Kanal A3 erfasst.
 * 
 * Konfiguration:
 * - SMT50 #1: Gelb → ADS1115 A0 (Feuchte), Grün → PA4/ADC1 (Temperatur)
 * - SMT50 #2: Gelb → ADS1115 A1 (Feuchte), Grün → PA8/ADC3 (Temperatur)
 * - SMT50 #3: Gelb → ADS1115 A2 (Feuchte), Grün → ADS1115 A3 (Temperatur)
 * 
 * SMT50 Charakteristiken:
 * - Bodenfeuchte: 0V = 0% VWC, 3V = 50% VWC
 * - Temperatur: 0.5V = 0°C, +10mV pro °C (typischer Bereich: ca. 0.2..1.0V)
 * - PA4 und PA8 sind nur bis 1.1V nutzbar und daher nur für SMT50-Temperatur geeignet
 * 
 * Payload-Format (14 Bytes, Big-Endian):
 * - Byte 0-1:   Batteriespannung (uint16, mV)
 * - Byte 2-3:   ADC1 / PA4 (uint16, mV) → SMT50 #1 Temperatur
 * - Byte 4-5:   ADC3 / PA8 (uint16, mV) → SMT50 #2 Temperatur
 * - Byte 6-7:   ADS1115 A0 (int16, SMT50 #1 Bodenfeuchte)
 * - Byte 8-9:   ADS1115 A1 (int16, SMT50 #2 Bodenfeuchte)
 * - Byte 10-11: ADS1115 A2 (int16, SMT50 #3 Bodenfeuchte)
 * - Byte 12-13: ADS1115 A3 (int16, SMT50 #3 Temperatur)
 * 
 * @param {Object} input - TTN/ChirpStack Uplink Message
 * @returns {Object} Dekodiertes Payload-Objekt mit 3x SMT50-Messwerten
 */
function decodeUplink(input) {
  var bytes = input.bytes;
  var decoded = {};

  if (bytes.length === 14) {
    // Batterie-Spannung (Byte 0-1)
    decoded.battery_mv = (bytes[0] << 8) | bytes[1];

    // PA4 Rohwert (Byte 2-3) - wird als SMT50 #1 Temperatur interpretiert
    var pa4_mv = (bytes[2] << 8) | bytes[3];
    decoded.adc_pa4_mv = pa4_mv;

    // PA8 Rohwert (Byte 4-5) - wird als SMT50 #2 Temperatur interpretiert
    var pa8_mv = (bytes[4] << 8) | bytes[5];
    decoded.adc_pa8_mv = pa8_mv;

    /**
     * Hilfsfunktion: Konvertiert zwei Bytes zu vorzeichenbehaftetem 16-Bit-Wert
     * @param {number} b1 - High Byte (MSB)
     * @param {number} b2 - Low Byte (LSB)
     * @returns {number} Vorzeichenbehafteter 16-Bit-Wert
     */
    function readInt16(b1, b2) {
      var val = (b1 << 8) | b2;
      return val >= 0x8000 ? val - 0x10000 : val;
    }

    // ADS1115 Kanäle auslesen (A0..A2 = Feuchte, A3 = Temperatur #3)
    var ch0_raw = readInt16(bytes[6], bytes[7]);   // SMT50 #1 Bodenfeuchte (Gelb)
    var ch1_raw = readInt16(bytes[8], bytes[9]);   // SMT50 #2 Bodenfeuchte (Gelb)
    var ch2_raw = readInt16(bytes[10], bytes[11]); // SMT50 #3 Bodenfeuchte (Gelb)
    var ch3_raw = readInt16(bytes[12], bytes[13]); // SMT50 #3 Temperatur (Grün)

    /**
     * Hilfsfunktion: Bodenfeuchte (% VWC) aus ADS1115-Rohwert
     * Formel: % VWC = (raw / 32767.0) * 68.2667
     */
    function moistureVwc(raw) {
      if (raw === -1 || raw === 0xFFFF) {
        return null;
      }
      return parseFloat(((raw / 32767.0) * 68.2667).toFixed(2));
    }

    /**
     * Hilfsfunktion: SMT50-Temperatur (°C) aus ADS1115-Rohwert
     * Formel: °C = ((raw / 32767.0) * 409.6) - 50.0
     */
    function tempFromRaw(raw) {
      if (raw === -1 || raw === 0xFFFF) {
        return null;
      }
      return parseFloat((((raw / 32767.0) * 409.6) - 50.0).toFixed(1));
    }

    /**
     * Hilfsfunktion: SMT50-Temperatur (°C) aus PA4/PA8-Spannung (mV)
     * Formel: °C = (mV - 500) / 10  (0.5V = 0°C, +10mV pro °C)
     */
    function tempFromMv(mv) {
      if (mv === 0) {
        return null;
      }
      return parseFloat(((mv - 500.0) / 10.0).toFixed(1));
    }

    // ============ SMT50 #1 (Feuchte A0, Temperatur PA4) ============
    decoded.smt50_1_moisture_vwc = moistureVwc(ch0_raw);
    decoded.smt50_1_temp_c = tempFromMv(pa4_mv);

    // ============ SMT50 #2 (Feuchte A1, Temperatur PA8) ============
    decoded.smt50_2_moisture_vwc = moistureVwc(ch1_raw);
    decoded.smt50_2_temp_c = tempFromMv(pa8_mv);

    // ============ SMT50 #3 (Feuchte A2, Temperatur A3) ============
    decoded.smt50_3_moisture_vwc = moistureVwc(ch2_raw);
    decoded.smt50_3_temp_c = tempFromRaw(ch3_raw);
  }

  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}
