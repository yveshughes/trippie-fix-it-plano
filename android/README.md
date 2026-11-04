# Trippie for Android

Native Android companion for the phone mounted on Trippie. The launch screen is an original animated face: green eyes glance and blink, the character gently bobs, and tapping it starts voice transcription with a microphone view. It respects Android's animation-off setting and stops animating off screen.

## Build and install

Open this folder in Android Studio. Use JDK 21, Android SDK 35, and the included Gradle 8.11.1 wrapper. Set `sdk.dir` in untracked `local.properties` to your Android SDK installation.

```sh
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.trippie.robot/.MainActivity
```

## Use

- **Camera icon** requests camera and optional location permissions, then saves a rear-camera JPEG and a matching JSON record.
- **Viewfinder icon** switches between the viewfinder and the character. Camera capture remains active behind the face after permission is granted.
- **Capture every 15 seconds** takes photos while this screen is open. Leaving the app turns it off. It does not drive the car.
- The GPS chip reports Android's horizontal accuracy. Fixes older than 30 seconds are excluded. No fresh fix means `location: null`; no guessed coordinates are stored.
- Tilt is the phone's pitch/roll. It is not a calibrated sidewalk slope measurement.

## Portal sync and progress

The capture indicator shows camera activity. The upload bar measures transferred bytes, then shows the server acknowledgement. Failed uploads stay on the phone for retry; repeated capture IDs reuse the observation. Captures freeze the selected LIVE/DEMO workspace and generation. Indoor practice is always DEMO and does not create a city request.

From the repository root, configure the installed debug phone for cloud use:

```sh
node scripts/configure-android.mjs --production
```

Reopen Trippie to load its configuration. The script writes `https://www.fixitplano.com` and the scoped device token into app-private storage without printing the credential. Production uploads and the city-form agent work over the phone's network, independently of the development laptop. Provider and administrator keys are never copied to Android.

For local development, run the portal on port 3015 and use `node scripts/configure-android.mjs` without `--production`. This sets up ADB reverse to loopback. USB or wireless debugging and a running local server are required for that development configuration. Only debug loopback permits cleartext; public network traffic requires HTTPS.

The portal shows received evidence in its observation feed. The server runs Muse Spark Open interpretation, Plano GIS lookup and SAM point/box segmentation with a second Muse Spark Open quality check. Eligible findings produce report payloads. Main-screen sync runs every 12 seconds while active; Settings → Saved inspections opens per-photo progress that refreshes every two seconds. Original and SAM views share one photo area. No-issue observations remain in the feed without creating a case.

Photos and JSON records live in app-private `files/captures/`. They survive process restarts; uninstalling removes them. Backup is disabled. The app owns camera capture, BLE execution and the city-form browser. Server-side Muse Spark Open/SAM inference and Supabase access use the authenticated backend. Android retains the original JPEG for attachment to the city report.

## Submit to Fix It Plano

From a saved LIVE inspection, **Submit to Fix It Plano** opens `CitySubmissionActivity`. The current adapter supports the audited **Curb Repair** form. It loads the latest analyzed case, enters GPS, Location (R) and the report, triggers city address lookup, checks visible map placement, verifies the original JPEG hash and attaches the file.

The native Submit control obtains an atomic dispatch reservation through `/api/submissions` before the phone's DOM adapter sends the city form. The adapter handles the visible anonymous skip option when offered. No laptop browser or UI automation session is part of the runtime submission path.

The dispatch reservation records the send attempt; the portal’s Submitted label is the stored case workflow status. A city reference is optional and is never invented. When returned, the phone saves the actual reference, tracking URL and visible confirmation evidence locally before synchronizing them. Reopening retries receipt synchronization. Dispatched attempts with unresolved outcomes retain their reservation for reconciliation; they are not automatically sent again.

The WebView allows the official HTTPS city origin and uses visible DOM controls, not Angular private state. The latest error handling surfaces a blocked city response and records a local diagnostic without resubmitting. The dispatch marker protects against duplicates across activity restarts. DEMO and obstacle practice cannot enter the city submission activity.

For local development, export captures without exposing them publicly:

```sh
adb exec-out run-as com.trippie.robot tar -cf - files/captures > captures.tar
```

The debug build supports `run-as`; a release build requires an explicit export/sync implementation. Keep exported evidence and precise locations out of source control.

## Indoor obstacle practice

The **Settings gear** opens capture settings. Saved goals appear in the **Missions** picker. Indoor practice is enabled by default in this build. Optionally name the target (chair, box, shoe or bag), then capture a real object on the floor. The purpose and target are frozen with the photo. The server ignores city routing and location lookup for practice, finds one physical object with Muse Spark Open, outlines it with SAM 3.1, and verifies the result. The portal shows original and a SAM toggle in **Results & cases**, labeled **Obstacle practice · no city case**. An uncertain outline is withheld and explained; no city case is created.

For cable-free local development, pair/connect the phone with Android wireless debugging, then run the configuration script. `adb reverse` also works over that wireless connection; keep the phone and Mac on the same network and the Mac's server running. This is a local development transport, not an independent cloud deployment.

## Begin Trip and car control

**Connect** opens the replacement Rugged Robot's BLE service without moving it. **Begin Trip** connects as needed, captures a fresh rear-camera frame and calls authenticated `POST /api/navigation`. Muse Spark Open on Fireworks recommends `stop`, `forward`, `left`, or `right` from the visible floor and mission. The phone validates the response and sends **one native step**, with Mode 2 and onboard obstacle avoidance requested. It then sends Clear + Go against the emptied program, waits for write acknowledgements, settles the camera and reassesses. It never executes the complete estimated route blindly.

Stop, mission edits, backgrounding, stale camera decisions, blocked/uncertain scenes, road intersections, arrival and connection/write failures halt continuation. A foreground trip has a ten-minute limit; relaunch restores its goal paused. Camera frames are transient cache files and do not create observations or cases. Automatic evidence capture is a separate setting.

GATT writes are serialized with no automatic motion retries. A supplementary Stop is attempted after 1200 ms; Bluetooth acknowledgements can delay it, so this is **not** a strict physical time bound. The stored program contains only one step. Bluetooth disconnect alone does not stop stored programs; use the car's physical power switch if remote Stop fails. Cloud vision is a planning input, not a real-time collision detector.

Hardware Stop was confirmed in one short trial. A later five-step trial reported progress without the expected sequence-end event and made contact with a box. This loop therefore uses explicit Stop writes between individual actions rather than relying on that end event. Forward's native packet matches the established one-step program. Native turns combine the audited left/right command constants with that framing. A right-turn stand test confirmed that wheels moved and stopped; physical direction and obstacle-avoidance behavior need separate supervised checks. No successful autonomous door traversal has been demonstrated.

The debug build includes Settings → Wheel check (left/forward/right plus Stop) for a car on a stand. A right-turn check returned a robot sequence-start event and acknowledged both Stop writes; the operator confirmed brief wheel movement and prompt stopping. Physical turn direction remains a separate check.

Protocol sources: audited TTS Rugged Robot app 1.82 direct command constants and local replacement-car sequence logs. This is an interoperability implementation, not a vendor SDK. Debug event logs stay in app-private `files/robot-events.log`.

### Voice missions

Tap the face for on-device Android transcription. It changes into a microphone,
and partial words appear beneath it. Tap again to cancel; hold the face to type a mission. The final transcript starts the camera-guided mission, including motor actions when the path is clear. The typed-command dialog provides the same input when on-device speech is unavailable. No raw
audio is saved or sent to the portal. Only the final mission text and a camera
frame go to Muse Spark Open through the authenticated navigation endpoint.

The mission goal and patrol selection persist on the phone. App relaunch restores
them paused; it never resumes motors. A patrol retains its objective across
planning requests, with fixed sidewalk-only/no-road-crossing constraints. Visible
sidewalk bends can be planned; road intersections or unclear continuation produce
Stop. Local estimates are limited to six segments/twelve toy steps and require
reobservation after each action. They are not a map, measured distance, or a
verified autonomous route. Voice Stop/Pause cancels locally without a model call.
Motor execution is enabled; supervised hardware validation of turns and avoidance remains necessary.

Saved commands appear in the header's Missions picker. Selecting a mission restores
its goal and patrol mode without starting motors; New mission starts tap-to-talk.
Capture settings are available from the same picker. The library is stored locally
in app preferences, deduplicated by goal and patrol mode, and survives app updates.
Buttons, the face, and the automatic-capture switch use a short synthesized tap
sound at the phone's media volume. The upload summary panel is hidden while
background photo synchronization continues.

The header gear opens Settings with capture mode, optional SAM target, automatic
15-second capture, live sync status, local capture count, GPS/tilt and car connection
information. Device statistics, the capture count, workspace footer and automatic
capture switch are kept off the main screen. Sync continues while the app is active.
