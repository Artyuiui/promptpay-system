package local.promptpay.display;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import com.google.zxing.*;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private final Handler handler = new Handler();
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private final PaymentState state = new PaymentState(new PaymentState.Clock() { public long now() { return SystemClock.elapsedRealtime(); } });
    private android.content.SharedPreferences prefs;
    private DisplayServer server;
    private VideoView video;
    private Button settingsButton;
    private LinearLayout qr;
    private TextView amount, countdown, notice;
    private ImageView image;
    private Bitmap bitmap;
    private long rendered = -1;
    private boolean foreground, destroyed;
    private int failures;
    private String serverError = "";
    private File videoFile() { return new File(getFilesDir(), "idle-video"); }
    private final Runnable tick = new Runnable() { public void run() { render(); if (foreground) handler.postDelayed(this, 250); } };
    private final Runnable retry = new Runnable() { public void run() { if (foreground && state.snapshot().amount == null) loadVideo(); } };
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN);
        prefs = getSharedPreferences("display", MODE_PRIVATE);
        if (!prefs.contains("token")) prefs.edit().putString("token", UUID.randomUUID().toString()).apply();
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.BLACK);
        video = new VideoView(this);
        FrameLayout.LayoutParams vp = new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER);
        root.addView(video, vp);
        notice = text("Choose a local video in Settings", 22, Color.WHITE); notice.setGravity(Gravity.CENTER);
        root.addView(notice, new FrameLayout.LayoutParams(-1, -1));
        qr = new LinearLayout(this); qr.setOrientation(LinearLayout.VERTICAL); qr.setGravity(Gravity.CENTER); qr.setPadding(16,16,16,16); qr.setBackgroundColor(Color.WHITE);
        qr.addView(text("PROMPTPAY", 23, Color.rgb(15,70,90)));
        amount = text("", 36, Color.BLACK); qr.addView(amount);
        image = new ImageView(this); image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        qr.addView(image, new LinearLayout.LayoutParams(-1, 0, 1));
        qr.addView(text("Scan to Pay", 20, Color.BLACK)); countdown = text("", 22, Color.BLACK); qr.addView(countdown);
        qr.setVisibility(View.GONE); root.addView(qr, new FrameLayout.LayoutParams(-1,-1));
        Button settings = new Button(this); settingsButton = settings; settings.setText("Settings / IP"); settings.setAlpha(0.7f);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.END); root.addView(settings,sp);
        settings.setOnClickListener(v -> settings()); setContentView(root);
        video.setOnPreparedListener(player -> { failures = 0; player.setLooping(true); player.setVolume(0,0); if (foreground && state.snapshot().amount == null) { video.start(); notice.setVisibility(View.GONE); } });
        video.setOnErrorListener((player, what, extra) -> { video.stopPlayback(); notice.setText("Video playback failed. Retrying…\nUse H.264 baseline MP4, 480p or 720p."); notice.setVisibility(View.VISIBLE); handler.removeCallbacks(retry); handler.postDelayed(retry, Math.min(30000, 2000L << Math.min(failures++, 4))); return true; });
        startServer();
        if (prefs.getString("id", "").isEmpty()) handler.post(() -> settings());
    }
    private TextView text(String s, int size, int color) { TextView t = new TextView(this); t.setText(s); t.setTextSize(size); t.setTextColor(color); t.setGravity(Gravity.CENTER); return t; }
    private void startServer() {
        if (server != null) server.stop(); server = null;
        try {
            server = new DisplayServer(prefs.getInt("port",8080), prefs.getString("id",""), prefs.getString("token",""), prefs.getInt("timeout",60), state, () -> handler.post(() -> render()));
            server.start(3000, true); serverError = "";
        } catch (IOException e) { serverError = "Cannot bind port: " + e.getMessage(); if (server != null) server.stop(); server = null; Toast.makeText(this,serverError,Toast.LENGTH_LONG).show(); }
    }
    private void loadVideo() {
        if (!videoFile().exists()) { notice.setText("Choose a local video in Settings"); notice.setVisibility(View.VISIBLE); return; }
        video.setVideoPath(videoFile().getAbsolutePath());
    }
    private void render() {
        if (destroyed) return;
        PaymentState.Snapshot s = state.snapshot();
        if (s.revision != rendered) {
            rendered = s.revision;
            if (s.amount == null) {
                qr.setVisibility(View.GONE); video.setVisibility(View.VISIBLE); settingsButton.setVisibility(View.VISIBLE);
                image.setImageDrawable(null); if (bitmap != null) { bitmap.recycle(); bitmap = null; }
                if (foreground && videoFile().exists()) video.start();
            } else {
                video.pause(); video.setVisibility(View.INVISIBLE); qr.setVisibility(View.VISIBLE); settingsButton.setVisibility(View.GONE);
                amount.setText("฿" + s.amount.toPlainString());
                try {
                    Map<EncodeHintType,Object> hints = new EnumMap<>(EncodeHintType.class); hints.put(EncodeHintType.MARGIN, 4);
                    BitMatrix matrix = new QRCodeWriter().encode(s.payload, BarcodeFormat.QR_CODE, 512, 512, hints);
                    Bitmap next = Bitmap.createBitmap(512,512,Bitmap.Config.RGB_565);
                    int[] row = new int[512];
                    for (int y=0;y<512;y++) { for (int x=0;x<512;x++) row[x] = matrix.get(x,y) ? Color.BLACK : Color.WHITE; next.setPixels(row,0,512,0,y,512,1); }
                    image.setImageBitmap(next); if (bitmap != null) bitmap.recycle(); bitmap = next;
                } catch (Exception e) { state.hide(); rendered = -1; Toast.makeText(this,"QR rendering failed",Toast.LENGTH_LONG).show(); }
            }
        }
        if (s.amount != null) countdown.setText(String.format(Locale.US,"%02d:%02d",s.remaining/60,s.remaining%60));
    }
    private String addresses() {
        StringBuilder result = new StringBuilder();
        try { Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) { NetworkInterface n = interfaces.nextElement(); if (!n.isUp() || n.isLoopback()) continue;
                Enumeration<InetAddress> addresses = n.getInetAddresses(); while (addresses.hasMoreElements()) { InetAddress a = addresses.nextElement(); if (a instanceof Inet4Address && !a.isLoopbackAddress()) result.append(a.getHostAddress()).append(":").append(prefs.getInt("port",8080)).append("\n"); }
            }
        } catch (Exception ignored) {}
        return result.length()==0 ? "No LAN IPv4 address — connect Wi-Fi" : result.toString();
    }
    private EditText field(LinearLayout box, String label, String value, int type) {
        box.addView(text(label,16,Color.DKGRAY)); EditText input = new EditText(this); input.setSingleLine(true); input.setInputType(type); input.setText(value); box.addView(input); return input;
    }
    private void settings() {
        LinearLayout box = new LinearLayout(this); box.setPadding(24,12,24,12); box.setOrientation(LinearLayout.VERTICAL);
        TextView status = text("",16,Color.DKGRAY); box.addView(status);
        final Runnable refresh = new Runnable() { public void run() { status.setText("Server: " + (server == null ? serverError : "Running") + "\n" + addresses() + "\nStatus: " + (state.snapshot().amount == null ? "Waiting for commands" : "Showing QR")); handler.postDelayed(this,2000); } }; refresh.run();
        EditText id = field(box,"PromptPay ID",prefs.getString("id",""),android.text.InputType.TYPE_CLASS_PHONE);
        EditText port = field(box,"HTTP port",Integer.toString(prefs.getInt("port",8080)),android.text.InputType.TYPE_CLASS_NUMBER);
        EditText seconds = field(box,"Default timeout (1–3600 seconds)",Integer.toString(prefs.getInt("timeout",60)),android.text.InputType.TYPE_CLASS_NUMBER);
        EditText token = field(box,"API token (16+ characters)",prefs.getString("token",""),android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        Button choose = new Button(this); choose.setText("Choose local video (copied into app)"); box.addView(choose);
        choose.setOnClickListener(v -> { Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT); pick.setType("video/*"); pick.addCategory(Intent.CATEGORY_OPENABLE); pick.putExtra(Intent.EXTRA_LOCAL_ONLY,true); startActivityForResult(pick,10); });
        ScrollView scroll = new ScrollView(this); scroll.addView(box);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("PromptPay Display").setView(scroll).setPositiveButton("Save",null).setNegativeButton("Close",null).create();
        dialog.setOnDismissListener(d -> handler.removeCallbacks(refresh));
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            try {
                String identifier = id.getText().toString().trim(); PromptPay.proxy(identifier);
                int p = Integer.parseInt(port.getText().toString()); int t = Integer.parseInt(seconds.getText().toString()); String key = token.getText().toString().trim();
                if (p<1024 || p>65535 || t<1 || t>3600 || !key.matches("[A-Za-z0-9._~+-]{16,128}")) throw new IllegalArgumentException("Port 1024–65535; timeout 1–3600; token 16–128 ASCII letters/digits or . _ ~ + -");
                prefs.edit().putString("id",identifier).putInt("port",p).putInt("timeout",t).putString("token",key).apply();
                state.hide(); startServer(); rendered=-1; render(); if (server != null) dialog.dismiss();
            } catch (Exception e) { Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show(); }
        })); dialog.show();
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if (request != 10 || result != RESULT_OK || data == null) return;
        final Uri uri = data.getData(); Toast.makeText(this,"Copying local video…",Toast.LENGTH_SHORT).show();
        files.execute(() -> {
            File temp = new File(getFilesDir(),"idle-video.tmp");
            try (InputStream in = getContentResolver().openInputStream(uri); OutputStream out = new FileOutputStream(temp)) {
                if (in == null) throw new IOException("Cannot open video");
                byte[] buffer = new byte[65536]; int count; while ((count=in.read(buffer))!=-1) out.write(buffer,0,count);
                out.flush(); if (temp.length()==0) throw new IOException("Video is empty");
                handler.post(() -> { if (destroyed) return; video.stopPlayback(); if (!temp.renameTo(videoFile())) { Toast.makeText(this,"Cannot save video",Toast.LENGTH_LONG).show(); loadVideo(); return; } failures=0; loadVideo(); });
            } catch (Exception e) { temp.delete(); handler.post(() -> { if (!destroyed) Toast.makeText(this,"Copy failed: " + e.getMessage(),Toast.LENGTH_LONG).show(); }); }
        });
    }
    @Override public void onBackPressed() { settings(); }
    @Override protected void onResume() { super.onResume(); foreground=true; rendered=-1; loadVideo(); handler.removeCallbacks(tick); tick.run(); }
    @Override protected void onPause() { foreground=false; handler.removeCallbacks(tick); handler.removeCallbacks(retry); video.pause(); super.onPause(); }
    @Override protected void onDestroy() { destroyed=true; handler.removeCallbacksAndMessages(null); files.shutdownNow(); if(server!=null)server.stop(); video.stopPlayback(); super.onDestroy(); }
}
