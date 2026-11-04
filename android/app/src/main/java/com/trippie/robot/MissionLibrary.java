package com.trippie.robot;

import android.content.SharedPreferences;
import java.util.*;
import org.json.*;

/** Phone-local mission library, separate from temporary speech drafts and motor state. */
final class MissionLibrary {
  static final class Mission {
    final String id, goal;
    final boolean patrol;

    Mission(String id, String goal, boolean patrol) {
      this.id = id;
      this.goal = goal;
      this.patrol = patrol;
    }
  }

  static List<Mission> read(SharedPreferences preferences) {
    List<Mission> out = new ArrayList<>();
    try {
      JSONArray records = new JSONArray(preferences.getString("savedMissions", "[]"));
      for (int i = 0; i < records.length(); i++) {
        JSONObject record = records.optJSONObject(i);
        if (record == null) continue;
        String goal = record.optString("goal", "").trim(), id = record.optString("id", "");
        if (goal.isEmpty() || goal.length() > 240 || id.isEmpty() || MissionCommand.isStop(goal))
          continue;
        out.add(new Mission(id, goal, record.optBoolean("patrol", false)));
      }
    } catch (JSONException ignored) {
    }
    return out;
  }

  static void save(SharedPreferences preferences, String goal, boolean patrol) {
    goal = goal.trim();
    if (goal.isEmpty() || goal.length() > 240 || MissionCommand.isStop(goal)) return;
    List<Mission> missions = read(preferences);
    for (Mission mission : missions)
      if (mission.goal.equalsIgnoreCase(goal) && mission.patrol == patrol) return;
    missions.add(0, new Mission(UUID.randomUUID().toString(), goal, patrol));
    JSONArray records = new JSONArray();
    try {
      for (Mission mission : missions) {
        JSONObject record = new JSONObject();
        record.put("id", mission.id).put("goal", mission.goal).put("patrol", mission.patrol);
        records.put(record);
      }
      preferences.edit().putString("savedMissions", records.toString()).apply();
    } catch (JSONException ignored) {
    }
  }
}
