# PromptPay Display — Android

A native Java application for Android **4.4 / API 19 and newer**, including old **armeabi-v7a / 32-bit ARM** hardware. No WebView, native `.so` libraries, NDK, cloud service, or video streaming. The universal APK contains DEX bytecode and supports 32-bit ARM as well as 64-bit devices. ZXing 3.3.3 is intentionally pinned for old Android compatibility; NanoHTTPD 2.3.1 is the only other runtime library.

## Build an APK

Install a JDK (17 or 21), Android SDK platform 35 and build tools, or open this directory in Android Studio. The checked-in Gradle wrapper uses Gradle 8.11.1 and Android Gradle Plugin 8.8.2. `compileSdk` and `targetSdk` are 35; `minSdk` remains 19. No project depends on the extension.

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk" # macOS example; use your own SDK path
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Windows: use `gradlew.bat`. The first build downloads dependencies. Later builds can use `--offline` once cached. Output: `app/build/outputs/apk/debug/app-debug.apk`. This APK is debug-signed; configure your own release signing key for a managed deployment. There is no signing secret in the project.

## Install and configure

1. Transfer the APK to the device and allow installation from that source, or use `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
2. Open **PromptPay Display**. The HTTP server starts automatically on port **8080**. First launch opens Settings.
3. Enter the **registered PromptPay identifier**: a Thai mobile number such as `0812345678` (10 digits), a 13-digit national/tax ID, or a 15-digit supported wallet identifier. Only enter an identifier registered to the intended payee. Format validation does not prove registration or ownership.
4. Set the port (1024–65535) and default timeout (1–3600 seconds).
5. A random API token is generated on first launch. Copy it from Settings into the extension. You may replace it with 16–128 ASCII letters/digits or `. _ ~ + -`. The token is visible locally in Settings for setup, but never returned over the API.
6. Tap **Choose local video**. Pick a video stored on the device. The picker requests local files only; the app streams a copy to private storage using a 64 KB buffer. Playback no longer depends on the original URI or removable storage. Keep enough free space for the new copy. A failed import leaves the old file in place.
7. Tap **Save**. Settings shows **Server: Running** and the current IPv4 addresses/port. All active interfaces are listed; choose the Wi-Fi LAN address reachable by the PC. Addresses refresh every two seconds while Settings is open. A port conflict shows an explicit error; fix the port and save again.
8. Close Settings. During a payment the setup button hides; use Android Back to open Settings. The local video loops. Video is muted, aspect ratio is preserved (letterboxing when needed), and the screen stays awake while the activity is visible.

For old hardware use H.264 baseline MP4 at 480p or 720p with modest bitrate. Codec support depends on the device. Avoid 4K, HEVC, and high profiles. The app retries playback failures with a bounded 2–30 second delay and an on-screen message. Replace unsupported videos in Settings. No video is bundled with the application.

## Test the API

Replace the IP and token below with your configured values. All control/status endpoints are protected. Do not use the example identifier or test token for real payments.

```sh
export DISPLAY_TOKEN='your-configured-token'
curl --fail-with-body -H "Authorization: Bearer $DISPLAY_TOKEN"   http://192.168.1.50:8080/status

curl --fail-with-body -H "Authorization: Bearer $DISPLAY_TOKEN"   -H 'Content-Type: application/json'   -d '{"amount":259.00,"timeout":60}'   http://192.168.1.50:8080/show

curl --fail-with-body -H "Authorization: Bearer $DISPLAY_TOKEN"   -H 'Content-Type: application/json' -d '{}'   http://192.168.1.50:8080/hide
```

Expect 401 without the token. `/show` pauses/hides video, displays a QR with the amount and countdown, then resumes video at expiry. `/hide` immediately returns to video. Another `/show` replaces the amount and resets the deadline. [Full API contract](../README.md#http-contract).

## QR implementation

`PromptPay.java` builds an EMV merchant-presented dynamic payload with format `01`, initiation method `12`, PromptPay AID `A000000677010111`, mobile/national-ID/wallet proxy subtags, currency `764`, country `TH`, a fixed two-decimal amount and CRC-16/CCITT-FALSE. Mobile numbers become `0066` plus the mobile number without its leading zero. CRC covers the complete payload through `6304`. ZXing encodes the ASCII payload locally with a four-module quiet zone. A 512×512 RGB565 bitmap is created once per payment and reused throughout countdown. No per-frame video processing occurs.

## Reliability and limits

- Synchronized state transitions; monotonic deadlines prevent clock-change bugs. Invalid requests do not change an existing payment.
- HTTP connections have a three-second read timeout. A bounded pool (2 core, 4 maximum workers, 8 queued clients) and 1 KB show-body limit keep request handling small. Connections close after responses.
- The server binds all interfaces, so Wi-Fi reconnection needs no app restart. A changed LAN IP must be updated in the extension.
- Keep the activity open. No background-service or boot-autostart promise is made. Use Android screen pinning or your device's kiosk launcher if available. Relaunching the app restarts the server; pending payments are intentionally not persisted.
- API `mode: video` describes the idle display state, even if no playable video has been configured. Check the screen for playback errors.
- The UI is deliberately plain and English-only. Remaining lint warnings concern translation strings, the cleartext attribute ignored on pre-23 Android, and the intentionally old ZXing pin.
- The identifier is stored in app-private preferences. The shared token is local access control, not encryption; use only a trusted LAN.

## Tests

`PaymentTest` covers amount bounds, proxy formats, the standard CRC vector, QR encode/decode and timeout replacement. `ServerTest` exercises actual local sockets for authorization, CORS, methods, JSON validation, size limits, expiry and recovery. See `../verification/` for emulator smoke checks. Scan a test QR with your actual bank app and verify payee/amount without submitting a transfer before operational use. Physical 32-bit hardware and its video decoder still need acceptance testing.
