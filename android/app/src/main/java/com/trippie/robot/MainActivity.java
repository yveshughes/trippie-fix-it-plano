package com.trippie.robot;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.*;
import android.location.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import androidx.activity.ComponentActivity;
import androidx.annotation.NonNull;
import androidx.camera.core.*;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;

public final class MainActivity extends ComponentActivity implements SensorEventListener {
  private static final int BG = 0xFF101C19, INK = 0xFFEAF0E7, MUTED = 0xFF9DB0A2, LIME = 0xFFD0F591;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final ExecutorService disk = Executors.newSingleThreadExecutor();
  private PhotoSync photoSync;
  private RobotController robot;
  private VoiceCommands voice;
  private TapFeedback tapFeedback;
  private EditText commandText;
  private CheckBox patrolMission;
  private TextView voiceStatus;
  private boolean voicePermissionPending, voiceListening, voiceDraft;
  private TextView carStatus;
  private Button beginTrip, stopTrip, connectCar;
  private boolean pendingBeginTrip, robotPermissionInProgress, tripCaptureActive, navigationBusy;
  private int navigationEpoch;
  private boolean missionRunning;
  private long missionDeadline;
  private volatile boolean navigationInFlight;
  private ProgressBar captureProgress, uploadProgress;
  private TextView uploadStatus;
  private PreviewView preview;
  private TrippieFace face;
  private TextView status, detail, gps, tilt, settingsInfo;
  private Button capture, viewCamera, modeButton;
  private boolean practiceMode;
  private String targetHint;
  private Switch automatic;
  private ImageCapture imageCapture;
  private ProcessCameraProvider cameraProvider;
  private LocationManager locations;
  private SensorManager sensors;
  private Sensor rotationSensor;
  private Location fix;
  private boolean inFlight,
      resumed,
      previewVisible,
      captureAfterPermission,
      startingCamera,
      permissionInProgress;
  private Float pitchDegrees, rollDegrees;
  private int saved;
  private final LocationListener locationListener =
      location -> {
        fix = new Location(location);
        updateGps();
      };
  private final Runnable autoCapture =
      new Runnable() {
        @Override
        public void run() {
          if (resumed && automatic.isChecked()) {
            takePhoto();
            handler.postDelayed(this, 15000);
          }
        }
      };
  private final Runnable analysisRefresh =
      new Runnable() {
        @Override
        public void run() {
          if (resumed && photoSync != null) {
            photoSync.sync();
            handler.postDelayed(this, 12000);
          }
        }
      };
  private final Runnable gpsRefresh =
      new Runnable() {
        @Override
        public void run() {
          if (resumed) {
            updateGps();
            refreshSettingsInfo();
            handler.postDelayed(this, 1000);
          }
        }
      };

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    locations = (LocationManager) getSystemService(LOCATION_SERVICE);
    sensors = (SensorManager) getSystemService(SENSOR_SERVICE);
    rotationSensor = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
    File[] files = captures().listFiles((dir, name) -> name.endsWith(".json"));
    saved = files == null ? 0 : files.length;
    practiceMode = getPreferences(MODE_PRIVATE).getBoolean("practiceMode", true);
    targetHint = getPreferences(MODE_PRIVATE).getString("targetHint", "");
    tapFeedback = new TapFeedback(this);
    buildScreen();
    MissionLibrary.save(
        getPreferences(MODE_PRIVATE), commandText.getText().toString(), patrolMission.isChecked());
    voice =
        new VoiceCommands(
            this,
            new VoiceCommands.Listener() {
              @Override
              public void onText(String text, boolean complete) {
                if (!resumed || isDestroyed()) return;
                if (text.length() > 240) {
                  voiceStatus.setText("Command too long · use a shorter mission");
                  return;
                }
                commandText.setVisibility(View.VISIBLE);
                commandText.setText(text);
                if (MissionCommand.isStop(text)) {
                  stopMissionPreview();
                  voice.cancel();
                  return;
                }
                if (complete) {
                  patrolMission.setChecked(MissionCommand.isPatrol(text));
                  voiceStatus.setText("Muse is planning…");
                  saveMission();
                  prepareRobot(true);
                }
              }

              @Override
              public void onListening(boolean listening) {
                voiceListening = listening;
                face.setListening(listening);
                if (listening) setTripButton("Listening…", false);
                else if (!navigationBusy && !pendingBeginTrip) setTripButton("Begin Trip", true);
                if (!isDestroyed()) {
                  status.setText(listening ? "Listening…" : "Tap to speak");
                  if (!listening && voiceDraft) {
                    voiceDraft = false;
                    commandText.setText(getPreferences(MODE_PRIVATE).getString("missionGoal", ""));
                    commandText.setVisibility(commandText.length() > 0 ? View.VISIBLE : View.GONE);
                  }
                  if (listening) {
                    voiceDraft = true;
                    previewVisible = false;
                    face.setVisibility(View.VISIBLE);
                    updateCameraIcon();
                    commandText.setText("");
                    commandText.setVisibility(View.VISIBLE);
                    commandText.setHint("Your words appear here…");
                  }
                }
              }

              @Override
              public void onLevel(float level) {
                face.setVoiceLevel(level);
              }

              @Override
              public void onStatus(String message) {
                if (resumed && !isDestroyed()) voiceStatus.setText(message);
              }
            });
    robot =
        new RobotController(
            this,
            new RobotController.Listener() {
              @Override
              public void onState(String message, boolean active, boolean connected) {
                if (isDestroyed()) return;
                carStatus.setText(message);
                if (!navigationBusy
                    && !pendingBeginTrip
                    && !voiceListening
                    && (!missionRunning || active))
                  setTripButton(
                      robot == null ? "Begin Trip" : robot.activityLabel(),
                      !active && !(robot != null && robot.isConnecting()));
                stopTrip.setEnabled(
                    active || connected || missionRunning || navigationBusy || pendingBeginTrip);
                if (robot != null
                    && !connected
                    && !robot.isConnecting()
                    && (missionRunning || pendingBeginTrip)) {
                  pendingBeginTrip = false;
                  cancelNavigation();
                  setTripButton("Reconnect · Begin Trip", true);
                }
                if (connected && pendingBeginTrip && !active && resumed) prepareRobot(true);
                updateBluetoothControl(connected, robot != null && robot.isConnecting());
                connectCar.setEnabled(!active && !(robot != null && robot.isConnecting()));
                if (active) face.setAwake(true);
              }

              @Override
              public void onBenchStopSent() {
                if (isDestroyed() || !resumed) return;
                new android.app.AlertDialog.Builder(MainActivity.this)
                    .setTitle("Stop check")
                    .setMessage("Did the wheels stop promptly when the app sent Stop?")
                    .setNegativeButton(
                        "Not stopped",
                        (d, w) -> carStatus.setText("Use physical Go to stop · check incomplete"))
                    .setPositiveButton(
                        "Wheels stopped",
                        (d, w) -> {
                          getPreferences(MODE_PRIVATE)
                              .edit()
                              .putBoolean("robotStopVerified", true)
                              .apply();
                          carStatus.setText(
                              "Stop confirmed · press Begin Trip for the five-step sequence check"
                                  + " on the stand");
                        })
                    .show();
              }

              @Override
              public void onBenchSequenceComplete() {
                if (isDestroyed() || !resumed) return;
                new android.app.AlertDialog.Builder(MainActivity.this)
                    .setTitle("Sequence check")
                    .setMessage(
                        "Did the wheels complete the five-step run and then stop? Keep the car on"
                            + " the stand for this check.")
                    .setNegativeButton("Not sure", null)
                    .setPositiveButton(
                        "Finished and stopped",
                        (d, w) -> {
                          getPreferences(MODE_PRIVATE)
                              .edit()
                              .putBoolean("robotSequenceVerified", true)
                              .apply();
                          carStatus.setText(
                              "Checks complete · Begin Trip runs for 60 seconds with avoidance"
                                  + " enabled");
                        })
                    .show();
              }
            });
    photoSync =
        new PhotoSync(
            this,
            (message, percent) ->
                runOnUiThread(
                    () -> {
                      if (isDestroyed()) return;
                      uploadStatus.setText(message);
                      refreshSettingsInfo();
                      uploadStatus.setTextColor(percent == -2 ? 0xFFE7BA86 : LIME);
                      uploadProgress.setVisibility(percent == -2 ? View.GONE : View.VISIBLE);
                      uploadProgress.setIndeterminate(percent == -1);
                      if (percent >= 0) uploadProgress.setProgress(percent, true);
                    }));
  }

  private int dp(float value) {
    return (int) (value * getResources().getDisplayMetrics().density + .5f);
  }

  private GradientDrawable background(int color, float radius) {
    GradientDrawable shape = new GradientDrawable();
    shape.setColor(color);
    shape.setCornerRadius(dp(radius));
    return shape;
  }

  private TextView text(String value, int size, int color, boolean bold) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    if (bold) t.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
    return t;
  }

  private Button button(String title, boolean primary) {
    Button b =
        new Button(this) {
          @Override
          public boolean performClick() {
            if (isEnabled() && tapFeedback != null) tapFeedback.play();
            return super.performClick();
          }
        };
    b.setSoundEffectsEnabled(false);
    b.setText(title);
    b.setAllCaps(false);
    b.setTextSize(16);
    b.setTextColor(primary ? BG : INK);
    b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    b.setBackground(background(primary ? LIME : 0xFF23362E, 18));
    return b;
  }

  private Button iconButton(int resource, String label) {
    ControlIconButton control =
        new ControlIconButton(this, resource, label, () -> tapFeedback.play());
    control.setBackground(background(0xFF23362E, 18));
    return control;
  }

  private void updateBluetoothControl(boolean connected, boolean connecting) {
    if (!(connectCar instanceof ControlIconButton)) return;
    ControlIconButton control = (ControlIconButton) connectCar;
    control.setIcon(
        connected
            ? R.drawable.control_connect_on
            : connecting ? R.drawable.control_connect : R.drawable.control_connect_off,
        connected
            ? "Bluetooth connected to Trippie"
            : connecting ? "Connecting to Trippie" : "Bluetooth disconnected · tap to connect");
    control.setBusy(connecting);
    control.setStateDescription(
        connected ? "Connected" : connecting ? "Connecting" : "Disconnected");
    control.setBackground(background(connected ? 0xFF2D4737 : 0xFF23362E, 18));
  }

  private void updateCameraIcon() {
    if (viewCamera instanceof ControlIconButton)
      ((ControlIconButton) viewCamera)
          .setIcon(
              previewVisible ? R.drawable.control_face : R.drawable.control_camera,
              previewVisible ? "Show Trippie face" : "Show camera");
  }

  private void buildScreen() {
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(BG);
    root.setPadding(dp(24), dp(16), dp(24), dp(16));
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          android.graphics.Insets bars =
              insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
          v.setPadding(
              dp(24) + bars.left, dp(12) + bars.top, dp(24) + bars.right, dp(12) + bars.bottom);
          return insets;
        });
    setContentView(root);
    LinearLayout header = new LinearLayout(this);
    header.setGravity(Gravity.CENTER_VERTICAL);
    TextView brand = text("trippie.", 29, INK, true);
    header.addView(brand, new LinearLayout.LayoutParams(0, dp(54), 1));
    modeButton = button("Missions ▾", false);
    modeButton.setTextSize(12);
    modeButton.setContentDescription("Saved missions and settings");
    modeButton.setOnClickListener(v -> showMissions());
    header.addView(modeButton, new LinearLayout.LayoutParams(dp(112), dp(40)));
    Button gear = button("⚙", false);
    gear.setTextSize(23);
    gear.setContentDescription("Settings and device information");
    gear.setOnClickListener(v -> showCaptureSettings());
    LinearLayout.LayoutParams gearLayout = new LinearLayout.LayoutParams(dp(44), dp(44));
    gearLayout.setMargins(dp(8), 0, 0, 0);
    header.addView(gear, gearLayout);
    root.addView(header);
    root.addView(text("A little robot. A safer neighborhood.", 13, MUTED, false));
    commandText = new EditText(this);
    commandText.setTextColor(INK);
    commandText.setHintTextColor(MUTED);
    commandText.setTextSize(18);
    commandText.setGravity(Gravity.CENTER);
    commandText.setMaxLines(3);
    commandText.setBackground(null);
    commandText.setFocusable(false);
    commandText.setCursorVisible(false);
    commandText.setFilters(
        new android.text.InputFilter[] {new android.text.InputFilter.LengthFilter(240)});
    commandText.setText(getPreferences(MODE_PRIVATE).getString("missionGoal", ""));
    commandText.setVisibility(commandText.length() > 0 ? View.VISIBLE : View.GONE);
    commandText.setContentDescription("Live voice transcript; hold the face to type a mission");
    patrolMission = new CheckBox(this);
    patrolMission.setChecked(getPreferences(MODE_PRIVATE).getBoolean("missionPatrol", false));
    commandText.addTextChangedListener(
        new android.text.TextWatcher() {
          public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

          public void onTextChanged(CharSequence s, int start, int before, int count) {
            if (beginTrip != null) {
              pendingBeginTrip = false;
              cancelNavigation();
            }
          }

          public void afterTextChanged(android.text.Editable s) {}
        });
    patrolMission.setOnCheckedChangeListener(
        (button, checked) -> {
          if (beginTrip != null) {
            pendingBeginTrip = false;
            cancelNavigation();
          }
        });
    FrameLayout stage = new FrameLayout(this);
    root.addView(stage, new LinearLayout.LayoutParams(-1, 0, 1));
    preview = new PreviewView(this);
    preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
    stage.addView(preview, new FrameLayout.LayoutParams(-1, -1));
    face = new TrippieFace(this);
    face.setBackgroundColor(BG);
    stage.addView(face, new FrameLayout.LayoutParams(-1, -1));
    face.setContentDescription("Tap to speak to Trippie; hold to type a mission");
    face.setOnClickListener(
        v -> {
          tapFeedback.play();
          if (voiceListening) stopMissionPreview();
          else startVoice();
        });
    face.setOnLongClickListener(
        v -> {
          tapFeedback.play();
          showTypedMission();
          return true;
        });
    root.addView(commandText, new LinearLayout.LayoutParams(-1, -2));
    status = text("Tap to speak", 24, INK, true);
    status.setGravity(Gravity.CENTER);
    status.setOnClickListener(
        v -> {
          tapFeedback.play();
          if (voiceListening) stopMissionPreview();
          else startVoice();
        });
    status.setOnLongClickListener(
        v -> {
          tapFeedback.play();
          showTypedMission();
          return true;
        });
    root.addView(status);
    detail = text("Say where to go or what to inspect.", 14, MUTED, false);
    voiceStatus = detail;
    detail.setGravity(Gravity.CENTER);
    detail.setPadding(0, dp(4), 0, dp(8));
    root.addView(detail);
    captureProgress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    captureProgress.setIndeterminate(true);
    captureProgress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(LIME));
    captureProgress.setVisibility(View.INVISIBLE);
    root.addView(captureProgress, new LinearLayout.LayoutParams(-1, dp(4)));
    LinearLayout syncPanel = new LinearLayout(this);
    syncPanel.setOrientation(LinearLayout.VERTICAL);
    syncPanel.setPadding(dp(14), dp(10), dp(14), dp(10));
    syncPanel.setBackground(background(0xFF1B2B24, 14));
    uploadStatus = text("Checking portal connection…", 12, MUTED, false);
    uploadStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    syncPanel.addView(uploadStatus);
    uploadProgress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    uploadProgress.setMax(100);
    uploadProgress.setProgressTintList(android.content.res.ColorStateList.valueOf(LIME));
    uploadProgress.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(LIME));
    syncPanel.addView(uploadProgress, new LinearLayout.LayoutParams(-1, dp(5)));
    Button syncButton = button("Sync photos", false);
    syncButton.setTextSize(12);
    syncButton.setOnClickListener(v -> photoSync.sync());
    syncPanel.addView(syncButton, new LinearLayout.LayoutParams(-1, dp(40)));
    LinearLayout.LayoutParams syncLayout = new LinearLayout.LayoutParams(-1, -2);
    syncLayout.setMargins(0, dp(8), 0, dp(10));
    // Upload progress is kept internally; photos sync automatically without a dashboard panel.
    LinearLayout stats = new LinearLayout(this);
    stats.setPadding(dp(16), dp(14), dp(16), dp(14));
    stats.setBackground(background(0xFF1B2B24, 18));
    gps = text("GPS · Not enabled", 12, MUTED, false);
    tilt = text("Tilt · —", 12, MUTED, false);
    tilt.setGravity(Gravity.END);
    stats.addView(gps, new LinearLayout.LayoutParams(0, -2, 1));
    stats.addView(tilt, new LinearLayout.LayoutParams(0, -2, 1));
    // GPS and tilt are shown in Settings instead of the main screen.
    beginTrip = button("Begin Trip", true);
    beginTrip.setTextSize(16);
    beginTrip.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    beginTrip.setOnClickListener(v -> prepareRobot(true));
    LinearLayout.LayoutParams beginLayout = new LinearLayout.LayoutParams(-1, dp(54));
    beginLayout.setMargins(0, dp(16), 0, dp(10));
    root.addView(beginTrip, beginLayout);
    LinearLayout controls = new LinearLayout(this);
    capture =
        iconButton(R.drawable.control_capture, practiceMode ? "Capture obstacle" : "Capture photo");
    capture.setOnClickListener(v -> prepareCapture(true));
    viewCamera = iconButton(R.drawable.control_camera, "Show camera");
    viewCamera.setOnClickListener(
        v -> {
          if (imageCapture == null) prepareCapture(false);
          else togglePreview();
        });
    connectCar =
        iconButton(R.drawable.control_connect_off, "Bluetooth disconnected · tap to connect");
    connectCar.setStateDescription("Disconnected");
    connectCar.setOnClickListener(v -> prepareRobot(false));
    stopTrip = iconButton(R.drawable.control_stop, "Stop mission");
    stopTrip.setEnabled(false);
    stopTrip.setOnClickListener(v -> stopMissionPreview());
    Button[] row = new Button[] {capture, viewCamera, connectCar, stopTrip};
    for (int i = 0; i < row.length; i++) {
      LinearLayout.LayoutParams layout = new LinearLayout.LayoutParams(0, dp(52), 1);
      if (i < row.length - 1) layout.setMargins(0, 0, dp(10), 0);
      controls.addView(row[i], layout);
    }
    root.addView(controls);
    carStatus =
        text("Begin Trip drives with camera guidance · Stop pauses the mission", 11, MUTED, false);
    carStatus.setPadding(0, dp(6), 0, dp(4));
    carStatus.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    root.addView(carStatus);
    automatic =
        new Switch(this) {
          @Override
          public boolean performClick() {
            tapFeedback.play();
            return super.performClick();
          }
        };
    automatic.setSoundEffectsEnabled(false);
    automatic.setText("Capture every 15 seconds");
    automatic.setTextSize(14);
    automatic.setTextColor(INK);
    automatic.setPadding(0, dp(10), 0, dp(4));
    automatic.setOnCheckedChangeListener(
        (b, on) -> {
          handler.removeCallbacks(autoCapture);
          if (on) {
            prepareCapture(false);
            handler.postDelayed(autoCapture, 15000);
            status.setText("Eyes on the path.");
            detail.setText("Photo capture only · car stays under your control");
          } else if (!inFlight) {
            status.setText("Taking a breather.");
            detail.setText("Automatic capture is off.");
          }
        });
  }

  private void showMissions() {
    stopMissionPreview();
    List<MissionLibrary.Mission> missions = MissionLibrary.read(getPreferences(MODE_PRIVATE));
    String[] labels = new String[missions.size()];
    int selected = -1;
    for (int i = 0; i < missions.size(); i++) {
      MissionLibrary.Mission mission = missions.get(i);
      labels[i] = mission.goal;
      if (mission.goal.equalsIgnoreCase(commandText.getText().toString().trim())
          && mission.patrol == patrolMission.isChecked()) selected = i;
    }
    android.app.AlertDialog.Builder picker =
        new android.app.AlertDialog.Builder(this)
            .setTitle("Missions")
            .setNegativeButton("Close", (dialog, which) -> tapFeedback.play())
            .setNeutralButton(
                "Settings",
                (dialog, which) -> {
                  tapFeedback.play();
                  showCaptureSettings();
                })
            .setPositiveButton(
                "New mission",
                (dialog, which) -> {
                  tapFeedback.play();
                  startVoice();
                });
    if (labels.length == 0)
      picker.setMessage("Tap the face and say a command. Your missions are saved here.");
    else
      picker.setSingleChoiceItems(
          labels,
          selected,
          (dialog, which) -> {
            tapFeedback.play();
            MissionLibrary.Mission mission = missions.get(which);
            commandText.setText(mission.goal);
            commandText.setVisibility(View.VISIBLE);
            patrolMission.setChecked(mission.patrol);
            saveMission();
            carStatus.setText("Mission selected · press Begin Trip to start");
            dialog.dismiss();
          });
    picker.show();
  }

  private void showTypedMission() {
    stopMissionPreview();
    EditText input = new EditText(this);
    input.setText(commandText.getText());
    input.setHint("Go out the door…");
    input.setFilters(
        new android.text.InputFilter[] {new android.text.InputFilter.LengthFilter(240)});
    new android.app.AlertDialog.Builder(this)
        .setTitle("Tell Trippie")
        .setView(input)
        .setNegativeButton("Cancel", null)
        .setPositiveButton(
            "Plan",
            (dialog, which) -> {
              String goal = input.getText().toString().trim();
              commandText.setText(goal);
              commandText.setVisibility(goal.isEmpty() ? View.GONE : View.VISIBLE);
              patrolMission.setChecked(MissionCommand.isPatrol(goal));
              prepareRobot(true);
            })
        .show();
  }

  private void saveMission() {
    if (voiceDraft
        || commandText.getText().toString().trim().isEmpty()
        || MissionCommand.isStop(commandText.getText().toString())) return;
    MissionLibrary.save(
        getPreferences(MODE_PRIVATE), commandText.getText().toString(), patrolMission.isChecked());
    getPreferences(MODE_PRIVATE)
        .edit()
        .putString("missionGoal", commandText.getText().toString().trim())
        .putBoolean("missionPatrol", patrolMission.isChecked())
        .apply();
  }

  private void startVoice() {
    if (!resumed) return;
    stopMissionPreview();
    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED) {
      voicePermissionPending = true;
      requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, 22);
    } else voice.start();
  }

  private void stopMissionPreview() {
    voicePermissionPending = false;
    pendingBeginTrip = false;
    cancelNavigation();
    if (voice != null) voice.cancel();
    automatic.setChecked(false);
    if (robot != null && robot.isActive()) robot.stop("Stop pressed");
    else {
      setTripButton(
          robot != null && robot.isActive() ? "Stopping…" : "Paused · Begin Trip",
          robot == null || !robot.isActive());
      carStatus.setText("Mission paused · no movement sent");
    }
    saveMission();
  }

  private void prepareRobot(boolean begin) {
    pendingBeginTrip |= begin;
    if (Build.VERSION.SDK_INT >= 31
        && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
            != PackageManager.PERMISSION_GRANTED) {
      robotPermissionInProgress = true;
      requestPermissions(new String[] {Manifest.permission.BLUETOOTH_CONNECT}, 21);
      return;
    }
    if (pendingBeginTrip) {
      if (!robot.isConnected()) {
        setTripButton("Connecting…", false);
        stopTrip.setEnabled(true);
        robot.connect();
        return;
      }
      if (robot.isActive()) {
        setTripButton("Stopping…", false);
        return;
      }
      if (imageCapture == null) {
        setTripButton("Opening camera…", false);
        prepareCapture(false);
        return;
      }
      startPreparedTrip();
    } else robot.connect();
  }

  private void startPreparedTrip() {
    if (!pendingBeginTrip
        || !resumed
        || imageCapture == null
        || !robot.isConnected()
        || robot.isActive()
        || robotPermissionInProgress
        || permissionInProgress) return;
    pendingBeginTrip = false;
    if (MissionCommand.isStop(commandText.getText().toString())) {
      stopMissionPreview();
      return;
    }
    saveMission();
    missionRunning = true;
    missionDeadline = SystemClock.elapsedRealtime() + 600000;
    inspectAhead();
  }

  private void setTripButton(String label, boolean enabled) {
    if (beginTrip == null) return;
    beginTrip.setText(label);
    beginTrip.setStateDescription(label);
    beginTrip.setContentDescription(label + (enabled ? ". Tap to begin the mission." : ""));
    beginTrip.setEnabled(enabled);
  }

  private void cancelNavigation() {
    missionRunning = false;
    if (robot != null && robot.isActive()) robot.stop("Mission cancelled");
    navigationEpoch++;
    navigationBusy = false;
    boolean stopping = robot != null && robot.isActive();
    setTripButton(
        stopping ? "Stopping…" : voiceListening ? "Listening…" : "Begin Trip",
        !voiceListening && !stopping);
  }

  private void inspectAhead() {
    if (!resumed || imageCapture == null || !missionRunning || robot.isActive()) return;
    if (SystemClock.elapsedRealtime() >= missionDeadline) {
      cancelNavigation();
      setTripButton("Trip paused · Begin Trip", true);
      carStatus.setText("Ten-minute trip limit reached · press Begin Trip to continue");
      return;
    }
    if (!robot.isConnected()) {
      cancelNavigation();
      setTripButton("Reconnect · Begin Trip", true);
      return;
    }
    if (navigationInFlight) {
      pendingBeginTrip = true;
      setTripButton("Updating mission…", false);
      carStatus.setText("Updating mission · waiting for the previous camera request to finish");
      return;
    }
    if (inFlight) {
      setTripButton("Finishing photo…", true);
      carStatus.setText("Photo capture finishing · press Begin Trip again shortly");
      return;
    }
    if (navigationBusy) return;
    // One bounded action per camera decision; never execute the full estimated plan.
    String missionGoal = commandText.getText().toString().trim();
    if (missionGoal.isEmpty()) {
      missionRunning = false;
      voiceStatus.setText("Say or type a mission first");
      return;
    }
    String missionMode = patrolMission.isChecked() ? "patrol" : "navigate";
    navigationBusy = true;
    navigationInFlight = true;
    int run = ++navigationEpoch;
    setTripButton("Looking…", false);
    stopTrip.setEnabled(true);
    automatic.setChecked(false);
    carStatus.setText("Muse is planning: “" + missionGoal + "”…");
    File frame = new File(getCacheDir(), "navigation-" + UUID.randomUUID() + ".jpg");
    String frameId = UUID.randomUUID().toString();
    long frameTime = SystemClock.elapsedRealtime();
    imageCapture.setTargetRotation(getDisplay().getRotation());
    imageCapture.takePicture(
        new ImageCapture.OutputFileOptions.Builder(frame).build(),
        disk,
        new ImageCapture.OnImageSavedCallback() {
          @Override
          public void onImageSaved(@NonNull ImageCapture.OutputFileResults result) {
            runOnUiThread(
                () -> {
                  if (run == navigationEpoch && resumed && !isDestroyed())
                    setTripButton("Thinking…", false);
                });
            try {
              JSONObject decision =
                  photoSync.inspectNavigation(frame, frameId, missionGoal, missionMode);
              runOnUiThread(
                  () -> {
                    if (run == navigationEpoch && resumed && !isDestroyed())
                      setTripButton("Deciding…", false);
                  });
              String action = decision.getString("action");
              String reason = decision.getString("reason");
              if (!Arrays.asList("stop", "forward", "left", "right").contains(action)
                  || reason.length() > 350) throw new IOException("Invalid direction");
              if (!action.equals("stop")
                  && (!decision.getBoolean("pathClear")
                      || decision.getBoolean("personInPath")
                      || decision.getBoolean("dropOrStairs")
                      || !decision.getBoolean("viewUsable")))
                throw new IOException("Blocked direction");
              String planText = MissionCommand.describePlan(decision);
              runOnUiThread(
                  () -> {
                    if (run != navigationEpoch || !resumed || isDestroyed()) return;
                    navigationBusy = false;
                    if (SystemClock.elapsedRealtime() - frameTime > 18000) {
                      missionRunning = false;
                      setTripButton("View expired · Try again", true);
                      carStatus.setText("Hold position · camera assessment expired; look again");
                      return;
                    }
                    if (!missionRunning) return;
                    String situation = decision.optString("situation", "uncertain");
                    boolean shouldStop = action.equals("stop") || !situation.equals("continue");
                    boolean recheck = shouldStop && MissionCommand.shouldRecheck(situation);
                    if (shouldStop) {
                      if (recheck) {
                        setTripButton("Finding a way…", false);
                        handler.postDelayed(
                            () -> {
                              if (run == navigationEpoch
                                  && missionRunning
                                  && resumed
                                  && !isDestroyed()) inspectAhead();
                            },
                            3000);
                      } else {
                        missionRunning = false;
                        setTripButton(
                            situation.equals("goal_reached")
                                ? "Arrived"
                                : "Holding at intersection",
                            true);
                      }
                    }
                    carStatus.setText(
                        "Muse: "
                            + action.toUpperCase(Locale.US)
                            + " · "
                            + reason
                            + "\n"
                            + planText
                            + (shouldStop
                                ? (recheck
                                    ? "\nMission active · checking again shortly"
                                    : "\nMission paused")
                                : "\nMoving once, then looking again"));
                    if (!shouldStop) {
                      boolean sent =
                          robot.moveOne(
                              action,
                              Math.min(frameTime + 18000, missionDeadline),
                              () -> {
                                if (run != navigationEpoch
                                    || !missionRunning
                                    || !resumed
                                    || isDestroyed()) return;
                                setTripButton("Looking…", false);
                                // Allow the just-stopped camera to settle; old model results cannot
                                // move the car.
                                handler.postDelayed(
                                    () -> {
                                      if (run == navigationEpoch
                                          && missionRunning
                                          && resumed
                                          && !isDestroyed()) inspectAhead();
                                    },
                                    350);
                              });
                      if (!sent) {
                        cancelNavigation();
                        setTripButton("Unable to drive · Retry", true);
                      }
                    }
                  });
            } catch (Exception error) {
              runOnUiThread(
                  () -> {
                    if (run != navigationEpoch || !resumed || isDestroyed()) return;
                    navigationBusy = false;
                    missionRunning = false;
                    setTripButton("Couldn't assess · Try again", true);
                    carStatus.setText(
                        "Hold position · could not assess this view; no movement sent");
                  });
            } finally {
              frame.delete();
              navigationInFlight = false;
              runOnUiThread(
                  () -> {
                    if (pendingBeginTrip && resumed && !isDestroyed()) startPreparedTrip();
                  });
              if (isDestroyed() && !inFlight && !navigationInFlight) disk.shutdown();
            }
          }

          @Override
          public void onError(@NonNull ImageCaptureException error) {
            frame.delete();
            navigationInFlight = false;
            runOnUiThread(
                () -> {
                  if (pendingBeginTrip && resumed && !isDestroyed()) startPreparedTrip();
                });
            if (isDestroyed() && !inFlight && !navigationInFlight) disk.shutdown();
            runOnUiThread(
                () -> {
                  if (run != navigationEpoch || !resumed || isDestroyed()) return;
                  navigationBusy = false;
                  missionRunning = false;
                  setTripButton("Camera unavailable · Retry", true);
                  carStatus.setText("Hold position · camera unavailable; no movement sent");
                });
          }
        });
  }

  private void showSavedInspections() {
    File[] files = captures().listFiles((dir, name) -> name.endsWith(".json"));
    if (files == null || files.length == 0) return;
    Arrays.sort(files, (a,b) -> Long.compare(b.lastModified(), a.lastModified()));
    List<JSONObject> rows = new ArrayList<>();
    List<String> labels = new ArrayList<>();
    for (File file : files) try {
      JSONObject row = new JSONObject(new String(java.nio.file.Files.readAllBytes(file.toPath()), java.nio.charset.StandardCharsets.UTF_8));
      rows.add(row);
      labels.add(row.optJSONObject("mission") != null ? row.getJSONObject("mission").optString("goal") + " · " + row.optString("id").substring(0,8) : row.optString("purpose") + " · " + row.optString("id").substring(0,8));
    } catch (Exception ignored) {}
    new android.app.AlertDialog.Builder(this).setTitle("Saved inspections")
      .setItems(labels.toArray(new String[0]), (dialog, index) -> {
        JSONObject row = rows.get(index);
        startActivity(new android.content.Intent(this, InspectionActivity.class)
          .putExtra("captureId", row.optString("id")).putExtra("mode", row.optString("mode","demo")));
      }).setNegativeButton("Close", null).show();
  }

  private void showCaptureSettings() {
    stopMissionPreview();
    LinearLayout settings = new LinearLayout(this);
    settings.setOrientation(LinearLayout.VERTICAL);
    settings.setPadding(dp(24), dp(12), dp(24), dp(8));
    CheckBox practice = new CheckBox(this);
    practice.setText("Indoor obstacle practice");
    practice.setTextColor(INK);
    practice.setChecked(practiceMode);
    settings.addView(practice);
    TextView explanation =
        text(
            "Outline a real chair, box, shoe or bag. Practice stays in DEMO and never creates a"
                + " city case.",
            14,
            MUTED,
            false);
    settings.addView(explanation);
    EditText hint = new EditText(this);
    hint.setTextColor(INK);
    hint.setHintTextColor(MUTED);
    hint.setText(targetHint);
    hint.setHint("Optional target: chair, box, shoe…");
    hint.setSingleLine(true);
    hint.setFilters(new android.text.InputFilter[] {new android.text.InputFilter.LengthFilter(80)});
    settings.addView(hint);
    CheckBox auto = new CheckBox(this);
    auto.setText("Capture a photo every 15 seconds");
    auto.setTextColor(INK);
    auto.setChecked(automatic.isChecked());
    settings.addView(auto);
    settingsInfo = text("", 13, MUTED, false);
    settingsInfo.setPadding(0, dp(18), 0, dp(12));
    settings.addView(settingsInfo);
    refreshSettingsInfo();
    Button inspections = button("Saved inspections", false);
    inspections.setOnClickListener(v -> showSavedInspections());
    settings.addView(inspections, new LinearLayout.LayoutParams(-1, dp(44)));
    Button sync = button("Sync photos now", false);
    sync.setTextSize(13);
    sync.setOnClickListener(v -> photoSync.sync());
    settings.addView(sync, new LinearLayout.LayoutParams(-1, dp(44)));
    if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      TextView check = text("Wheel check · use only with wheels raised", 13, MUTED, true);
      check.setPadding(0, dp(18), 0, dp(8));
      settings.addView(check);
      LinearLayout row = new LinearLayout(this);
      for (String direction : new String[] {"left", "forward", "right"}) {
        Button test = button(direction, false);
        test.setTextSize(12);
        test.setOnClickListener(
            v -> {
              if (!resumed || !robot.isConnected() || robot.isActive()) {
                check.setText("Connect the car first; wait for any Stop to finish.");
                return;
              }
              boolean sent =
                  robot.moveOne(
                      direction,
                      SystemClock.elapsedRealtime() + 5000,
                      () ->
                          check.setText(
                              "Stop sent after " + direction + " · check wheels are stationary"));
              if (sent) check.setText("Testing one " + direction + " step · wheels raised");
            });
        row.addView(test, new LinearLayout.LayoutParams(0, dp(48), 1));
      }
      settings.addView(row);
      Button stop = button("Stop wheel check", false);
      stop.setOnClickListener(
          v -> {
            stopMissionPreview();
            check.setText("Stop requested · use car power if wheels keep moving");
          });
      settings.addView(stop, new LinearLayout.LayoutParams(-1, dp(44)));
    }
    ScrollView scroll = new ScrollView(this);
    scroll.addView(settings);
    new android.app.AlertDialog.Builder(this)
        .setTitle("Settings")
        .setView(scroll)
        .setOnDismissListener(
            dialog -> {
              settingsInfo = null;
              if (robot != null && robot.isActive()) robot.stop("Settings closed");
            })
        .setNegativeButton("Cancel", null)
        .setPositiveButton(
            "Save",
            (dialog, which) -> {
              tapFeedback.play();
              practiceMode = practice.isChecked();
              automatic.setChecked(auto.isChecked());
              targetHint = hint.getText().toString().trim();
              getPreferences(MODE_PRIVATE)
                  .edit()
                  .putBoolean("practiceMode", practiceMode)
                  .putString("targetHint", targetHint)
                  .apply();
              modeButton.setText("Missions ▾");
              if (!inFlight)
                capture.setContentDescription(practiceMode ? "Capture obstacle" : "Capture photo");
              detail.setText(
                  practiceMode
                      ? "Find a floor object · SAM outlines it in DEMO"
                      : "Public-space maintenance inspection");
            })
        .show();
  }

  private File captures() {
    File directory = new File(getFilesDir(), "captures");
    if (!directory.exists()) directory.mkdirs();
    return directory;
  }

  private void prepareCapture(boolean takeAfter) {
    captureAfterPermission |= takeAfter;
    if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      permissionInProgress = true;
      requestPermissions(
          new String[] {
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
          },
          10);
      return;
    }
    startLocation();
    if (imageCapture == null) startCamera();
    else if (takeAfter) {
      captureAfterPermission = false;
      takePhoto();
    } else if (!automatic.isChecked()) togglePreview();
  }

  private void startCamera() {
    if (startingCamera) return;
    startingCamera = true;
    detail.setText("Opening the rear camera…");
    ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
    future.addListener(
        () -> {
          startingCamera = false;
          if (isDestroyed()) return;
          try {
            cameraProvider = future.get();
            Preview stream = new Preview.Builder().build();
            stream.setSurfaceProvider(preview.getSurfaceProvider());
            ImageCapture next =
                new ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .setTargetResolution(new android.util.Size(1920, 1080))
                    .build();
            cameraProvider.unbindAll();
            cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, stream, next);
            imageCapture = next;
            face.setAwake(true);
            detail.setText("Rear camera ready · photos stay on this phone");
            if (pendingBeginTrip) startPreparedTrip();
            if (captureAfterPermission && resumed) {
              captureAfterPermission = false;
              takePhoto();
            } else if (!automatic.isChecked()) togglePreview();
          } catch (Exception error) {
            imageCapture = null;
            captureAfterPermission = false;
            automatic.setChecked(false);
            status.setText("Camera unavailable");
            detail.setText("Close other camera apps, then try again.");
          }
        },
        ContextCompat.getMainExecutor(this));
  }

  private void togglePreview() {
    previewVisible = !previewVisible;
    face.setVisibility(previewVisible ? View.INVISIBLE : View.VISIBLE);
    updateCameraIcon();
  }

  @Override
  public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(request, permissions, results);
    if (request == 22) {
      if (voicePermissionPending
          && checkSelfPermission(Manifest.permission.RECORD_AUDIO)
              == PackageManager.PERMISSION_GRANTED) {
        if (resumed) {
          voicePermissionPending = false;
          voice.start();
        }
      } else {
        voicePermissionPending = false;
        voiceStatus.setText("Microphone off · type your command instead");
      }
      return;
    }
    if (request == 21) {
      robotPermissionInProgress = false;
      if (Build.VERSION.SDK_INT < 31
          || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
              == PackageManager.PERMISSION_GRANTED) prepareRobot(pendingBeginTrip);
      else {
        pendingBeginTrip = false;
        carStatus.setText("Nearby devices permission is needed for car control");
      }
      return;
    }
    if (request != 10) return;
    permissionInProgress = false;
    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
      startLocation();
      startCamera();
    } else {
      captureAfterPermission = false;
      automatic.setChecked(false);
      pendingBeginTrip = false;
      setTripButton("Camera access needed", true);
      status.setText("Camera access needed");
      detail.setText("Allow camera access in Android settings to take photos.");
    }
  }

  private void startLocation() {
    if (!resumed
        || (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED)) return;
    locations.removeUpdates(locationListener);
    for (String provider :
        new String[] {LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
      try {
        if (locations.isProviderEnabled(provider))
          locations.requestLocationUpdates(provider, 3000, 0, locationListener);
      } catch (SecurityException | IllegalArgumentException ignored) {
      }
    }
    updateGps();
  }

  private boolean fresh(Location value) {
    return value != null
        && CaptureMetadata.isFresh(
            SystemClock.elapsedRealtimeNanos(), value.getElapsedRealtimeNanos());
  }

  private void updateGps() {
    if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) gps.setText("GPS · Permission off");
    else if (fresh(fix))
      gps.setText(
          fix.hasAccuracy()
              ? String.format(Locale.US, "GPS · ±%.0f m", fix.getAccuracy())
              : "GPS · Accuracy unknown");
    else gps.setText("GPS · Waiting for fix");
  }

  private void takePhoto() {
    if (!resumed || inFlight || navigationInFlight || imageCapture == null) return;
    inFlight = true;
    captureProgress.setVisibility(View.VISIBLE);
    capture.setContentDescription("Capturing photo");
    capture.setEnabled(false);
    status.setText("Got my eye on it.");
    detail.setText("Capturing a photo…");
    String id = UUID.randomUUID().toString();
    File photo = new File(captures(), id + ".jpg");
    Location location = fresh(fix) ? new Location(fix) : null;
    Float capturedPitch = pitchDegrees, capturedRoll = rollDegrees;
    long requestedAt = System.currentTimeMillis(),
        requestNanos = SystemClock.elapsedRealtimeNanos();
    JSONObject captureWorkspace = photoSync.captureWorkspace();
    boolean practiceAtCapture = practiceMode;
    String hintAtCapture = targetHint;
    String goalAtCapture = commandText.getText().toString().trim();
    boolean patrolAtCapture = patrolMission.isChecked();
    ImageCapture.Metadata metadata = new ImageCapture.Metadata();
    if (location != null) metadata.setLocation(location);
    imageCapture.setTargetRotation(getDisplay().getRotation());
    ImageCapture.OutputFileOptions output =
        new ImageCapture.OutputFileOptions.Builder(photo).setMetadata(metadata).build();
    imageCapture.takePicture(
        output,
        disk,
        new ImageCapture.OnImageSavedCallback() {
          @Override
          public void onImageSaved(@NonNull ImageCapture.OutputFileResults result) {
            try {
              JSONObject data = new JSONObject();
              data.put("id", id);
              data.put("photo", photo.getName());
              data.put("requestedAt", Instant.ofEpochMilli(requestedAt).toString());
              data.put("savedAt", Instant.now().toString());
              data.put("device", Build.MODEL);
              data.put("state", "local");
              data.put("purpose", practiceAtCapture ? "obstacle-practice" : "inspection");
              data.put("targetHint", practiceAtCapture ? hintAtCapture : "");
              data.put("mission", new JSONObject().put("goal",goalAtCapture).put("mode",patrolAtCapture ? "patrol" : "navigate"));
              if (captureWorkspace != null) {
                data.put("mode", practiceAtCapture?"demo":captureWorkspace.getString("mode"));
                data.put("generation", practiceAtCapture?captureWorkspace.optInt("demoGeneration",captureWorkspace.getInt("generation")):captureWorkspace.getInt("generation"));
              }
              data.put("pitchDegrees", capturedPitch == null ? JSONObject.NULL : capturedPitch);
              data.put("rollDegrees", capturedRoll == null ? JSONObject.NULL : capturedRoll);
              data.put(
                  "orientationNote",
                  "Phone orientation; not a calibrated sidewalk slope measurement");
              if (location != null) {
                JSONObject geo = new JSONObject();
                geo.put("latitude", location.getLatitude());
                geo.put("longitude", location.getLongitude());
                geo.put(
                    "accuracyMeters",
                    location.hasAccuracy() ? location.getAccuracy() : JSONObject.NULL);
                geo.put("fixTime", Instant.ofEpochMilli(location.getTime()).toString());
                geo.put(
                    "ageAtRequestMs",
                    (requestNanos - location.getElapsedRealtimeNanos()) / 1_000_000L);
                geo.put("provider", location.getProvider());
                data.put("location", geo);
              } else data.put("location", JSONObject.NULL);
              File temp = new File(captures(), id + ".json.tmp"),
                  finalMetadata = new File(captures(), id + ".json");
              try (FileOutputStream stream = new FileOutputStream(temp)) {
                stream.write(data.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                stream.getFD().sync();
              }
              if (!temp.renameTo(finalMetadata)) throw new IOException("Could not save metadata");
              runOnUiThread(
                  () -> {
                    if (isDestroyed()) {
                      inFlight = false;
                      disk.shutdown();
                      return;
                    }
                    saved++;
                    finishCapture(
                        "Photo saved.",
                        location == null
                            ? "No fresh GPS fix · location left empty"
                            : "Saved with GPS and its reported accuracy");
                    updateCount();
                    photoSync.sync();
                  });
            } catch (Exception error) {
              runOnUiThread(
                  () -> {
                    if (isDestroyed()) {
                      inFlight = false;
                      disk.shutdown();
                      return;
                    }
                    automatic.setChecked(false);
                    finishCapture(
                        "Photo saved; metadata failed", "Check device storage before continuing.");
                  });
            }
          }

          @Override
          public void onError(@NonNull ImageCaptureException error) {
            photo.delete();
            runOnUiThread(
                () -> {
                  if (isDestroyed()) {
                    inFlight = false;
                    disk.shutdown();
                    return;
                  }
                  automatic.setChecked(false);
                  finishCapture(
                      "Couldn't save the photo",
                      "Check camera access and available storage, then retry.");
                });
          }
        });
  }

  private void finishCapture(String title, String subtitle) {
    inFlight = false;
    captureProgress.setVisibility(View.INVISIBLE);
    capture.setContentDescription(practiceMode ? "Capture obstacle" : "Capture photo");
    capture.setEnabled(true);
    status.setText(title);
    detail.setText(subtitle);
  }

  private void updateCount() {
    refreshSettingsInfo();
  }

  private void refreshSettingsInfo() {
    if (settingsInfo == null) return;
    settingsInfo.setText(
        saved
            + " captures saved on this phone\n"
            + "Workspace: DEMO · automatic photo sync\n"
            + (uploadStatus == null ? "" : uploadStatus.getText())
            + "\n"
            + (gps == null ? "GPS unavailable" : gps.getText())
            + "\n"
            + (tilt == null ? "Tilt unavailable" : tilt.getText())
            + "\n"
            + (robot != null && robot.isConnected() ? "Car connected" : "Car disconnected")
            + "\nCity cases: saved inspections · confirmation tracked");
  }

  @Override
  protected void onResume() {
    super.onResume();
    resumed = true;
    if (voicePermissionPending
        && checkSelfPermission(Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED) {
      voicePermissionPending = false;
      voice.start();
    }
    face.setRunning(true);
    if (rotationSensor != null)
      sensors.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_UI);
    startLocation();
    handler.post(gpsRefresh);
    if (photoSync != null) {
      photoSync.sync();
      handler.postDelayed(analysisRefresh, 12000);
    }
    if (automatic.isChecked()) {
      handler.removeCallbacks(autoCapture);
      handler.postDelayed(autoCapture, 15000);
    }
    if (pendingBeginTrip && imageCapture != null) startPreparedTrip();
    if (captureAfterPermission && imageCapture != null) {
      captureAfterPermission = false;
      takePhoto();
    }
  }

  @Override
  protected void onPause() {
    resumed = false;
    saveMission();
    if (voice != null) voice.cancel();
    cancelNavigation();
    if (!permissionInProgress && !robotPermissionInProgress) pendingBeginTrip = false;
    if (robot != null && robot.isActive()) robot.stop("App left foreground");
    if (!permissionInProgress) automatic.setChecked(false);
    handler.removeCallbacks(autoCapture);
    handler.removeCallbacks(gpsRefresh);
    handler.removeCallbacks(analysisRefresh);
    face.setRunning(false);
    sensors.unregisterListener(this);
    locations.removeUpdates(locationListener);
    super.onPause();
  }

  @Override
  protected void onStop() {
    voicePermissionPending = false;
    pendingBeginTrip = false;
    if (robot != null && robot.isActive()) robot.stop("App moved to background");
    super.onStop();
  }

  @Override
  protected void onDestroy() {
    if (voice != null) voice.cancel();
    if (tapFeedback != null) tapFeedback.close();
    if (cameraProvider != null) cameraProvider.unbindAll();
    if (!inFlight && !navigationInFlight) disk.shutdown();
    if (photoSync != null) photoSync.close();
    if (robot != null) robot.close();
    super.onDestroy();
  }

  @Override
  public void onSensorChanged(SensorEvent event) {
    float[] matrix = new float[9], orientation = new float[3];
    SensorManager.getRotationMatrixFromVector(matrix, event.values);
    SensorManager.getOrientation(matrix, orientation);
    pitchDegrees = (float) Math.toDegrees(orientation[1]);
    rollDegrees = (float) Math.toDegrees(orientation[2]);
    tilt.setText(String.format(Locale.US, "Tilt · %.0f° / %.0f°", pitchDegrees, rollDegrees));
  }

  @Override
  public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
