package local.promptpay.display;
import org.junit.Test;
import static org.junit.Assert.*;
import java.math.BigDecimal;
import com.google.zxing.*;
import com.google.zxing.common.*;
import com.google.zxing.qrcode.*;

public class PaymentTest {
 @Test public void validatesAmounts() {
  for (String s : new String[]{"", "0", "-1", "NaN", "1.001", "10000000", "1e2", "1,000", " 2"}) {
   try { PromptPay.amount(s); fail(s); } catch(IllegalArgumentException expected) {}
  }
  assertEquals("1259.00", PromptPay.amount("1259").toPlainString());
  assertEquals("0.01", PromptPay.amount("0.01").toPlainString());
 }
 @Test public void crcReference() { assertEquals(0x29b1, PromptPay.crc("123456789")); }
 @Test public void proxies() {
  assertEquals("01130066812345678",PromptPay.proxy("081-234-5678"));
  assertEquals("02131111111111119",PromptPay.proxy("1111111111119"));
  assertEquals("0315140001234567890",PromptPay.proxy("140001234567890"));
  try { PromptPay.proxy("1234"); fail(); } catch(IllegalArgumentException expected) {}
 }
 @Test public void qrRoundTrip() throws Exception {
  String payload=PromptPay.payload("0812345678",new BigDecimal("259.00"));
  assertEquals("00020101021229370016A000000677010111011300668123456785802TH53037645406259.0063042480", payload);
  assertTrue(payload.startsWith("00020101021229370016A00000067701011101130066812345678"));
  assertTrue(payload.contains("5802TH53037645406259.00"));
  final BitMatrix matrix=new QRCodeWriter().encode(payload,BarcodeFormat.QR_CODE,256,256);
  LuminanceSource pixels=new LuminanceSource(256,256) {
   public byte[] getRow(int y,byte[] row) { if(row==null || row.length<256)row=new byte[256]; for(int x=0;x<256;x++)row[x]=(byte)(matrix.get(x,y)?0:255); return row; }
   public byte[] getMatrix() { byte[] out=new byte[256*256]; for(int y=0;y<256;y++)System.arraycopy(getRow(y,null),0,out,y*256,256);return out; }
  };
  assertEquals(payload,new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(pixels))).getText());
 }
 @Test public void replacementAndExpiry() {
  final long[] now={1000}; PaymentState state=new PaymentState(()->now[0]);
  assertNull(state.snapshot().amount);
  state.show("0812345678","259",60); assertEquals(60,state.snapshot().remaining);
  now[0]+=1001; assertEquals(59,state.snapshot().remaining);
  state.show("0812345678","120",2); assertEquals("120.00",state.snapshot().amount.toPlainString());
  try { state.show("0812345678","-1",1); fail(); } catch(IllegalArgumentException expected){}
  assertEquals("120.00",state.snapshot().amount.toPlainString());
  now[0]+=2000; assertNull(state.snapshot().amount);
  state.show("0812345678","1",60); state.hide(); assertNull(state.snapshot().amount);
 }
}
