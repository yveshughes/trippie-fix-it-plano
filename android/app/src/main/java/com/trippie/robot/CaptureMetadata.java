package com.trippie.robot;

public final class CaptureMetadata {
  private CaptureMetadata() {}

  public static boolean isFresh(long nowNanos, long fixNanos) {
    long age = nowNanos - fixNanos;
    return fixNanos > 0 && age >= 0 && age <= 30_000_000_000L;
  }
}
