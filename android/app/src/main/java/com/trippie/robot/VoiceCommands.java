package com.trippie.robot;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.*;
import java.util.ArrayList;

/** Tap-to-talk, on-device transcription. No ambient recording or cloud speech fallback. */
final class VoiceCommands implements RecognitionListener {
  interface Listener {
    void onText(String text, boolean complete);

    void onStatus(String message);

    default void onListening(boolean listening) {}

    default void onLevel(float level) {}
  }

  private final Context context;
  private final Listener listener;
  private SpeechRecognizer recognizer;
  private boolean active;
  private int generation;

  VoiceCommands(Context context, Listener listener) {
    this.context = context;
    this.listener = listener;
  }

  void start() {
    cancel();
    if (Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
      listener.onStatus("On-device voice unavailable · type your command instead");
      return;
    }
    try {
      recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context);
      int session = generation;
      recognizer.setRecognitionListener(
          new RecognitionListener() {
            private boolean current() {
              return session == generation && active;
            }

            public void onReadyForSpeech(Bundle p) {
              if (current()) VoiceCommands.this.onReadyForSpeech(p);
            }

            public void onBeginningOfSpeech() {
              if (current()) VoiceCommands.this.onBeginningOfSpeech();
            }

            public void onRmsChanged(float r) {
              if (current()) VoiceCommands.this.onRmsChanged(r);
            }

            public void onBufferReceived(byte[] b) {
              if (current()) VoiceCommands.this.onBufferReceived(b);
            }

            public void onEndOfSpeech() {
              if (current()) VoiceCommands.this.onEndOfSpeech();
            }

            public void onError(int e) {
              if (current()) VoiceCommands.this.onError(e);
            }

            public void onResults(Bundle r) {
              if (current()) VoiceCommands.this.onResults(r);
            }

            public void onPartialResults(Bundle r) {
              if (current()) VoiceCommands.this.onPartialResults(r);
            }

            public void onEvent(int e, Bundle p) {
              if (current()) VoiceCommands.this.onEvent(e, p);
            }
          });
      active = true;
      listener.onListening(true);
      Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
      intent.putExtra(
          RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
      intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
      intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
      recognizer.startListening(intent);
      listener.onStatus("Listening… say where to go or what to inspect");
    } catch (RuntimeException error) {
      cancel();
      listener.onStatus("Voice unavailable · type your command instead");
    }
  }

  void cancel() {
    generation++;
    active = false;
    listener.onListening(false);
    if (recognizer != null) {
      recognizer.cancel();
      recognizer.destroy();
      recognizer = null;
    }
  }

  @Override
  public void onReadyForSpeech(Bundle params) {}

  @Override
  public void onBeginningOfSpeech() {}

  @Override
  public void onRmsChanged(float rms) {
    if (active) listener.onLevel(Math.max(0, Math.min(1, (rms + 2) / 12)));
  }

  @Override
  public void onBufferReceived(byte[] buffer) {}

  @Override
  public void onEndOfSpeech() {
    if (active) listener.onStatus("Transcribing…");
  }

  @Override
  public void onError(int error) {
    if (!active) return;
    android.util.Log.w("TrippieVoice", "Recognition error " + error);
    active = false;
    listener.onListening(false);
    listener.onStatus(
        error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
            ? "Didn't catch that · tap the face to try again"
            : "Voice unavailable · type your command instead");
  }

  private void text(Bundle results, boolean complete) {
    if (!active) return;
    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
    if (complete) {
      active = false;
      listener.onListening(false);
    }
    if (matches != null && !matches.isEmpty()) listener.onText(matches.get(0), complete);
    else if (complete) listener.onStatus("Didn't catch that · tap the face to try again");
  }

  @Override
  public void onResults(Bundle results) {
    text(results, true);
  }

  @Override
  public void onPartialResults(Bundle results) {
    text(results, false);
  }

  @Override
  public void onEvent(int type, Bundle params) {}
}
