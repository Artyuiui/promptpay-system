package local.promptpay.display;

import java.math.BigDecimal;

/** All transitions and snapshots are serialized; elapsed time survives wall-clock changes. */
public final class PaymentState {
    public interface Clock { long now(); }
    public static final class Snapshot {
        public final BigDecimal amount;
        public final String payload;
        public final int remaining;
        public final long revision;
        Snapshot(BigDecimal amount, String payload, int remaining, long revision) {
            this.amount = amount; this.payload = payload; this.remaining = remaining; this.revision = revision;
        }
    }
    private final Clock clock;
    private BigDecimal amount;
    private String payload;
    private long deadline, revision;
    public PaymentState(Clock clock) { this.clock = clock; }
    public synchronized void show(String id, String rawAmount, int seconds) {
        if (seconds < 1 || seconds > 3600) throw new IllegalArgumentException("Timeout must be 1–3600 seconds");
        BigDecimal next = PromptPay.amount(rawAmount);
        String nextPayload = PromptPay.payload(id, next);
        amount = next; payload = nextPayload; deadline = clock.now() + seconds * 1000L; revision++;
    }
    public synchronized void hide() { amount = null; payload = null; deadline = 0; revision++; }
    public synchronized Snapshot snapshot() {
        if (amount != null && clock.now() >= deadline) hide();
        int remaining = amount == null ? 0 : (int)((deadline - clock.now() + 999) / 1000);
        return new Snapshot(amount, payload, remaining, revision);
    }
}
