package com.trippie.robot;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;
import java.io.*;
import java.nio.*;

/** A short synthesized tick; follows the device's media volume. */
final class TapFeedback {
  private final SoundPool pool;
  private int sound;
  private volatile boolean ready, closed;

  TapFeedback(Context context) {
    pool =
        new SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build())
            .build();
    pool.setOnLoadCompleteListener(
        (p, id, status) -> {
          if (status == 0 && !closed) ready = true;
        });
    try {
      int rate = 22050, count = 441;
      ByteBuffer wav = ByteBuffer.allocate(44 + count * 2).order(ByteOrder.LITTLE_ENDIAN);
      wav.put(new byte[] {'R', 'I', 'F', 'F'})
          .putInt(36 + count * 2)
          .put(new byte[] {'W', 'A', 'V', 'E', 'f', 'm', 't', ' '})
          .putInt(16)
          .putShort((short) 1)
          .putShort((short) 1)
          .putInt(rate)
          .putInt(rate * 2)
          .putShort((short) 2)
          .putShort((short) 16)
          .put(new byte[] {'d', 'a', 't', 'a'})
          .putInt(count * 2);
      for (int i = 0; i < count; i++) {
        double envelope = Math.sin(Math.PI * i / count) * Math.exp(-6.0 * i / count);
        wav.putShort((short) (Math.sin(2 * Math.PI * 1350 * i / rate) * envelope * 16000));
      }
      File file = new File(context.getCacheDir(), "tap-feedback.wav");
      try (FileOutputStream out = new FileOutputStream(file)) {
        out.write(wav.array());
      }
      sound = pool.load(file.getAbsolutePath(), 1);
    } catch (IOException ignored) {
      /* Controls remain functional without audio. */
    }
  }

  void play() {
    if (ready) pool.play(sound, .65f, .65f, 1, 0, 1);
  }

  void close() {
    closed = true;
    ready = false;
    pool.release();
  }
}
