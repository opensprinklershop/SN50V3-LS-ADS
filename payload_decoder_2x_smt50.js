/**
 * Payload Decoder für 2x Truebner SMT50 Sensoren am SN50V3-LS ADS1115
 * 
 * Dekodiert einen 14-Byte LoRaWAN-Uplink und konvertiert die ADS1115-Rohwerte
 * direkt in Bodenfeuchte (% VWC) und Temperatur (°C) für zwei SMT50-Sensoren.
 * 
 * Konfiguration:
 * - SMT50 #1: Gelber Draht → ADS1115 A0 (Bodenfeuchte), Grüner Draht → A1 (Temperatur)
 * - SMT50 #2: Gelber Draht → ADS1115 A2 (Bodenfeuchte), Grüner Draht → A3 (Temperatur)
 * 
 * SMT50 Charakteristiken (Truebner):
 * - Bodenfeuchte: 0V = 0% VWC, 3V = 50% VWC
 * - Temperatur: 0°C bei 0.5V, +10mV pro °C; Messbereich -20..+85°C = 0.3..1.35V
 * 
 * Payload-Format (14 Bytes, Big-Endian):
 * - Byte 0-1:   Batteriespannung (uint16, mV)
 * - Byte 2-3:   ADC1 / PA4 (uint16, mV)
 * - Byte 4-5:   ADC3 / PA8 (uint16, mV)
 * - Byte 6-7:   ADS1115 A0 (int16, SMT50 #1 Bodenfeuchte)
 * - Byte 8-9:   ADS1115 A1 (int16, SMT50 #1 Temperatur)
 * - Byte 10-11: ADS1115 A2 (int16, SMT50 #2 Bodenfeuchte)
 * - Byte 12-13: ADS1115 A3 (int16, SMT50 #2 Temperatur)
 * 
 * ADS1115 Skalierung: 0V = 0, 4.096V = 32767 (1 LSB = 0.125 mV, unabhängig von der 5V-Versorgung)
 * ADS1115 Messbereich mit PGA=1: ±4.096V (für diesen Anwendungsfall max. 3V)
 * 
 * Berechnungsformeln:
 * - Spannung: V = raw * 4.096 / 32768 = raw * 0.000125
 * - Bodenfeuchte: % VWC = V * (50 / 3) = raw / 480
 * - Temperatur: °C = (V - 0.5) * 100 = raw / 80 - 50
 * 
 * @param {Object} input - TTN/ChirpStack Uplink Message
 * @returns {Object} Dekodiertes Payload-Objekt mit SMT50-Messwerten
 */
function decodeUplink(input) {
  var bytes = input.bytes;
  var decoded = {};

  if (bytes.length === 14) {
    // Batterie-Spannung (Byte 0-1)
    decoded.battery_mv = (bytes[0] << 8) | bytes[1];

    // Interner ADC1 (PA4) in mV (Byte 2-3)
    // Hinweis: Wird in dieser 2x SMT50-Konfiguration normalerweise nicht verwendet
    decoded.adc_pa4_mv = (bytes[2] << 8) | bytes[3];

    // Interner ADC3 (PA8) in mV (Byte 4-5)
    // Hinweis: Wird in dieser 2x SMT50-Konfiguration normalerweise nicht verwendet
    decoded.adc_pa8_mv = (bytes[4] << 8) | bytes[5];

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

    // I2C-Fehler: Die Firmware sendet dann auf ALLEN vier Kanälen 0xFFFF (= -1).
    // Ein einzelnes -1 ist dagegen ein gültiger Messwert (Offset bei 0V) und wird auf 0 begrenzt.
    var i2cError = (ch0_raw === -1 && ch1_raw === -1 && ch2_raw === -1 && ch3_raw === -1);

    // ============ SMT50 #1 Dekodierung ============

    // Bodenfeuchte (Kanal A0)
    if (i2cError) {
      // I2C-Fehler: ADS1115 nicht erkannt oder nicht verbunden
      decoded.smt50_1_moisture_vwc = null;
    } else {
      // Formel: % VWC = V * 50/3 = raw * 0.000125 * 50/3 = raw / 480
      // Entspricht: Spannung in V * (50/3), wobei V = raw/32767 * 4.096V
      var moisture1 = Math.max(ch0_raw, 0) / 480.0;
      // Auf 2 Dezimalstellen runden
      decoded.smt50_1_moisture_vwc = parseFloat(moisture1.toFixed(2));
    }

    // Temperatur (Kanal A1)
    if (i2cError) {
      // I2C-Fehler oder kein Sensor verbunden
      decoded.smt50_1_temp_c = null;
    } else {
      // Formel: °C = (V - 0.5) * 100 = raw * 0.0125 - 50 = raw / 80 - 50
      // Entspricht: (Spannung in V - 0.5V) * 100
      // Basis: 0.5V = 0°C, +10mV pro °C
      var temp1 = (Math.max(ch1_raw, 0) / 80.0) - 50.0;
      // Auf 1 Dezimalstelle runden
      decoded.smt50_1_temp_c = parseFloat(temp1.toFixed(1));
    }

    // ============ SMT50 #2 Dekodierung ============

    // Bodenfeuchte (Kanal A2)
    if (i2cError) {
      decoded.smt50_2_moisture_vwc = null;
    } else {
      var moisture2 = Math.max(ch2_raw, 0) / 480.0;
      decoded.smt50_2_moisture_vwc = parseFloat(moisture2.toFixed(2));
    }

    // Temperatur (Kanal A3)
    if (i2cError) {
      decoded.smt50_2_temp_c = null;
    } else {
      var temp2 = (Math.max(ch3_raw, 0) / 80.0) - 50.0;
      decoded.smt50_2_temp_c = parseFloat(temp2.toFixed(1));
    }
  }

  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}
