package local.promptpay.display;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/** EMV merchant-presented PromptPay credit transfer. No network or Android dependency. */
public final class PromptPay {
    private PromptPay() {}
    public static BigDecimal amount(String input) {
        if (input == null || !input.matches("[0-9]{1,7}(\\.[0-9]{1,2})?"))
            throw new IllegalArgumentException("Amount must have at most two decimals");
        BigDecimal value = new BigDecimal(input).setScale(2, RoundingMode.UNNECESSARY);
        if (value.signum() <= 0 || value.compareTo(new BigDecimal("9999999.99")) > 0)
            throw new IllegalArgumentException("Amount must be 0.01–9999999.99");
        return value;
    }
    public static String proxy(String id) {
        String clean = id == null ? "" : id.replaceAll("[ -]", "");
        if (clean.matches("0[689][0-9]{8}")) return tlv("01", "0066" + clean.substring(1));
        if (clean.matches("[0-9]{13}")) return tlv("02", clean);
        if (clean.matches("[0-9]{15}")) return tlv("03", clean);
        throw new IllegalArgumentException("Use a Thai mobile (10 digits), national/tax ID (13), or wallet ID (15)");
    }
    static String tlv(String tag, String value) {
        return tag + String.format(Locale.US, "%02d", value.length()) + value;
    }
    public static String payload(String id, BigDecimal value) {
        String data = tlv("00", "01") + tlv("01", "12")
            + tlv("29", tlv("00", "A000000677010111") + proxy(id))
            + tlv("58", "TH") + tlv("53", "764") + tlv("54", amount(value.toPlainString()).toPlainString()) + "6304";
        return data + String.format(Locale.US, "%04X", crc(data));
    }
    static int crc(String data) {
        int crc = 0xffff;
        for (char c : data.toCharArray()) {
            crc ^= c << 8;
            for (int bit = 0; bit < 8; bit++) crc = ((crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
        }
        return crc;
    }
}
