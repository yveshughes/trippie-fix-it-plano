package com.trippie.robot;

import java.util.*;

/** Fixed packets audited against TTS app 1.82; no arbitrary byte writer is exposed in the UI. */
final class RobotProtocol {
  static final UUID SERVICE = UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb");
  static final UUID RX = UUID.fromString("0000fff1-0000-1000-8000-00805f9b34fb");
  static final UUID TX = UUID.fromString("0000fff2-0000-1000-8000-00805f9b34fb");
  static final UUID CCC = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

  static byte[] mode2() {
    return hex("aa0385111156");
  }

  static byte[] avoidanceOn() {
    return hex("aa0385111354");
  }

  static byte[] clear() {
    return hex("aa0381110269");
  }

  static byte[] go() {
    return hex("aa038111016a");
  }

  // A native one-step program ends on the robot even if the phone loses its link.
  static byte[] direction(String action) {
    byte code;
    switch (action) {
      case "forward":
        code = 4;
        break;
      case "left":
        code = 8;
        break;
      case "right":
        code = 9;
        break;
      default:
        throw new IllegalArgumentException("Unsupported driving direction");
    }
    byte[] packet = {(byte) 0xaa, 4, (byte) 0x82, 0x11, code, 1, 0};
    packet[6] = (byte) -(4 + 0x82 + 0x11 + code + 1);
    return packet;
  }

  static byte[] forward(int steps) {
    if (steps < 1 || steps > 10) throw new IllegalArgumentException("One to ten steps per batch");
    byte[] packet = new byte[steps + 6];
    packet[0] = (byte) 0xaa;
    packet[1] = (byte) (steps + 3);
    packet[2] = (byte) 0x82;
    packet[3] = 0x11;
    Arrays.fill(packet, 4, 4 + steps, (byte) 4);
    packet[packet.length - 2] = 1;
    int sum = 0;
    for (int i = 1; i < packet.length - 1; i++) sum += packet[i] & 255;
    packet[packet.length - 1] = (byte) (-sum);
    return packet;
  }

  static byte[] hex(String value) {
    byte[] out = new byte[value.length() / 2];
    for (int i = 0; i < out.length; i++)
      out[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
    return out;
  }

  static String hex(byte[] value) {
    StringBuilder out = new StringBuilder();
    for (byte b : value) out.append(String.format(Locale.US, "%02x", b & 255));
    return out.toString();
  }

  static final class Decoder {
    private final ArrayList<Byte> buffer = new ArrayList<>();

    List<byte[]> feed(byte[] bytes) {
      for (byte b : bytes) buffer.add(b);
      List<byte[]> frames = new ArrayList<>();
      while (!buffer.isEmpty()) {
        if ((buffer.get(0) & 255) != 0xaa) {
          buffer.remove(0);
          continue;
        }
        if (buffer.size() < 2) break;
        if (buffer.get(1) != 3) {
          buffer.remove(0);
          continue;
        }
        if (buffer.size() < 6) break;
        int sum = 0;
        for (int i = 1; i < 6; i++) sum += buffer.get(i) & 255;
        if ((sum & 255) != 0) {
          buffer.remove(0);
          continue;
        }
        byte[] frame = new byte[6];
        for (int i = 0; i < 6; i++) frame[i] = buffer.remove(0);
        frames.add(frame);
      }
      return frames;
    }
  }
}
