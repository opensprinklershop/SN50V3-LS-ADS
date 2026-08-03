/**
 * Payload Decoder für 4x Truebner SMT50 Sensoren am SN50V3-LS (Maximal-Konfiguration)
 * 
 * Dekodiert einen 14-Byte LoRaWAN-Uplink für die maximale Sensor-Konfiguration:
 * - 2x SMT50 am ADS1115 (mit Bodenfeuchte und Temperatur)
 * - 2x SMT50 an internen ADC-Eingängen (nur Bodenfeuchte, ohne Temperatur)
 * 
 * Konfiguration:
 * - SMT50 #1: Gelb → ADS1115 A0 (Feuchte), Grün → A1 (Temperatur)
 * - SMT50 #2: Gelb → ADS1115 A2 (Feuchte), Grün → A3 (Temperatur)
 * - SMT50 #3: Gelb → PA4/ADC1 (nur Feuchte)
 * - SMT50 #4: Gelb → PA8/ADC3 (nur Feuchte)
 * 
 * SMT50 Charakteristiken:
 * - Bodenfeuchte: 0V = 0% VWC, 3V = 50% VWC
 * - Temperatur: 0.1V = -40°C, 3V = +60°C
 * - SMT50 #3 & #4 direkt am PA4/PA8: Umrechnung 0..3.3V → 0..50% VWC
 * 
 * Payload-Format (14 Bytes, Big-Endian):
 * - Byte 0-1:   Batteriespannung (uint16, mV)
 * - Byte 2-3:   ADC1 / PA4 (uint16, mV) → wird als SMT50 #3 Bodenfeuchte interpretiert
 * - Byte 4-5:   ADC3 / PA8 (uint16, mV) → wird als SMT50 #4 Bodenfeuchte interpretiert
 * - Byte 6-7:   ADS1115 A0 (int16, SMT50 #1 Bodenfeuchte)
 * - Byte 8-9:   ADS1115 A1 (int16, SMT50 #1 Temperatur)
 * - Byte 10-11: ADS1115 A2 (int16, SMT50 #2 Bodenfeuchte)
 * - Byte 12-13: ADS1115 A3 (int16, SMT50 #2 Temperatur)
 * 
 * @param {Object} input - TTN/ChirpStack Uplink Message
 * @returns {Object} Dekodiertes Payload-Objekt mit 4x SMT50-Messwerten
 */
function decodeUplink(input) {
  var bytes = input.bytes;
  var decoded = {};

  if (bytes.length === 14) {
    // Batterie-Spannung (Byte 0-1)
    decoded.battery_mv = (bytes[0] << 8) | bytes[1];

    // PA4 Rohwert (Byte 2-3) - wird als SMT50 #3 Bodenfeuchte interpretiert
    var pa4_mv = (bytes[2] << 8) | bytes[3];
    decoded.adc_pa4_mv = pa4_mv;

    // PA8 Rohwert (Byte 4-5) - wird als SMT50 #4 Bodenfeuchte interpretiert
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

    // ADS1115 Kanäle auslesen
    var ch0_raw = readInt16(bytes[6], bytes[7]);   // SMT50 #1 Bodenfeuchte (Gelb)
    var ch1_raw = readInt16(bytes[8], bytes[9]);   // SMT50 #1 Temperatur (Grün)
    var ch2_raw = readInt16(bytes[10], bytes[11]); // SMT50 #2 Bodenfeuchte (Gelb)
    var ch3_raw = readInt16(bytes[12], bytes[13]); // SMT50 #2 Temperatur (Grün)

    // ============ SMT50 #1 (ADS1115 A0/A1) - mit Temperatur ============

    // Bodenfeuchte (Kanal A0)
    if (ch0_raw === -1 || ch0_raw === 0xFFFF) {
      decoded.smt50_1_moisture_vwc = null;
    } else {
      // Formel: % VWC = (raw / 32767.0) * 68.2667
      var moisture1 = (ch0_raw / 32767.0) * 68.2667;
      decoded.smt50_1_moisture_vwc = parseFloat(moisture1.toFixed(2));
    }

    // Temperatur (Kanal A1)
    if (ch1_raw === -1 || ch1_raw === 0xFFFF) {
      decoded.smt50_1_temp_c = null;
    } else {
      // Formel: °C = ((raw / 32767.0) * 409.6) - 50.0
      var temp1 = ((ch1_raw / 32767.0) * 409.6) - 50.0;
      decoded.smt50_1_temp_c = parseFloat(temp1.toFixed(1));
    }

    // ============ SMT50 #2 (ADS1115 A2/A3) - mit Temperatur ============

    // Bodenfeuchte (Kanal A2)
    if (ch2_raw === -1 || ch2_raw === 0xFFFF) {
      decoded.smt50_2_moisture_vwc = null;
    } else {
      var moisture2 = (ch2_raw / 32767.0) * 68.2667;
      decoded.smt50_2_moisture_vwc = parseFloat(moisture2.toFixed(2));
    }

    // Temperatur (Kanal A3)
    if (ch3_raw === -1 || ch3_raw === 0xFFFF) {
      decoded.smt50_2_temp_c = null;
    } else {
      var temp2 = ((ch3_raw / 32767.0) * 409.6) - 50.0;
      decoded.smt50_2_temp_c = parseFloat(temp2.toFixed(1));
    }

    // ============ SMT50 #3 (PA4 direkt, nur Feuchte) ============

    // SMT50 #3 wird direkt vom ADC PA4 gelesen (keine ADS1115-Umrechnung)
    // PA4: 0..3.3V = 0..3300mV
    // SMT50 Bodenfeuchte: 0V = 0%, 3V = 50%
    // Formel: % VWC = (mV / 3300) * 50
    
    if (pa4_mv === 0) {
      decoded.smt50_3_moisture_vwc = 0.0;
    } else {
      var moisture3 = (pa4_mv / 3300.0) * 50.0;
      // Clipping auf 0..50% Bereich (Sicherheit)
      moisture3 = Math.max(0, Math.min(50, moisture3));
      decoded.smt50_3_moisture_vwc = parseFloat(moisture3.toFixed(2));
    }

    // ============ SMT50 #4 (PA8 direkt, nur Feuchte) ============

    // SMT50 #4 wird direkt vom ADC PA8 gelesen (keine ADS1115-Umrechnung)
    // PA8: 0..3.3V = 0..3300mV
    // SMT50 Bodenfeuchte: 0V = 0%, 3V = 50%
    // Formel: % VWC = (mV / 3300) * 50
    
    if (pa8_mv === 0) {
      decoded.smt50_4_moisture_vwc = 0.0;
    } else {
      var moisture4 = (pa8_mv / 3300.0) * 50.0;
      // Clipping auf 0..50% Bereich (Sicherheit)
      moisture4 = Math.max(0, Math.min(50, moisture4));
      decoded.smt50_4_moisture_vwc = parseFloat(moisture4.toFixed(2));
    }
  }

  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}
