package local.promptpay.display;
import org.junit.*;
import static org.junit.Assert.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class ServerTest {
 DisplayServer server; PaymentState state;
 final String token="test-only-token-123456789";
 @Before public void start() throws Exception { state=new PaymentState(()->System.nanoTime()/1000000);server=new DisplayServer(0,"0812345678",token,60,state,()->{});server.start(1000,true); }
 @After public void stop(){server.stop();}
 private HttpURLConnection request(String method,String path,String body,String key) throws Exception {
  HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+server.getListeningPort()+path).openConnection();c.setConnectTimeout(2000);c.setReadTimeout(2000);c.setRequestMethod(method);
  if(key!=null)c.setRequestProperty("Authorization","Bearer "+key);
  if(body!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");byte[] bytes=body.getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
  return c;
 }
 private JSONObject body(HttpURLConnection c) throws Exception { try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[1024];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return new JSONObject(out.toString("UTF-8"));} finally{c.disconnect();} }
 @Test public void protectedEndpoints() throws Exception {
  for(String path:new String[]{"/show","/hide","/status"}){HttpURLConnection c=request(path.equals("/status")?"GET":"POST",path,null,"wrong");assertEquals(401,c.getResponseCode());c.disconnect();}
  assertNull(state.snapshot().amount);
 }
 @Test public void preflightAndMethods() throws Exception {
  HttpURLConnection c=request("OPTIONS","/show",null,null);assertEquals(204,c.getResponseCode());assertEquals("Authorization, Content-Type",c.getHeaderField("Access-Control-Allow-Headers"));c.disconnect();
  c=request("GET","/show",null,token);assertEquals(405,c.getResponseCode());c.disconnect();
  c=request("GET","/missing",null,token);assertEquals(404,c.getResponseCode());c.disconnect();
 }
 @Test public void showStatusHide() throws Exception {
  JSONObject shown=body(request("POST","/show","{\"amount\":259.00,\"timeout\":60}",token));assertEquals("qr",shown.getString("mode"));assertEquals(259,shown.getDouble("amount"),0);assertTrue(shown.getInt("remaining")>0);
  String status=body(request("GET","/status",null,token)).toString();assertFalse(status.contains("0812345678"));assertFalse(status.contains(token));
  JSONObject hidden=body(request("POST","/hide","{}",token));assertEquals("video",hidden.getString("mode"));assertTrue(hidden.isNull("amount"));
 }
 @Test public void badInputCannotReplacePayment() throws Exception {
  body(request("POST","/show","{\"amount\":123}",token));
  for(String json:new String[]{"{}","{","{\"amount\":0}","{\"amount\":-2}","{\"amount\":\"259\"}","{\"amount\":1.001}","{\"amount\":1,\"timeout\":0}","{\"amount\":1,\"timeout\":1.5}","{\"amount\":1,\"timeout\":3601}"}) {
   HttpURLConnection c=request("POST","/show",json,token);assertEquals(json,400,c.getResponseCode());c.disconnect();assertEquals("123.00",state.snapshot().amount.toPlainString());
  }
 }
 @Test public void expiryAndRecovery() throws Exception {
  body(request("POST","/show","{\"amount\":1,\"timeout\":1}",token));Thread.sleep(1050);
  assertEquals("video",body(request("GET","/status",null,token)).getString("mode"));
  assertEquals("qr",body(request("POST","/show","{\"amount\":2}",token)).getString("mode"));
 }
 @Test public void sizeLimit() throws Exception {
  StringBuilder large=new StringBuilder();for(int i=0;i<1025;i++)large.append(' ');
  HttpURLConnection c=request("POST","/show",large.toString(),token);assertEquals(400,c.getResponseCode());c.disconnect();
 }
}
