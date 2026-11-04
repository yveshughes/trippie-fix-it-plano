package com.trippie.robot;

import static org.junit.Assert.*;

import org.junit.Test;

public class CaptureMetadataTest {
  @Test
  public void onlyFreshMonotonicFixesAreAccepted() {
    assertTrue(CaptureMetadata.isFresh(31_000_000_000L, 1_000_000_000L));
    assertFalse(CaptureMetadata.isFresh(31_000_000_001L, 1_000_000_000L));
    assertFalse(CaptureMetadata.isFresh(100, 101));
    assertFalse(CaptureMetadata.isFresh(100, 0));
  }
}
