package com.trippie.robot;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.View;
import android.widget.Button;

/**
 * Centered vector control with a named accessibility/long-press label and normal click semantics.
 */
final class ControlIconButton extends Button {
  private Drawable icon;
  private boolean busy;
  private final Paint activityPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
  private final Runnable feedback;

  ControlIconButton(Context context, int resource, String label, Runnable feedback) {
    super(context);
    this.feedback = feedback;
    setText("");
    setSoundEffectsEnabled(false);
    setIcon(resource, label);
  }

  void setIcon(int resource, String label) {
    icon = getContext().getDrawable(resource).mutate();
    setContentDescription(label);
    setTooltipText(label);
    invalidate();
  }

  void setBusy(boolean value) {
    busy = value;
    invalidate();
  }

  @Override
  public boolean performClick() {
    if (isEnabled()) feedback.run();
    return super.performClick();
  }

  @Override
  protected void onDraw(Canvas canvas) {
    int size = (int) (26 * getResources().getDisplayMetrics().density);
    icon.setBounds(
        (getWidth() - size) / 2,
        (getHeight() - size) / 2,
        (getWidth() + size) / 2,
        (getHeight() + size) / 2);
    icon.setAlpha(isEnabled() ? 255 : 85);
    icon.draw(canvas);
    if (busy) {
      float density = getResources().getDisplayMetrics().density;
      float radius = 18 * density, cx = getWidth() / 2f, cy = getHeight() / 2f;
      activityPaint.setColor(0xFFD0F591);
      activityPaint.setStyle(Paint.Style.STROKE);
      activityPaint.setStrokeWidth(1.5f * density);
      activityPaint.setStrokeCap(Paint.Cap.ROUND);
      boolean animate =
          ValueAnimator.areAnimatorsEnabled() && isShown() && getWindowVisibility() == View.VISIBLE;
      float angle = animate ? (SystemClock.uptimeMillis() % 1200) * .3f : -90;
      canvas.drawArc(
          cx - radius, cy - radius, cx + radius, cy + radius, angle, 95, false, activityPaint);
      if (animate) postInvalidateDelayed(33);
    }
  }
}
