/**
 * Generischer Payload Decoder für SN50V3-LS ADS1115
 * 
 * Konvertiert alle 14 Bytes in Spannungswerte (mV) ohne Spezialisierung.
 * Verwendbar für beliebige analoge Eingänge an den ADS1115-Kanälen.
 * 
 * Payload-Format (14 Bytes, Big-Endian):
 * - Byte 0-1:   Batteriespannung (uint16, mV)
 * - Byte 2-3:   ADC1 / PA4 (uint16, mV)
 * - Byte 4-5:   ADC3 / PA8 (uint16, mV)
 * - Byte 6-7:   ADS1115 Kanal A0 (int16, raw value)
 * - Byte 8-9:   ADS1115 Kanal A1 (int16, raw value)
 * - Byte 10-11: ADS1115 Kanal A2 (int16, raw value)
 * - Byte 12-13: ADS1115 Kanal A3 (int16, raw value)
 * 
 * ADS1115 Skalierung: 0V = 0, 5V = 32767 (unter Annahme von 5V Betriebsspannung)
 * 
 * @param {Object} input - TTN/ChirpStack Uplink Message
 * @returns {Object} Dekodiertes Payload-Objekt
 */
function decodeUplink(input) {
  var bytes = input.bytes;
  var decoded = {};

  if (bytes.length === 14) {
    // Batterie-Spannung (Byte 0-1)
    // Dargestellt als uint16, Big-Endian (MSB zuerst)
    decoded.battery_mv = (bytes[0] << 8) | bytes[1];

    // Interner ADC1 (PA4) in mV (Byte 2-3)
    // Dieser Wert wird direkt vom Microcontroller-ADC gelesen (0..3.3V = 0..3300mV)
    decoded.adc_pa4_mv = (bytes[2] << 8) | bytes[3];

    // Interner ADC3 (PA8) in mV (Byte 4-5)
    // Dieser Wert wird direkt vom Microcontroller-ADC gelesen (0..3.3V = 0..3300mV)
    decoded.adc_pa8_mv = (bytes[4] << 8) | bytes[5];

    /**
     * Hilfsfunktion: Konvertiert zwei Bytes zu vorzeichenbehaftetem 16-Bit-Wert
     * @param {number} b1 - High Byte (MSB)
     * @param {number} b2 - Low Byte (LSB)
     * @returns {number} Vorzeichenbehafteter 16-Bit-Wert (-32768 bis 32767)
     */
    function readInt16(b1, b2) {
      var val = (b1 << 8) | b2;
      // Wenn Bit 15 gesetzt ist (Wert >= 0x8000), handelt es sich um eine negative Zahl
      // In diesem Fall wird die Zweierkomplement-Darstellung benutzt
      return val >= 0x8000 ? val - 0x10000 : val;
    }

    // ADS1115 Kanäle auslesen
    var ch0_raw = readInt16(bytes[6], bytes[7]);   // A0
    var ch1_raw = readInt16(bytes[8], bytes[9]);   // A1
    var ch2_raw = readInt16(bytes[10], bytes[11]); // A2
    var ch3_raw = readInt16(bytes[12], bytes[13]); // A3

    // Konvertierung zu Millivolt unter Annahme von 5V Referenzspannung
    // Formel: mV = (raw / 32767.0) * 5000
    // Falls ein I2C-Fehler vorliegt (Wert -1), wird null zurückgegeben
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
