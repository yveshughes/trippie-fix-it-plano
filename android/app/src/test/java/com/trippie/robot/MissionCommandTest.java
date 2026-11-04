package com.trippie.robot;

import static org.junit.Assert.*;

import org.junit.Test;

public class MissionCommandTest {
  @Test
  public void temporaryBlockKeepsMissionAliveWithoutIgnoringArrivalOrIntersection() {
    assertTrue(MissionCommand.shouldRecheck("blocked"));
    assertTrue(MissionCommand.shouldRecheck("uncertain"));
    assertTrue(MissionCommand.shouldRecheck("continue"));
    assertFalse(MissionCommand.shouldRecheck("goal_reached"));
    assertFalse(MissionCommand.shouldRecheck("intersection"));
    assertFalse(MissionCommand.shouldRecheck("unknown"));
  }

  @Test
  public void stopDoesNotWaitForModel() {
    for (String command : new String[] {"Stop!", "Trippie stop", "pause mission", "cancel trip"})
      assertTrue(command, MissionCommand.isStop(command));
    assertFalse(MissionCommand.isStop("Don't stop until the door"));
    assertFalse(MissionCommand.isStop("Go find sidewalk hazards"));
  }

  @Test
  public void patrolIntentCanBeKeptAcrossCameraFrames() {
    assertTrue(MissionCommand.isPatrol("Go find sidewalk hazards"));
    assertTrue(MissionCommand.isPatrol("Patrol the sidewalk"));
    assertFalse(MissionCommand.isPatrol("Go out the door"));
  }
}
