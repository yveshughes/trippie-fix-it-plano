package com.trippie.robot;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;

/** Original character and tap-to-talk microphone share one interruptible animated surface. */
public final class TrippieFace extends View {
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Path mouth = new Path();
  private final RadialGradient glow =
      new RadialGradient(
          0, 0, 138, new int[] {0x252CDD8A, 0x002CDD8A}, null, Shader.TileMode.CLAMP);
  private final long epoch = SystemClock.uptimeMillis();
  private boolean running, awake, listening;
  private float micBlend, micVelocity, voiceLevel;
  private long lastFrame, smileUntil;

  public TrippieFace(Context context) {
    super(context);
    setContentDescription("Trippie, a friendly robot with animated green eyes");
    setOnClickListener(
        v -> {
          smileUntil = SystemClock.uptimeMillis() + 1800;
          invalidate();
        });
  }

  public void setAwake(boolean value) {
    awake = value;
    invalidate();
  }

  public void setRunning(boolean value) {
    running = value;
    if (value) invalidate();
  }

  public void setListening(boolean value) {
    listening = value;
    setContentDescription(
        value
            ? "Listening to your command; tap to cancel"
            : "Tap to speak to Trippie; hold to type a mission");
    if (!value) voiceLevel = 0;
    invalidate();
  }

  public void setVoiceLevel(float value) {
    voiceLevel = value;
    invalidate();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    super.onDraw(canvas);
    boolean animate = running && ValueAnimator.areAnimatorsEnabled();
    long now = SystemClock.uptimeMillis();
    float dt = lastFrame == 0 ? 1f / 30 : Math.min(.04f, (now - lastFrame) / 1000f);
    lastFrame = now;
    float target = listening ? 1 : 0;
    if (animate) {
      micVelocity += ((target - micBlend) * 160 - 24 * micVelocity) * dt;
      micBlend += micVelocity * dt;
      if (Math.abs(target - micBlend) < .001f && Math.abs(micVelocity) < .01f) {
        micBlend = target;
        micVelocity = 0;
      }
    } else {
      micBlend = target;
      micVelocity = 0;
    }
    float blend = Math.max(0, Math.min(1, micBlend));
    float unit = Math.min(getWidth() / 360f, getHeight() / 340f);
    float time = animate ? (now - epoch) / 1000f : 0;
    canvas.save();
    canvas.translate(getWidth() / 2f, getHeight() / 2f);
    canvas.scale(unit, unit);
    canvas.translate(
        (float) Math.sin(time * .7) * 7 * (1 - blend),
        (float) Math.sin(time * 1.5) * 4 * (1 - blend));
    paint.setStyle(Paint.Style.FILL);
    paint.setColor(0xFF22352D);
    canvas.drawCircle(0, 0, 140, paint);
    paint.setShader(glow);
    canvas.drawCircle(0, 0, 138, paint);
    paint.setShader(null);
    int layer = canvas.saveLayerAlpha(-160, -160, 160, 160, (int) (255 * (1 - blend)));
    float cycle = time % 5.8f;
    float blink = cycle > 5.55f ? Math.max(.09f, Math.abs(cycle - 5.675f) / .125f) : 1;
    boolean happy = now < smileUntil;
    for (int side = -1; side <= 1; side += 2) {
      canvas.save();
      canvas.translate(side * 65, -12);
      canvas.scale(1, blink);
      paint.setColor(0xFFD0F591);
      paint.setShadowLayer(18, 0, 0, 0x605AF093);
      canvas.drawRoundRect(-29, -43, 29, 43, happy ? 29 : 24, happy ? 29 : 24, paint);
      paint.clearShadowLayer();
      paint.setColor(0xFFECFFD0);
      canvas.drawRoundRect(-19, -34, -8, -9, 8, 8, paint);
      canvas.restore();
    }
    paint.setColor(0xFFD0F591);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(5);
    paint.setStrokeCap(Paint.Cap.ROUND);
    mouth.reset();
    mouth.moveTo(-22, 66);
    mouth.quadTo(0, happy ? 94 : 82, 22, 66);
    canvas.drawPath(mouth, paint);
    paint.setStyle(Paint.Style.FILL);
    if (awake) {
      paint.setColor(0xFF90CDA9);
      for (int i = 0; i < 3; i++)
        canvas.drawCircle((i - 1) * 13, 117, 2.5f + (float) Math.sin(time * 3 + i) * .8f, paint);
    }
    canvas.restoreToCount(layer);
    layer = canvas.saveLayerAlpha(-160, -160, 160, 160, (int) (255 * blend));
    float pulse = animate ? voiceLevel : 0;
    paint.setStyle(Paint.Style.STROKE);
    paint.setColor(0xFFD0F591);
    paint.setStrokeWidth(2);
    paint.setAlpha((int) (45 + 70 * pulse));
    canvas.drawCircle(0, 0, 103 + 12 * pulse, paint);
    paint.setAlpha(255);
    paint.setStyle(Paint.Style.FILL);
    paint.setColor(0xFFD0F591);
    canvas.drawRoundRect(-28, -68, 28, 28, 28, 28, paint);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(7);
    paint.setStrokeCap(Paint.Cap.ROUND);
    canvas.drawArc(-47, -27, 47, 57, 0, 180, false, paint);
    canvas.drawLine(-47, -27, -47, 15, paint);
    canvas.drawLine(47, -27, 47, 15, paint);
    canvas.drawLine(0, 57, 0, 82, paint);
    canvas.drawLine(-25, 82, 25, 82, paint);
    paint.setStyle(Paint.Style.FILL);
    paint.setColor(0xFFECFFD0);
    canvas.drawRoundRect(-17, -53, -9, -22, 4, 4, paint);
    canvas.restoreToCount(layer);
    canvas.restore();
    if (animate) postInvalidateDelayed(33);
  }
}
