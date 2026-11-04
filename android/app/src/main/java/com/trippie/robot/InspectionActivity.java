package com.trippie.robot;

import android.app.Activity;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Read-only evidence progress. Every state comes from the capture's server job. */
public final class InspectionActivity extends Activity {
  private static final int INK=0xFFEAF0E7, MUTED=0xFF9DB0A2, LIME=0xFFD0F591;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ExecutorService network=Executors.newSingleThreadExecutor();
  private PhotoSync sync;
  private TextView heading, stage, steps, report, city;
  private ImageView original;
  private android.graphics.Bitmap originalBitmap, samBitmap;
  private Button showSam;
  private TextView photoCaption;
  private boolean showingSam;
  private ProgressBar progress;
  private Button submit;
  private String caseSummary="";
  private String mode, captureId, loadedImage="", loadedSam="";
  private boolean active;
  private final Runnable poll=()->refresh();

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    mode=getIntent().getStringExtra("mode"); captureId=getIntent().getStringExtra("captureId");
    sync=new PhotoSync(this,(text,percent)->{});
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(0xFF101C19);root.setPadding(dp(22),dp(16),dp(22),dp(16));
    root.setOnApplyWindowInsetsListener((v,insets)->{
      android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
      v.setPadding(dp(22)+bars.left,dp(12)+bars.top,dp(22)+bars.right,dp(12)+bars.bottom);return insets;
    });
    setContentView(root);
    Button back=new Button(this);back.setText("‹  trippie. / Inspection");back.setTextColor(INK);
    back.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xFF22372E));
    back.setOnClickListener(v->finish());root.addView(back);
    ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);scroll.addView(body);
    heading=label("Capture sidewalk hazards",22,INK);body.addView(heading);
    stage=label("Connecting to inspection…",18,LIME);stage.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);body.addView(stage);
    progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(6);
    progress.setProgressTintList(android.content.res.ColorStateList.valueOf(LIME));body.addView(progress,new LinearLayout.LayoutParams(-1,dp(6)));
    steps=label("",14,MUTED);body.addView(steps);
    showSam=new Button(this);showSam.setText("Show SAM highlight");showSam.setEnabled(false);
    showSam.setOnClickListener(v->{showingSam=!showingSam;updatePhoto();});body.addView(showSam);
    original=new ImageView(this);original.setScaleType(ImageView.ScaleType.FIT_CENTER);original.setBackgroundColor(0xFF22372E);
    body.addView(original,new LinearLayout.LayoutParams(-1,dp(220)));
    photoCaption=label("Original capture",12,MUTED);body.addView(photoCaption);
    report=label("",15,INK);body.addView(report);
    city=label("No city receipt recorded in Trippie",15,LIME);body.addView(city);
    submit=new Button(this);submit.setText("Submit to Fix It Plano");submit.setEnabled(false);
    submit.setOnClickListener(v->startActivity(new android.content.Intent(this,CitySubmissionActivity.class).putExtra("captureId",captureId).putExtra("mode",mode).putExtra("caseSummary",caseSummary)));
    body.addView(submit);
  }
  private void updatePhoto() {
    if(samBitmap==null)showingSam=false;
    original.setImageBitmap(showingSam?samBitmap:originalBitmap);
    original.setContentDescription(showingSam?"SAM highlight":"Original capture");
    photoCaption.setText(showingSam?"SAM highlight":"Original capture");
    showSam.setText(showingSam?"Show original":"Show SAM highlight");
    showSam.setEnabled(samBitmap!=null);
  }
  private android.graphics.Bitmap decodePhoto(byte[] bytes) {
    BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=2;
    android.graphics.Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
    try {
      android.media.ExifInterface exif=new android.media.ExifInterface(new java.io.ByteArrayInputStream(bytes));
      int orientation=exif.getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION,1);
      android.graphics.Matrix matrix=new android.graphics.Matrix();
      if(orientation==3)matrix.postRotate(180);else if(orientation==6)matrix.postRotate(90);else if(orientation==8)matrix.postRotate(270);
      if(orientation==2)matrix.postScale(-1,1);
      if(orientation==4)matrix.postScale(1,-1);
      if(orientation==5){matrix.postRotate(90);matrix.postScale(-1,1);}
      if(orientation==7){matrix.postRotate(270);matrix.postScale(-1,1);}
      if(!matrix.isIdentity()&&bitmap!=null)bitmap=android.graphics.Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,true);
    }catch(java.io.IOException ignored){}
    return bitmap;
  }
  private TextView label(String text,int size,int color) {
    TextView view=new TextView(this);view.setText(text);view.setTextSize(size);view.setTextColor(color);view.setPadding(0,dp(10),0,dp(10));return view;
  }
  private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
  @Override protected void onResume(){super.onResume();active=true;refresh();}
  @Override protected void onPause(){active=false;handler.removeCallbacks(poll);super.onPause();}
  @Override protected void onDestroy(){sync.close();network.shutdownNow();super.onDestroy();}
  private void refresh() {
    if(!active)return;
    network.execute(()->{
      try {
        JSONObject result=sync.inspectionStatus(mode,captureId), observation=result.getJSONObject("observation");
        String image=observation.optString("image"), sam=observation.optString("samImage");
        byte[] originalBytes=null;
        try {if(!image.equals(loadedImage)&&!image.isEmpty())originalBytes=sync.inspectionMedia(image);}catch(Exception ignored){}
        final byte[] imageBytes=originalBytes;
        // An old highlight is not shown while a fresh analysis is running.
        boolean completed="complete".equals(result.optString("state"));
        byte[] overlayBytes=null;
        try {if(completed&&!sam.equals(loadedSam)&&!sam.isEmpty())overlayBytes=sync.inspectionMedia(sam);}catch(Exception ignored){}
        final byte[] samBytes=overlayBytes;
        runOnUiThread(()->{
          if(!active)return;
          JSONObject mission=result.optJSONObject("mission");
          heading.setText(mission==null?"Sidewalk inspection":mission.optString("goal","Sidewalk inspection"));
          String phase=result.optString("stage"), state=result.optString("state");
          stage.setText("failed".equals(state)?"Analysis needs retry":"complete".equals(state)?"Case ready for submission":phase);
          boolean interpreted=result.optBoolean("hasInterpretation"), located=result.optBoolean("hasLocation"), outlined="verified".equals(result.optString("highlightStatus"));
          boolean prepared=completed && !result.isNull("caseState");
          progress.setProgress(completed?5:outlined?4:located?3:interpreted?2:1,true);
          steps.setText("✓ Photo received\n"+(interpreted?"✓":"○")+" Muse Spark Open · interpret hazard\n"+(located?"✓":"○")+" Plano GIS · locate evidence\n"+(outlined?"✓":"○")+" SAM 3 · "+(completed&&!outlined?"no verified outline":"outline and verify")+"\n"+(prepared?"✓":"○")+" "+(completed&&!prepared?"No city case prepared":"Prepare city case"));
          if(imageBytes!=null){originalBitmap=decodePhoto(imageBytes);loadedImage=image;}
          if(!completed){samBitmap=null;loadedSam="";report.setText("");}
          else {
            if(samBytes!=null){samBitmap=decodePhoto(samBytes);loadedSam=sam;}
            if(sam.isEmpty())samBitmap=null;
            JSONObject submission=observation.optJSONObject("submission");
            report.setText(observation.optString("title")+"\n\n"+(submission==null?observation.optString("interpretation"):submission.optString("requestType")+"\n"+submission.optString("address")+"\n\n"+submission.optString("description")));
          }
          updatePhoto();
          boolean hasReceipt=!result.isNull("receipt")&&!result.optString("receipt").isEmpty();
          submit.setEnabled(prepared && observation.has("submission") && !hasReceipt);
          if(hasReceipt){stage.setText("Submitted · city confirmation recorded");progress.setProgress(6,true);submit.setText("Submitted to Fix It Plano");}
          caseSummary=observation.optJSONObject("submission")==null?"":observation.optJSONObject("submission").optString("description");
          String receipt=result.optString("receipt","");
          if("null".equals(receipt))receipt="";
          city.setText(receipt.isEmpty()?"No city receipt recorded in Trippie":"City submission: "+result.optString("caseState")+"\nReceipt: "+receipt);
          handler.postDelayed(poll,2000);
        });
      } catch(Exception error) {
        runOnUiThread(()->{if(active){stage.setText("Connection interrupted · retrying…");handler.postDelayed(poll,4000);}});
      }
    });
  }
}
