package com.lolistudio.app;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String TAG = "LoliStudio";
    private static final String APP_URL = "file:///android_asset/index.html";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildWebView();
    }

    // 手动建房：不用 Activity.recreate()（API 28+ 才有，minSdk 26 真机会 NoSuchMethodError）
    private void buildWebView() {
        webView = new WebView(this);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);   // assets 走 android_asset 通道，不受此限
        settings.setMediaPlaybackRequiresUserGesture(true);

        webView.addJavascriptInterface(new ErrorBridge(), "NativeErrorBridge");
        webView.setWebViewClient(makeClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                String m = "console[" + cm.messageLevel() + "] " + cm.message()
                        + " @ " + cm.sourceId() + ":" + cm.lineNumber();
                Log.e(TAG, m);
                if (cm.messageLevel() == ConsoleMessage.MessageLevel.ERROR) injectError(m);
                return true;
            }
        });

        setContentView(webView);
        webView.loadUrl(APP_URL);
    }

    private WebViewClient makeClient() {
        return new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !url.startsWith("file:///android_asset/");
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                String m = "onReceivedError: " + err.getDescription()
                        + " url=" + (req != null ? req.getUrl() : null)
                        + " code=" + err.getErrorCode();
                Log.e(TAG, m);
                injectError(m);
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                Log.e(TAG, "onRenderProcessGone didCrash=" + (d != null && d.didCrash()));
                if (webView == v) {
                    ViewGroup parent = (ViewGroup) v.getParent();
                    if (parent != null) parent.removeView(v);
                    v.destroy();
                    webView = null;
                    // 返回 true 表示自己处理：必须真的把新 WebView 挂上去，否则永久白屏
                    new Handler(Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            if (webView == null) buildWebView();
                        }
                    });
                }
                return true;
            }
        };
    }

    private void injectError(final String message) {
        final WebView target = webView;
        if (target == null) return;
        final String quoted;
        try {
            quoted = JSONObject.quote(message);
        } catch (Exception e) {
            return;
        }
        target.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                String js =
                        "(function(){try{" +
                        "var b=document.getElementById('__nerr__');" +
                        "if(!b){b=document.createElement('div');b.id='__nerr__';" +
                        "b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#c00;" +
                        "color:#fff;font:12px monospace;padding:6px;max-height:40%;overflow:auto;white-space:pre-wrap';" +
                        "(document.body||document.documentElement).appendChild(b);}" +
                        "b.textContent+='[native] '+ " + quoted + " +'\\n';" +
                        "}catch(e){}})();";
                webView.evaluateJavascript(js, null);
            }
        });
    }

    public class ErrorBridge {
        @JavascriptInterface
        public void logError(final String msg) {
            Log.e(TAG + "-JS", msg);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    injectError("[js] " + msg);
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
