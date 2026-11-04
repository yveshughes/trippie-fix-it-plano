package com.trippie.robot;

import java.util.Locale;
import org.json.*;

final class MissionCommand {
  static boolean shouldRecheck(String situation) {
    return "continue".equals(situation)
        || "blocked".equals(situation)
        || "uncertain".equals(situation);
  }

  static boolean isStop(String text) {
    String normalized =
        text.toLowerCase(Locale.US).replaceAll("[^a-z ]", "").trim().replaceAll(" +", " ");
    return normalized.matches("(trippie )?(stop|pause|cancel)( trippie| trip| mission)?");
  }

  static boolean isPatrol(String text) {
    String normalized = text.toLowerCase(Locale.US);
    return !normalized.contains("door")
        && (normalized.contains("patrol")
            || normalized.contains("find")
                && (normalized.contains("hazard") || normalized.contains("sidewalk")));
  }

  static String describePlan(JSONObject decision) throws JSONException {
    JSONArray plan = decision.getJSONArray("plan");
    if (plan.length() > 6) throw new JSONException("Oversize plan");
    StringBuilder out = new StringBuilder();
    int total = 0;
    for (int i = 0; i < plan.length(); i++) {
      JSONObject step = plan.getJSONObject(i);
      String phase = step.getString("phase"), direction = step.getString("direction");
      int count = step.getInt("steps");
      if (!java.util.Arrays.asList("avoid_obstacle", "reach_goal", "follow_sidewalk")
              .contains(phase)
          || !java.util.Arrays.asList("forward", "left", "right").contains(direction)
          || count < 1
          || count > 3) throw new JSONException("Invalid plan");
      total += count;
      if (total > 12) throw new JSONException("Oversize plan");
      if (i > 0) out.append("\n");
      out.append(i + 1)
          .append(". ")
          .append(
              phase.equals("avoid_obstacle")
                  ? "Avoid obstacle"
                  : phase.equals("reach_goal") ? "Toward goal" : "Follow sidewalk")
          .append(": ")
          .append(direction)
          .append(" × ")
          .append(count);
    }
    if (plan.length() == 0) return "Hold position · mission remembered";
    return out + "\nEstimate: " + total + " local steps · look again after each action";
  }
}
