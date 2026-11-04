package com.trippie.robot;

import static org.junit.Assert.*;

import java.util.*;
import org.junit.Test;

public class RobotProtocolTest {
  @Test
  public void routeMatchesObservedVendorPackets() {
    assertEquals("aa08821104040404040150", RobotProtocol.hex(RobotProtocol.forward(5)));
    assertEquals("aa048211040164", RobotProtocol.hex(RobotProtocol.forward(1)));
    for (int steps = 1; steps <= 10; steps++) {
      byte[] p = RobotProtocol.forward(steps);
      assertTrue(p.length <= 20);
      int sum = 0;
      for (int i = 1; i < p.length; i++) sum += p[i] & 255;
      assertEquals(0, sum & 255);
    }
    try {
      RobotProtocol.forward(11);
      fail("Oversize route accepted");
    } catch (IllegalArgumentException expected) {
    }
  }

  @Test
  public void drivingOnlySendsOneFiniteNativeStep() {
    assertArrayEquals(RobotProtocol.forward(1), RobotProtocol.direction("forward"));
    assertEquals("aa048211080160", RobotProtocol.hex(RobotProtocol.direction("left")));
    assertEquals("aa04821109015f", RobotProtocol.hex(RobotProtocol.direction("right")));
    for (String action : new String[] {"forward", "left", "right"}) {
      byte[] packet = RobotProtocol.direction(action);
      assertEquals(7, packet.length);
      int sum = 0;
      for (int i = 1; i < packet.length; i++) sum += packet[i] & 255;
      assertEquals(0, sum & 255);
    }
    try {
      RobotProtocol.direction("reverse");
      fail("Unknown direction accepted");
    } catch (IllegalArgumentException expected) {
    }
  }

  @Test
  public void decoderRejectsCorruptionAndHandlesSplitNotifications() {
    RobotProtocol.Decoder decoder = new RobotProtocol.Decoder();
    assertTrue(decoder.feed(RobotProtocol.hex("ff0aaa0382")).isEmpty());
    List<byte[]> first = decoder.feed(RobotProtocol.hex("00007baa0382000279"));
    assertEquals(2, first.size());
    assertEquals("aa038200007b", RobotProtocol.hex(first.get(0)));
    assertTrue(decoder.feed(RobotProtocol.hex("aa0382000278")).isEmpty());
    assertEquals(1, decoder.feed(RobotProtocol.hex("aa038200017a")).size());
  }
}
