package com.trippie.robot;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Foreground upload queue. Completion requires the portal's explicit acknowledgement. */
final class PhotoSync {
  interface Listener {
    void onProgress(String text, int percent);
  }

  private static final Semaphore QUEUE_LOCK = new Semaphore(1);
  private final File directory, workspaceCache, legacyWorkspace;
  private final Listener listener;
  private final ExecutorService network = Executors.newSingleThreadExecutor();
  private final AtomicBoolean busy = new AtomicBoolean(), again = new AtomicBoolean();
  private final String endpoint, token;
  private volatile JSONObject workspace;
  private volatile boolean closed;

  PhotoSync(Context context, Listener listener) {
    directory = new File(context.getFilesDir(), "captures");
    workspaceCache = new File(context.getFilesDir(), "sync-workspace.json");
    legacyWorkspace = new File(context.getFilesDir(), "import-workspace.json");
    try {
      workspace = read(workspaceCache);
    } catch (Exception ignored) {
    }
    this.listener = listener;
    String host = "", key = "";
    try {
      JSONObject config = read(new File(context.getFilesDir(), "sync-config.json"));
      host = config.getString("endpoint");
      key = config.getString("token");
      URI uri = URI.create(host);
      boolean local =
          "http".equals(uri.getScheme())
              && "127.0.0.1".equals(uri.getHost())
              && uri.getPort() == 3015
              && (context.getApplicationInfo().flags
                      & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)
                  != 0;
      boolean production =
          "https".equals(uri.getScheme())
              && Arrays.asList("fixitplano.com", "www.fixitplano.com").contains(uri.getHost())
              && (uri.getPort() == -1 || uri.getPort() == 443);
      if ((!local && !production)
          || uri.getRawUserInfo() != null
          || !Arrays.asList("", "/").contains(uri.getPath())
          || uri.getRawQuery() != null
          || uri.getRawFragment() != null
          || key.isEmpty()) throw new IOException("Invalid sync configuration");
      host = host.replaceAll("/$", "");
    } catch (Exception error) {
      host = "";
      key = "";
    }
    endpoint = host;
    token = key;
  }

  JSONObject inspectionStatus(String mode, String id) throws Exception {
    if (!configured() || !Arrays.asList("live", "demo").contains(mode)
        || !id.matches("[a-f0-9-]{36}")) throw new IOException("Inspection unavailable");
    HttpURLConnection request = connection("/api/analysis?mode=" + mode + "&captureId=" + id, "GET");
    try {
      if (request.getResponseCode() != 200) throw new IOException("Inspection status unavailable");
      return new JSONObject(new String(readResponse(request.getInputStream()), StandardCharsets.UTF_8));
    } finally { request.disconnect(); }
  }

  byte[] inspectionMedia(String path) throws Exception {
    if (!path.matches("/api/media/[a-f0-9-]{36}")) throw new IOException("Invalid evidence");
    HttpURLConnection request = connection(path, "GET");
    try {
      if (request.getResponseCode() != 200) throw new IOException("Evidence unavailable");
      return readResponse(request.getInputStream(), 8 * 1024 * 1024);
    } finally { request.disconnect(); }
  }

  JSONObject submissionCommand(JSONObject body) throws Exception {
    HttpURLConnection request=connection("/api/submissions","POST");
    try {
      request.setDoOutput(true);request.setRequestProperty("Content-Type","application/json");
      try(OutputStream out=request.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
      int code=request.getResponseCode();
      JSONObject result=new JSONObject(new String(readResponse(code<400?request.getInputStream():request.getErrorStream()),StandardCharsets.UTF_8));
      if(code!=200)throw new IOException(result.optString("error","Submission unavailable"));
      return result;
    }finally{request.disconnect();}
  }

  // Called on a worker thread. Frames are inspected transiently, never added to the case feed.
  JSONObject inspectNavigation(File photo, String frameId, String goal, String missionMode)
      throws Exception {
    if (!configured() || closed) throw new IOException("Navigation connection unavailable");
    byte[] bytes = Files.readAllBytes(photo.toPath());
    if (bytes.length > 4 * 1024 * 1024) throw new IOException("Navigation photo too large");
    HttpURLConnection connection =
        (HttpURLConnection) new URL(endpoint + "/api/navigation").openConnection();
    try {
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(5000);
      connection.setReadTimeout(22000);
      connection.setRequestMethod("POST");
      connection.setDoOutput(true);
      connection.setRequestProperty("Authorization", "Bearer " + token);
      connection.setRequestProperty("Content-Type", "image/jpeg");
      connection.setRequestProperty("X-Trippie-Frame-Id", frameId);
      connection.setRequestProperty(
          "X-Trippie-Goal", java.net.URLEncoder.encode(goal, "UTF-8").replace("+", "%20"));
      connection.setRequestProperty("X-Trippie-Mission-Mode", missionMode);
      connection.setFixedLengthStreamingMode(bytes.length);
      try (OutputStream out = connection.getOutputStream()) {
        out.write(bytes);
      }
      if (connection.getResponseCode() != 200)
        throw new IOException("Hold position: view could not be assessed");
      byte[] result;
      try (InputStream in = connection.getInputStream()) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[2048];
        int n;
        while ((n = in.read(buffer)) != -1) {
          if (out.size() + n > 16384) throw new IOException("Invalid navigation response");
          out.write(buffer, 0, n);
        }
        result = out.toByteArray();
      }
      if (result.length > 16384) throw new IOException("Invalid navigation response");
      JSONObject decision = new JSONObject(new String(result, StandardCharsets.UTF_8));
      if (!frameId.equals(decision.getString("requestId"))
          || !"one-bounded-action-then-reobserve".equals(decision.optString("executionPolicy")))
        throw new IOException("Mismatched navigation frame");
      return decision;
    } finally {
      connection.disconnect();
    }
  }

  boolean configured() {
    return !endpoint.isEmpty();
  }

  JSONObject captureWorkspace() {
    JSONObject current = workspace;
    if (current == null) return null;
    try {
      return new JSONObject(current.toString());
    } catch (Exception error) {
      return null;
    }
  }

  void sync() {
    if (closed) return;
    if (!configured()) {
      listener.onProgress("Saved on phone · portal connection not configured", -2);
      return;
    }
    if (!busy.compareAndSet(false, true)) {
      again.set(true);
      return;
    }
    network.execute(
        () -> {
          boolean locked = false;
          try {
            QUEUE_LOCK.acquire();
            locked = true;
            if (closed) return;
            do {
              again.set(false);
              uploadQueue();
            } while (again.get() && !closed);
          } catch (Exception error) {
            listener.onProgress("Saved on phone · upload failed. Tap Sync photos.", -2);
          } finally {
            if (locked) QUEUE_LOCK.release();
            busy.set(false);
            if (again.get() && !closed) sync();
          }
        });
  }

  private HttpURLConnection connection(String route, String method) throws IOException {
    HttpURLConnection connection = (HttpURLConnection) new URL(endpoint + route).openConnection();
    connection.setInstanceFollowRedirects(false);
    connection.setConnectTimeout(15000);
    connection.setReadTimeout(30000);
    connection.setRequestMethod(method);
    connection.setRequestProperty("Authorization", "Bearer " + token);
    return connection;
  }

  private void uploadQueue() throws Exception {
    listener.onProgress("Connecting to workspace…", -1);
    HttpURLConnection request = connection("/api/workspace", "GET");
    JSONObject state;
    try {
      if (request.getResponseCode() != 200) throw new IOException("Workspace unavailable");
      state =
          new JSONObject(
              new String(readResponse(request.getInputStream()), StandardCharsets.UTF_8));
    } finally {
      request.disconnect();
    }
    // Freeze the selected workspace; indoor practice is explicitly pinned to DEMO.
    JSONObject identity =
        new JSONObject()
            .put("mode", state.getString("mode"))
            .put("generation", state.getInt("generation"))
            .put("demoGeneration", state.getJSONObject("demo").getInt("generation"));
    JSONObject importIdentity;
    if (legacyWorkspace.isFile()) importIdentity = read(legacyWorkspace);
    else {
      importIdentity = identity;
      save(legacyWorkspace, importIdentity);
    }
    save(workspaceCache, identity);
    workspace = identity;
    File[] records = directory.listFiles((dir, name) -> name.endsWith(".json"));
    if (records == null) records = new File[0];
    Arrays.sort(records, Comparator.comparing(File::getName));
    // Freeze every discovered legacy record before the first network upload.
    for (File record : records) {
      if (closed) return;
      JSONObject metadata = read(record);
      if (!metadata.has("mode")) {
        metadata.put("mode", importIdentity.getString("mode"));
        metadata.put("generation", importIdentity.getInt("generation"));
        save(record, metadata);
      }
    }
    Set<String> analysisModes=new HashSet<>();
    int added = 0, blocked = 0, already = 0;
    for (File record : records) {
      if (closed) return;
      JSONObject metadata = read(record);
      String frozenMode=metadata.getString("mode");
      int expectedGeneration="demo".equals(frozenMode)?state.getJSONObject("demo").getInt("generation"):0;
      if (!Arrays.asList("live","demo").contains(frozenMode)
          || metadata.getInt("generation") != expectedGeneration) {
        metadata.put("uploadBlocked", true);
        save(record, metadata);
        blocked++;
        continue;
      }
      if (metadata.optBoolean("portalUploaded")) {
        analysisModes.add(frozenMode);
        already++;
        continue;
      }
      if (metadata.optBoolean("uploadBlocked")) {
        blocked++;
        continue;
      }
      String filename = metadata.getString("photo");
      if (!filename.matches("[a-f0-9-]{36}\\.jpg")) throw new IOException("Invalid photo name");
      File photo = new File(directory, filename);
      if (!photo.isFile() || photo.length() > 3_900_000)
        throw new IOException("Photo unavailable or too large");
      String boundary = "Trippie" + UUID.randomUUID();
      byte[] head =
          ("--"
                  + boundary
                  + "\r\n"
                  + "Content-Disposition: form-data; name=\"metadata\"\r\n"
                  + "Content-Type: application/json\r\n\r\n"
                  + metadata
                  + "\r\n--"
                  + boundary
                  + "\r\n"
                  + "Content-Disposition: form-data; name=\"photo\"; filename=\"capture.jpg\"\r\n"
                  + "Content-Type: image/jpeg\r\n\r\n")
              .getBytes(StandardCharsets.UTF_8);
      byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
      long total = head.length + photo.length() + tail.length;
      HttpURLConnection upload = connection("/api/captures", "POST");
      upload.setDoOutput(true);
      upload.setFixedLengthStreamingMode(total);
      upload.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
      listener.onProgress("Uploading photo…", 0);
      try {
        try (OutputStream output = upload.getOutputStream();
            InputStream input = new FileInputStream(photo)) {
          output.write(head);
          long sent = head.length;
          byte[] chunk = new byte[32768];
          int n, last = -1;
          while ((n = input.read(chunk)) != -1) {
            output.write(chunk, 0, n);
            sent += n;
            int percent = (int) (sent * 100 / total);
            if (percent != last) {
              listener.onProgress("Uploading photo · " + percent + "%", percent);
              last = percent;
            }
          }
          output.write(tail);
        }
        listener.onProgress("Adding photo to workspace…", -1);
        int code = upload.getResponseCode();
        if (code == 409) {
          metadata.put("uploadBlocked", true);
          save(record, metadata);
          blocked++;
          continue;
        }
        if (code != 200 && code != 201) throw new IOException("Upload not acknowledged");
        JSONObject response =
            new JSONObject(
                new String(readResponse(upload.getInputStream()), StandardCharsets.UTF_8));
        if (!response.optBoolean("added")
            || !frozenMode.equals(response.optString("mode"))
            || !("ANDROID-" + metadata.getString("id")).equals(response.optString("id")))
          throw new IOException("Invalid upload acknowledgement");
        metadata.put("portalUploaded", true).put("portalObservationId", response.getString("id"));
        save(record, metadata);
        added++;
        analysisModes.add(frozenMode);
        listener.onProgress("✓ Photo added to workspace", 100);
      } finally {
        upload.disconnect();
      }
    }
    if (already + added > 0 && !closed) {
      try {
        HttpURLConnection analysis = connection("/api/analysis", "POST");
        analysis.setDoOutput(true);
        analysis.setRequestProperty("Content-Type", "application/json");
        try {
          try (OutputStream output = analysis.getOutputStream()) {
            String analysisMode=analysisModes.contains("live")?"live":"demo";
            output.write(new JSONObject().put("mode",analysisMode).toString().getBytes(StandardCharsets.UTF_8));
          }
          if (analysis.getResponseCode() == 202) {
            JSONObject summary =
                new JSONObject(
                    new String(readResponse(analysis.getInputStream()), StandardCharsets.UTF_8));
            int waiting = summary.getInt("queued") + summary.getInt("analyzing");
            int completed = summary.getInt("complete"), failed = summary.getInt("failed");
            listener.onProgress(
                waiting > 0
                    ? "Added to workspace · analyzing "
                        + waiting
                        + " photo"
                        + (waiting == 1 ? "" : "s")
                        + "…"
                    : failed > 0
                        ? "Photos added · " + failed + " analyses need retry in portal"
                        : "✓ " + completed + " photos analyzed",
                waiting > 0 ? -1 : 100);
            return;
          }
        } finally {
          analysis.disconnect();
        }
      } catch (Exception ignored) {
        listener.onProgress("Photos added · analysis status unavailable", -2);
        return;
      }
    }
    listener.onProgress(
        blocked > 0
            ? "Workspace changed · " + blocked + " old photos kept on phone"
            : added > 0
                ? "✓ " + added + " photo" + (added == 1 ? "" : "s") + " added to workspace"
                : already > 0
                    ? "✓ All " + already + " photos added to workspace"
                    : "Workspace connected · ready for a photo",
        100);
  }

  private static byte[] readResponse(InputStream input) throws IOException {
    return readResponse(input, 65536);
  }

  private static byte[] readResponse(InputStream input, int limit) throws IOException {
    try (input;
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[4096];
      int size;
      while ((size = input.read(buffer)) != -1) {
        if (output.size() + size > limit) throw new IOException("Unexpected portal response");
        output.write(buffer, 0, size);
      }
      return output.toByteArray();
    }
  }

  private static JSONObject read(File file) throws Exception {
    return new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
  }

  private static void save(File file, JSONObject data) throws Exception {
    File temp = new File(file.getPath() + ".sync.tmp");
    try (FileOutputStream output = new FileOutputStream(temp)) {
      output.write(data.toString(2).getBytes(StandardCharsets.UTF_8));
      output.getFD().sync();
    }
    if (!temp.renameTo(file)) throw new IOException("Could not save queue state");
  }

  void close() {
    closed = true;
    network.shutdown();
  }
}
