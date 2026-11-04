package com.trippie.robot;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.*;
import androidx.core.content.FileProvider;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;
import org.json.JSONObject;
import android.os.Handler;
import android.os.Looper;

/** The official city form runs on the phone; its own response confirms submission. */
public final class CitySubmissionActivity extends Activity {
  private TextView status;
  private ProgressBar progress;
  private WebView form;
  private String captureId, mode, attemptId, agentScript, sourceHash;
  private JSONObject agentConfig;
  private PhotoSync sync;
  private Button send;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ExecutorService network=Executors.newSingleThreadExecutor();
  private boolean destroyed, evaluating, dispatching, confirmed, pendingDispatch, sentToCity, attaching, cityResponseBlocked;
  private final Runnable poll=()->tick(false);

  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    captureId=getIntent().getStringExtra("captureId");
    if(captureId==null||!captureId.matches("[a-f0-9-]{36}")){finish();return;}
    mode=getIntent().getStringExtra("mode");
    if(!"live".equals(mode)){finish();return;}
    sync=new PhotoSync(this,(text,percent)->{});
    android.content.SharedPreferences prefs=getSharedPreferences("city-submissions",MODE_PRIVATE);
    attemptId=prefs.getString(captureId,null);
    if(attemptId==null){attemptId=UUID.randomUUID().toString();prefs.edit().putString(captureId,attemptId).commit();}
    try(java.io.InputStream in=getAssets().open("city-agent.js")){java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[4096];int n;while((n=in.read(chunk))!=-1)bytes.write(chunk,0,n);agentScript=bytes.toString("UTF-8");}catch(Exception e){finish();return;}
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xFF101C19);
    root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);return insets;});setContentView(root);
    Button back=new Button(this);back.setText("‹ Trippie · City submission");back.setOnClickListener(v->finish());root.addView(back);
    status=new TextView(this);status.setTextColor(0xFFD0F591);status.setTextSize(16);status.setPadding(20,14,20,14);status.setText("Connecting to Fix It Plano…");root.addView(status);
    progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);root.addView(progress,new LinearLayout.LayoutParams(-1,8));
    TextView caseText=new TextView(this);caseText.setTextColor(0xFFEAF0E7);caseText.setTextSize(12);caseText.setPadding(20,8,20,8);caseText.setText(getIntent().getStringExtra("caseSummary"));caseText.setMaxLines(3);caseText.setEllipsize(android.text.TextUtils.TruncateAt.END);caseText.setTextIsSelectable(true);root.addView(caseText);
    send=new Button(this);send.setText("Preparing city form…");send.setEnabled(false);root.addView(send);
    send.setOnClickListener(v->{if(!dispatching){dispatching=true;send.setEnabled(false);status.setText("Reserving submission · preventing duplicates…");network.execute(()->{
      try {sync.submissionCommand(command("dispatch"));runOnUiThread(()->{pendingDispatch=true;handler.removeCallbacks(poll);tick(false);});}
      catch(Exception error){runOnUiThread(()->status.setText(error.getMessage()));}
    });}});
    form=new WebView(this);form.getSettings().setJavaScriptEnabled(true);form.getSettings().setDomStorageEnabled(true);
    // The agent owns the form; direct taps/keyboard must not bypass its reservation.
    form.setOnTouchListener((v,event)->true);form.setFocusable(false);form.setFocusableInTouchMode(false);
    form.getSettings().setAllowFileAccess(false);form.getSettings().setAllowContentAccess(true);
    form.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    form.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();return !"https".equals(uri.getScheme())||!"iframe.publicstuff.com".equals(uri.getHost());
      }
      @Override public void onPageFinished(WebView view,String url){if(agentConfig!=null){handler.removeCallbacks(poll);handler.post(poll);}}
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())status.setText("City form connection failed · go back and retry");}
    });
    form.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onConsoleMessage(ConsoleMessage message){
        String detail=message.message();
        if(dispatching && detail.contains("request_submit") && detail.contains("CORS")){
          cityResponseBlocked=true;handler.removeCallbacks(poll);
          send.setEnabled(false);
          status.setText("City response blocked · submission unconfirmed. Do not resend.");
          try(java.io.FileOutputStream out=openFileOutput("city-error-"+captureId+".json",MODE_PRIVATE)){
            out.write(new JSONObject().put("captureId",captureId).put("attemptId",attemptId).put("error","City request_submit response blocked by CORS").put("at",java.time.Instant.now().toString()).toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();
          }catch(Exception ignored){}
        }
        return super.onConsoleMessage(message);
      }
      @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);}
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        File photo=new File(getFilesDir(),"captures/"+captureId+".jpg");
        if(photo.isFile()){callback.onReceiveValue(new Uri[]{FileProvider.getUriForFile(CitySubmissionActivity.this,getPackageName()+".evidence",photo)});status.setText("Original photo attached · verifying city form…");}
        else{callback.onReceiveValue(null);status.setText("Original photo missing on phone");}
        return true;
      }
    });
    root.addView(form,new LinearLayout.LayoutParams(-1,0,1));
    network.execute(()->{
      try {
        File receiptFile=new File(getFilesDir(),"city-receipt-"+captureId+".json");
        if(receiptFile.isFile()){
          JSONObject savedReceipt=new JSONObject(new String(java.nio.file.Files.readAllBytes(receiptFile.toPath()),StandardCharsets.UTF_8));
          sync.submissionCommand(savedReceipt);
          runOnUiThread(()->{confirmed=true;status.setText("Submitted · city confirmation "+savedReceipt.optString("receipt")+" · synced");send.setText("Already submitted");progress.setProgress(100);});return;
        }
        JSONObject prepared=sync.submissionCommand(command("prepare"));
        if("confirmed".equals(prepared.optString("state"))){runOnUiThread(()->{status.setText("Submitted · city confirmation "+prepared.optString("receipt"));send.setText("Already submitted");progress.setProgress(100);});return;}
        if(!"prepared".equals(prepared.optString("state"))){runOnUiThread(()->status.setText("Existing submission · check city confirmation before retrying"));return;}
        JSONObject submission=prepared.getJSONObject("submission");
        sourceHash=prepared.optString("sourceHash");
        agentConfig=new JSONObject().put("captureId",captureId).put("latitude",prepared.getDouble("latitude")).put("longitude",prepared.getDouble("longitude")).put("locationDetails",submission.getString("locationDetails")).put("description",submission.getString("description")).put("dispatch",false);
        runOnUiThread(()->{status.setText("Agent · opening Curb Repair…");form.loadUrl("https://iframe.publicstuff.com/#?client_id=162");});
      }catch(Exception error){runOnUiThread(()->status.setText(error.getMessage()));}
    });
  }
  private JSONObject command(String action) throws Exception {
    return new JSONObject().put("mode",mode).put("captureId",captureId).put("attemptId",attemptId).put("action",action);
  }
  private void tick(boolean dispatch) {
    if(destroyed||confirmed||cityResponseBlocked||agentConfig==null)return;
    if(evaluating){handler.postDelayed(poll,1200);return;}
    String url=form.getUrl();if(url==null||!"iframe.publicstuff.com".equals(Uri.parse(url).getHost()))return;
    try {
      boolean once=(pendingDispatch||dispatch)&&!sentToCity;
      agentConfig.put("dispatch",once).put("receiptOnly",sentToCity);
      if(once){sentToCity=true;pendingDispatch=false;getSharedPreferences("city-submissions",MODE_PRIVATE).edit().putBoolean(captureId+":dispatched",true).commit();}
    }catch(Exception ignored){return;}
    evaluating=true;
    form.evaluateJavascript(agentScript+"("+agentConfig+")",value->{
      evaluating=false;if(destroyed||cityResponseBlocked)return;
      try {
        JSONObject update=new JSONObject(value);String state=update.optString("stage");
        if(update.optBoolean("needsPhoto")){if(!attaching)attachOriginal();return;}
        status.setText("Agent · "+update.optString("message"));
        progress.setProgress("confirmed".equals(state)?100:"ready".equals(state)?80:dispatching?90:50);
        if("ready".equals(state)&&!dispatching){send.setText("Submit prepared case to Fix It Plano");send.setEnabled(true);}
        if("confirmed".equals(state)) {
          confirmed=true;send.setText("Saving city confirmation…");
          network.execute(()->{try {
            JSONObject receipt=command("confirm").put("receipt",update.getString("receipt")).put("url",update.getString("url")).put("evidence",update.getString("evidence"));
            try(java.io.FileOutputStream out=openFileOutput("city-receipt-"+captureId+".json",MODE_PRIVATE)){out.write(receipt.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
            sync.submissionCommand(receipt);
            runOnUiThread(()->{send.setText("Submitted · "+update.optString("receipt"));status.setText("City confirmation "+update.optString("receipt")+" · saved to Trippie");});
          }catch(Exception error){runOnUiThread(()->status.setText("City receipt "+update.optString("receipt")+" · sync needs retry. Do not submit again."));}});
          return;
        }
        if("blocked".equals(state)||"attention".equals(state)){send.setEnabled(false);return;}
      }catch(Exception error){status.setText("City agent needs review · no automatic retry of submission");return;}
      handler.postDelayed(poll,1200);
    });
  }
  private void attachOriginal(){
    attaching=true;status.setText("Agent · attaching original evidence…");
    network.execute(()->{try{
      byte[] bytes=java.nio.file.Files.readAllBytes(new File(getFilesDir(),"captures/"+captureId+".jpg").toPath());
      if(bytes.length>3900000)throw new java.io.IOException("Original photo too large");
      String hash=String.format("%064x",new java.math.BigInteger(1,java.security.MessageDigest.getInstance("SHA-256").digest(bytes)));
      if(sourceHash==null||!sourceHash.equals(hash))throw new java.io.IOException("Photo differs from analyzed evidence");
      String encoded=android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP);
      runOnUiThread(()->form.evaluateJavascript("window.__trippiePhotoParts=[]",ignored->photoChunk(encoded,0)));
    }catch(Exception error){runOnUiThread(()->status.setText("Evidence attachment failed · "+error.getMessage()));}});
  }
  private void photoChunk(String encoded,int offset){
    if(destroyed)return;
    String url=form.getUrl();if(url==null||!"iframe.publicstuff.com".equals(Uri.parse(url).getHost()))return;
    if(offset<encoded.length()){
      int end=Math.min(offset+49152,encoded.length());
      form.evaluateJavascript("window.__trippiePhotoParts.push("+JSONObject.quote(encoded.substring(offset,end))+")",ignored->photoChunk(encoded,end));
    }else{
      String js="(()=>{const raw=atob(window.__trippiePhotoParts.join(''));delete window.__trippiePhotoParts;const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],"+JSONObject.quote(captureId+".jpg")+",{type:'image/jpeg'}));const input=document.querySelector('#file_upload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return input.files.length;})()";
      form.evaluateJavascript(js,value->{if("1".equals(value)){status.setText("Original evidence attached");handler.postDelayed(poll,1200);}else status.setText("City did not accept the original photo");});
    }
  }
  @Override protected void onDestroy(){destroyed=true;handler.removeCallbacks(poll);network.shutdown();if(sync!=null)sync.close();if(form!=null){form.stopLoading();form.destroy();}super.onDestroy();}
}
