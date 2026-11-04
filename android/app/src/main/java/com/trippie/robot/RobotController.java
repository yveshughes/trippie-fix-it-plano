package com.trippie.robot;

import android.annotation.SuppressLint;
import android.bluetooth.*;
import android.content.Context;
import android.os.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/** Foreground BLE controller. Motion writes are never retried after an ambiguous result. */
@SuppressLint("MissingPermission")
final class RobotController {
  interface Listener {
    void onState(String message, boolean active, boolean connected);

    void onBenchStopSent();

    void onBenchSequenceComplete();
  }

  private final Context context;
  private final Handler main = new Handler(Looper.getMainLooper());
  private final Listener listener;
  private BluetoothGatt gatt;
  private BluetoothGattCharacteristic tx;
  private boolean ready,
      connecting,
      active,
      startRequested,
      closing,
      bench,
      autoStopBench,
      seenStart,
      stopping;
  private int epoch, progress, batchSteps;
  private Runnable guidedDone;
  private boolean guided;
  private final Runnable guidedStop = () -> finishGuidedAction();
  private long deadline;
  private final ArrayDeque<Operation> queue = new ArrayDeque<>();
  private Operation pending;
  private RobotProtocol.Decoder decoder = new RobotProtocol.Decoder();
  private Runnable timeout;
  private final Runnable deadlineStop = () -> stop("Trip duration reached");
  private final Runnable sequenceWatchdog = () -> stop("Sequence feedback timed out · check car");
  private static final String ADDRESS =
      "88:1B:99:17:FE:8C"; // Replacement unit verified in the prior official-app trial.

  private static final class Operation {
    final byte[] bytes;
    final String label;
    final int epoch;
    final Runnable done;

    Operation(byte[] bytes, String label, int epoch, Runnable done) {
      this.bytes = bytes;
      this.label = label;
      this.epoch = epoch;
      this.done = done;
    }
  }

  RobotController(Context context, Listener listener) {
    this.context = context.getApplicationContext();
    this.listener = listener;
  }

  boolean isActive() {
    return active || startRequested || stopping;
  }

  boolean isConnected() {
    return ready;
  }

  boolean isConnecting() {
    return connecting;
  }

  String activityLabel() {
    if (stopping) return "Stopping…";
    if (active && bench) return "Testing wheels…";
    if (active && seenStart) return "En route";
    if (active) return "Preparing…";
    if (connecting) return "Connecting…";
    return "Begin Trip";
  }

  void connect() {
    if (ready) {
      state("Car connected · replacement FE:8C");
      if (startRequested) start();
      return;
    }
    if (connecting) return;
    closing = false;
    BluetoothManager manager =
        (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
    BluetoothAdapter adapter = manager.getAdapter();
    if (adapter == null || !adapter.isEnabled()) {
      startRequested = false;
      state("Turn on phone Bluetooth and the car");
      return;
    }
    connecting = true;
    state("Connecting to replacement car…");
    log("connect", ADDRESS);
    try {
      gatt =
          adapter
              .getRemoteDevice(ADDRESS)
              .connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE);
      timeout = () -> fault("Car not found · turn it on and close the official app");
      main.postDelayed(timeout, 15000);
    } catch (SecurityException error) {
      fault("Nearby devices permission required");
    }
  }

  /** One bounded action, followed by an acknowledged Stop before another camera assessment. */
  boolean moveOne(String action, long validUntil, Runnable done) {
    byte[] command = RobotProtocol.direction(action);
    if (!ready || isActive() || closing || SystemClock.elapsedRealtime() >= validUntil)
      return false;
    guided = true;
    guidedDone = done;
    bench = false;
    active = true;
    seenStart = false;
    int run = ++epoch;
    state("Preparing · " + action + " · obstacle avoidance on");
    enqueue(
        RobotProtocol.mode2(),
        "guided_mode2",
        run,
        () ->
            enqueue(
                RobotProtocol.avoidanceOn(),
                "guided_avoidance",
                run,
                () ->
                    enqueue(
                        RobotProtocol.clear(),
                        "guided_clear",
                        run,
                        () -> {
                          if (run != epoch || !active) return;
                          if (SystemClock.elapsedRealtime() >= validUntil) {
                            finishGuidedAction();
                            return;
                          }
                          // Supplement the finite native one-step program with a timed Stop
                          // attempt.
                          // GATT delivery can delay this; it is not a physical 1200 ms guarantee.
                          main.postDelayed(guidedStop, 1200);
                          enqueue(
                              command,
                              "guided_" + action,
                              run,
                              () -> {
                                if (run == epoch && active) {
                                  seenStart = true;
                                  state("En route · " + action);
                                }
                              });
                        })));
    return true;
  }

  private void finishGuidedAction() {
    if (!guided || !active) return;
    Runnable completed = guidedDone;
    guidedDone = null;
    stop("Looking again after one action", completed);
  }

  void begin(boolean benchTest, boolean autoStopTest) {
    if (isActive() || closing) return;
    bench = benchTest;
    autoStopBench = autoStopTest;
    startRequested = true;
    if (ready) start();
    else connect();
  }

  private void start() {
    if (!ready || !startRequested) return;
    startRequested = false;
    active = true;
    int run = ++epoch;
    deadline = SystemClock.elapsedRealtime() + 60000;
    state(
        bench
            ? (autoStopBench
                ? "Bench test · wheels raised · auto-stop after 2 seconds"
                : "Bench sequence check · five forward steps")
            : "Trip running · Mode 2 · avoidance requested");
    enqueue(
        RobotProtocol.mode2(),
        "mode2",
        run,
        () ->
            main.postDelayed(
                () -> {
                  if (run != epoch || !active) return;
                  enqueue(
                      RobotProtocol.avoidanceOn(),
                      "avoidance_on",
                      run,
                      () ->
                          main.postDelayed(
                              () -> {
                                if (run != epoch || !active) return;
                                nextBatch();
                              },
                              300));
                },
                300));
  }

  private void nextBatch() {
    if (!active || !ready) return;
    if (!bench && SystemClock.elapsedRealtime() >= deadline) {
      stop("Trip duration reached");
      return;
    }
    int run = epoch;
    batchSteps = bench ? 5 : 10;
    progress = 0;
    seenStart = false;
    enqueue(
        RobotProtocol.clear(),
        "clear_before_route",
        run,
        () ->
            main.postDelayed(
                () -> {
                  if (run != epoch || !active) return;
                  enqueue(
                      RobotProtocol.forward(batchSteps),
                      "forward_" + batchSteps,
                      run,
                      () -> {
                        if (run != epoch || !active) return;
                        main.removeCallbacks(sequenceWatchdog);
                        main.postDelayed(sequenceWatchdog, 25000);
                        if (bench && autoStopBench)
                          main.postDelayed(
                              () -> {
                                if (run == epoch && active) stop("Bench stop check");
                              },
                              2000);
                        else if (!bench) {
                          main.removeCallbacks(deadlineStop);
                          main.postDelayed(
                              deadlineStop, Math.max(1, deadline - SystemClock.elapsedRealtime()));
                        }
                      });
                },
                300));
  }

  void stop(String reason) {
    stop(reason, null);
  }

  private void stop(String reason, Runnable afterStop) {
    guidedDone = null;
    guided = false;
    main.removeCallbacks(guidedStop);
    if (stopping) return;
    startRequested = false;
    active = false;
    int run = ++epoch;
    queue.clear();
    main.removeCallbacks(deadlineStop);
    main.removeCallbacks(sequenceWatchdog);
    log("stop_requested", reason);
    if (!ready) {
      state("Trip cancelled · if car is moving switch it off");
      return;
    }
    stopping = true;
    state("Sending stop…");
    // Clear first: a subsequent Go cannot intentionally restart a stored route.
    // This stop sequence is bench-tested before continuous trips are enabled.
    enqueue(
        RobotProtocol.clear(),
        "stop_clear",
        run,
        () ->
            main.postDelayed(
                () -> {
                  if (run != epoch || !ready) return;
                  enqueue(
                      RobotProtocol.go(),
                      "stop_go_empty",
                      run,
                      () -> {
                        stopping = false;
                        state("Stop sent · confirm car is stationary");
                        if (bench && autoStopBench) listener.onBenchStopSent();
                        if (closing) disconnect();
                        else if (afterStop != null) afterStop.run();
                      });
                },
                300));
  }

  private void enqueue(byte[] bytes, String label, int run, Runnable done) {
    if (run != epoch || !ready) return;
    queue.add(new Operation(bytes, label, run, done));
    pump();
  }

  private void pump() {
    if (pending != null || !ready || queue.isEmpty()) return;
    Operation next = queue.remove();
    if (next.epoch != epoch) {
      pump();
      return;
    }
    pending = next;
    log("write", next.label + ":" + RobotProtocol.hex(next.bytes));
    boolean sent;
    try {
      if (Build.VERSION.SDK_INT >= 33)
        sent =
            gatt.writeCharacteristic(tx, next.bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
                == BluetoothStatusCodes.SUCCESS;
      else {
        tx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
        tx.setValue(next.bytes);
        sent = gatt.writeCharacteristic(tx);
      }
    } catch (SecurityException error) {
      fault("Bluetooth permission lost · switch car off if moving");
      return;
    }
    if (!sent) {
      fault("Bluetooth write failed · no movement retry; switch car off if moving");
      return;
    }
    timeout =
        () -> fault("Bluetooth response missing · no movement retry; switch car off if moving");
    main.postDelayed(timeout, 4000);
  }

  private void received(byte[] bytes) {
    log("notify", RobotProtocol.hex(bytes));
    for (byte[] frame : decoder.feed(bytes)) {
      log("frame", RobotProtocol.hex(frame));
      if (!active || (frame[2] & 255) != 0x82 || frame[3] != 0) continue;
      if (guided) {
        if (frame[4] == 0) {
          seenStart = true;
          state("En route · camera-guided action");
        } else if (frame[4] == 1 && seenStart) finishGuidedAction();
        continue;
      }
      if (frame[4] == 0) {
        seenStart = true;
        state(
            bench
                ? "Bench wheels running · checking stop"
                : "Trip running · native sequence started");
      } else if (frame[4] == 2 && seenStart) {
        progress++;
        state("Trip running · step " + Math.min(batchSteps, progress + 1) + " / " + batchSteps);
      } else if (frame[4] == 1 && seenStart) {
        main.removeCallbacks(sequenceWatchdog);
        if (progress >= batchSteps - 1) {
          if (bench) {
            active = false;
            ++epoch;
            queue.clear();
            state("Bench sequence finished · confirm wheels stopped");
            listener.onBenchSequenceComplete();
          } else {
            state("Sequence complete · continuing trip");
            nextBatch();
          }
        } else stop("Robot reported early sequence end");
      }
    }
  }

  private final BluetoothGattCallback callback =
      new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt connection, int status, int state) {
          main.post(
              () -> {
                if (connection != gatt) return;
                if (status != BluetoothGatt.GATT_SUCCESS
                    || state == BluetoothProfile.STATE_DISCONNECTED) {
                  fault("Car disconnected · trip will not restart; switch car off if moving");
                  return;
                }
                if (state == BluetoothProfile.STATE_CONNECTED) {
                  if (timeout != null) main.removeCallbacks(timeout);
                  state("Reading robot services…");
                  if (!connection.discoverServices()) fault("Robot service discovery failed");
                  else {
                    timeout = () -> fault("Robot service discovery timed out");
                    main.postDelayed(timeout, 8000);
                  }
                }
              });
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt connection, int status) {
          main.post(
              () -> {
                if (connection != gatt) return;
                if (timeout != null) main.removeCallbacks(timeout);
                BluetoothGattService service = connection.getService(RobotProtocol.SERVICE);
                tx = service == null ? null : service.getCharacteristic(RobotProtocol.TX);
                BluetoothGattCharacteristic rx =
                    service == null ? null : service.getCharacteristic(RobotProtocol.RX);
                if (status != BluetoothGatt.GATT_SUCCESS
                    || tx == null
                    || rx == null
                    || (tx.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) == 0) {
                  fault("Unexpected robot profile · no commands sent");
                  return;
                }
                BluetoothGattDescriptor descriptor = rx.getDescriptor(RobotProtocol.CCC);
                if (descriptor == null || !connection.setCharacteristicNotification(rx, true)) {
                  fault("Robot notifications unavailable · no commands sent");
                  return;
                }
                boolean sent;
                if (Build.VERSION.SDK_INT >= 33)
                  sent =
                      connection.writeDescriptor(
                              descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                          == BluetoothStatusCodes.SUCCESS;
                else {
                  descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                  sent = connection.writeDescriptor(descriptor);
                }
                if (!sent) {
                  fault("Could not subscribe to robot");
                  return;
                }
                timeout = () -> fault("Robot notification setup timed out");
                main.postDelayed(timeout, 5000);
              });
        }

        @Override
        public void onDescriptorWrite(
            BluetoothGatt connection, BluetoothGattDescriptor descriptor, int status) {
          main.post(
              () -> {
                if (connection != gatt) return;
                if (timeout != null) main.removeCallbacks(timeout);
                if (status != BluetoothGatt.GATT_SUCCESS) {
                  fault("Robot subscription failed");
                  return;
                }
                ready = true;
                connecting = false;
                decoder = new RobotProtocol.Decoder();
                state("Car connected · replacement FE:8C");
                if (startRequested) start();
              });
        }

        @Override
        public void onCharacteristicWrite(
            BluetoothGatt connection, BluetoothGattCharacteristic characteristic, int status) {
          main.post(
              () -> {
                if (connection != gatt || pending == null) return;
                if (timeout != null) main.removeCallbacks(timeout);
                Operation completed = pending;
                pending = null;
                if (status != BluetoothGatt.GATT_SUCCESS) {
                  fault("Robot write not confirmed · no retry; switch car off if moving");
                  return;
                }
                log("write_ack", completed.label);
                if (completed.epoch == epoch) completed.done.run();
                pump();
              });
        }

        @Override
        public void onCharacteristicChanged(
            BluetoothGatt connection, BluetoothGattCharacteristic characteristic, byte[] value) {
          byte[] copy = value.clone();
          main.post(
              () -> {
                if (connection == gatt) received(copy);
              });
        }

        @Override
        public void onCharacteristicChanged(
            BluetoothGatt connection, BluetoothGattCharacteristic characteristic) {
          if (Build.VERSION.SDK_INT < 33) {
            byte[] copy = characteristic.getValue().clone();
            main.post(
                () -> {
                  if (connection == gatt) received(copy);
                });
          }
        }
      };

  private void state(String message) {
    log("state", message);
    listener.onState(message, isActive(), ready);
  }

  private void fault(String message) {
    guidedDone = null;
    guided = false;
    main.removeCallbacks(guidedStop);
    startRequested = false;
    active = false;
    stopping = false;
    ++epoch;
    queue.clear();
    main.removeCallbacks(deadlineStop);
    main.removeCallbacks(sequenceWatchdog);
    disconnect();
    state(message);
  }

  private void disconnect() {
    if (timeout != null) main.removeCallbacks(timeout);
    ready = false;
    connecting = false;
    pending = null;
    queue.clear();
    BluetoothGatt old = gatt;
    gatt = null;
    tx = null;
    if (old != null) {
      try {
        old.disconnect();
        old.close();
      } catch (SecurityException ignored) {
      }
    }
  }

  void close() {
    closing = true;
    // Each write has its own bounded timeout. Do not disconnect ahead of a queued Stop.
    if (stopping) return;
    if (isActive() && ready) stop("App closed");
    else disconnect();
  }

  private void log(String event, String message) {
    try (FileOutputStream out =
        new FileOutputStream(new File(context.getFilesDir(), "robot-events.log"), true)) {
      out.write(
          (Instant.now() + " " + event + " " + message + "\n").getBytes(StandardCharsets.UTF_8));
    } catch (IOException ignored) {
    }
  }
}
