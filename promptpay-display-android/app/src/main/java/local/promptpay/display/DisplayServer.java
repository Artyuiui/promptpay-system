package local.promptpay.display;

import fi.iki.elonen.NanoHTTPD;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.Charset;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** Small bounded HTTP/1.1 service. All control routes require a shared bearer token. */
public final class DisplayServer extends NanoHTTPD {
    private final PaymentState state;
    private final String id, token;
    private final int timeout;
    private final Runnable changed;
    private final BoundedRunner runner = new BoundedRunner();
    public DisplayServer(int port, String id, String token, int timeout, PaymentState state, Runnable changed) {
        super(port); this.id = id; this.token = token; this.timeout = timeout; this.state = state; this.changed = changed;
        setAsyncRunner(runner);
    }
    @Override public void stop() { super.stop(); runner.pool.shutdownNow(); }
    private static final class BoundedRunner implements AsyncRunner {
        final ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 4, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<Runnable>(8));
        final Set<ClientHandler> clients = Collections.synchronizedSet(new HashSet<ClientHandler>());
        public void exec(final ClientHandler client) {
            clients.add(client);
            try { pool.execute(new Runnable() { public void run() { try { client.run(); } finally { clients.remove(client); } } }); }
            catch (RejectedExecutionException e) { clients.remove(client); client.close(); }
        }
        public void closed(ClientHandler client) { clients.remove(client); }
        public void closeAll() { synchronized (clients) { for (ClientHandler client : clients) client.close(); clients.clear(); } }
    }
    private Response json(Response.Status code, String text) {
        Response response = newFixedLengthResponse(code, "application/json; charset=utf-8", text);
        response.addHeader("Access-Control-Allow-Origin", "*");
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.addHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
        response.addHeader("Access-Control-Allow-Private-Network", "true");
        response.addHeader("Cache-Control", "no-store");
        response.addHeader("Connection", "close");
        return response;
    }
    private Response error(Response.Status code, String message) {
        try { return json(code, new JSONObject().put("error", message).toString()); }
        catch (Exception e) { return json(code, "{\"error\":\"Request failed\"}"); }
    }
    @Override public Response serve(IHTTPSession session) {
        String path = session.getUri();
        if (!path.equals("/show") && !path.equals("/hide") && !path.equals("/status"))
            return error(Response.Status.NOT_FOUND, "Unknown endpoint");
        if (session.getMethod() == Method.OPTIONS) return json(Response.Status.NO_CONTENT, "");
        String auth = session.getHeaders().get("authorization");
        if (token.length() < 16 || auth == null || !MessageDigest.isEqual(
            ("Bearer " + token).getBytes(Charset.forName("UTF-8")), auth.getBytes(Charset.forName("UTF-8"))))
            return error(Response.Status.UNAUTHORIZED, "Invalid API token");
        try {
            if (path.equals("/status") && session.getMethod() == Method.GET) return status();
            if (session.getMethod() != Method.POST || path.equals("/status"))
                return error(Response.Status.METHOD_NOT_ALLOWED, "Incorrect method");
            if (path.equals("/hide")) { state.hide(); changed.run(); return status(); }
            String type = session.getHeaders().get("content-type");
            if (type == null || !type.split(";")[0].trim().equalsIgnoreCase("application/json"))
                return error(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Use application/json");
            if (session.getHeaders().containsKey("transfer-encoding"))
                return error(Response.Status.BAD_REQUEST, "Chunked bodies are not supported");
            int length;
            try { length = Integer.parseInt(session.getHeaders().get("content-length")); }
            catch (Exception e) { return error(Response.Status.BAD_REQUEST, "Content-Length required"); }
            if (length < 1 || length > 1024) return error(Response.Status.BAD_REQUEST, "Body must be 1–1024 bytes");
            byte[] bytes = new byte[length]; int offset = 0;
            while (offset < length) {
                int count = session.getInputStream().read(bytes, offset, length - offset);
                if (count < 0) throw new IOException("Incomplete body");
                offset += count;
            }
            JSONObject body = new JSONObject(new String(bytes, "UTF-8"));
            Object amount = body.get("amount");
            if (!(amount instanceof Number)) throw new IllegalArgumentException("Amount must be a JSON number");
            int seconds = timeout;
            if (body.has("timeout")) {
                Object t = body.get("timeout");
                if (!(t instanceof Number) || !t.toString().matches("[0-9]{1,4}"))
                    throw new IllegalArgumentException("Timeout must be an integer");
                seconds = Integer.parseInt(t.toString());
            }
            state.show(id, amount.toString(), seconds); changed.run(); return status();
        } catch (IllegalArgumentException e) { return error(Response.Status.BAD_REQUEST, e.getMessage()); }
        catch (Exception e) { return error(Response.Status.BAD_REQUEST, "Malformed or incomplete JSON request"); }
    }
    private Response status() throws Exception {
        PaymentState.Snapshot s = state.snapshot();
        JSONObject result = new JSONObject().put("online", true).put("mode", s.amount == null ? "video" : "qr")
            .put("amount", s.amount == null ? JSONObject.NULL : s.amount);
        if (s.amount != null) result.put("remaining", s.remaining);
        return json(Response.Status.OK, result.toString());
    }
}
