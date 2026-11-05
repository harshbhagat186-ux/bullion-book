package com.bullion.shop;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int REQ_CREATE = 41;
    private static final int REQ_OPEN = 42;
    private static final int REQ_BT = 43;
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private WebView web;
    private WebView printWeb;
    private byte[] pendingSave;
    private String appUrl = "";
    private boolean fellBack = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.parseColor("#7a5a12"));
        }
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:")) return false;
                if (appUrl.length() > 0 && url.startsWith(appUrl.substring(0, appUrl.lastIndexOf('/') + 1))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { }
                return true;
            }
            @Override
            public void onReceivedError(WebView view, int code, String desc, String failingUrl) {
                // no internet on first open and nothing cached: open the copy inside the app
                if (!fellBack && failingUrl != null && failingUrl.equals(appUrl)) {
                    fellBack = true;
                    view.loadUrl("file:///android_asset/index.html");
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        try { appUrl = new String(readAll(getAssets().open("app_url.txt")), "UTF-8").trim(); } catch (Exception e) { appUrl = ""; }
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        web.loadUrl(appUrl.length() > 0 ? appUrl : "file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.handleBack&&window.handleBack())?'1':'0'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (v == null || !v.contains("1")) MainActivity.super.onBackPressed();
            }
        });
    }

    private void callJs(final String event, final String payload) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                String p = JSONObject.quote(payload == null ? "" : payload);
                web.evaluateJavascript("window.onNative&&window.onNative(" + JSONObject.quote(event) + "," + p + ")", null);
            }
        });
    }

    private void toast(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_CREATE) {
            if (resultCode == RESULT_OK && data != null && pendingSave != null) {
                try {
                    OutputStream os = getContentResolver().openOutputStream(data.getData(), "w");
                    os.write(pendingSave);
                    os.close();
                    callJs("saved", "ok");
                } catch (Exception e) {
                    callJs("saved", "error: " + e.getMessage());
                }
            } else {
                callJs("saved", "cancel");
            }
            pendingSave = null;
        } else if (requestCode == REQ_OPEN) {
            if (resultCode == RESULT_OK && data != null) {
                try {
                    InputStream is = getContentResolver().openInputStream(data.getData());
                    byte[] b = readAll(is);
                    callJs("opened", Base64.encodeToString(b, Base64.NO_WRAP));
                } catch (Exception e) {
                    callJs("opened", "");
                    toast("Could not open file: " + e.getMessage());
                }
            } else {
                callJs("opened", "");
            }
        }
    }

    private static byte[] readAll(InputStream is) throws Exception {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
        is.close();
        return bo.toByteArray();
    }

    private boolean btAllowed() {
        if (Build.VERSION.SDK_INT >= 31) {
            if (checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { requestPermissions(new String[]{"android.permission.BLUETOOTH_CONNECT"}, REQ_BT); }
                });
                return false;
            }
        }
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_BT) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            callJs("btperm", ok ? "ok" : "denied");
        }
    }

    class Bridge {
        @JavascriptInterface
        public boolean isApp() { return true; }

        @JavascriptInterface
        public void saveData(String json) {
            try {
                File dir = getFilesDir();
                File tmp = new File(dir, "data.tmp");
                FileOutputStream fo = new FileOutputStream(tmp);
                fo.write(json.getBytes("UTF-8"));
                fo.getFD().sync();
                fo.close();
                File main = new File(dir, "data.json");
                tmp.renameTo(main);
                // one rolling backup per day, keep 15
                File bdir = new File(dir, "backups");
                bdir.mkdirs();
                String day = new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date());
                File daily = new File(bdir, "data-" + day + ".json");
                FileOutputStream fb = new FileOutputStream(daily);
                fb.write(json.getBytes("UTF-8"));
                fb.close();
                File[] all = bdir.listFiles();
                if (all != null && all.length > 15) {
                    Arrays.sort(all);
                    for (int i = 0; i < all.length - 15; i++) all[i].delete();
                }
            } catch (Exception e) {
                toast("Save failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public String loadData() {
            try {
                File f = new File(getFilesDir(), "data.json");
                if (!f.exists()) return "";
                return new String(readAll(new FileInputStream(f)), "UTF-8");
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void printHtml(final String html, final String jobName, final String paper) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    final WebView pw = new WebView(MainActivity.this);
                    printWeb = pw;
                    pw.getSettings().setJavaScriptEnabled(false);
                    pw.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter ad = view.createPrintDocumentAdapter(jobName);
                            PrintAttributes.Builder b = new PrintAttributes.Builder();
                            if ("58".equals(paper)) {
                                b.setMediaSize(new PrintAttributes.MediaSize("ROLL58", "58mm roll", 2283, 11690));
                            } else if ("80".equals(paper)) {
                                b.setMediaSize(new PrintAttributes.MediaSize("ROLL80", "80mm roll", 3150, 11690));
                            } else if ("a5".equals(paper)) {
                                b.setMediaSize(PrintAttributes.MediaSize.ISO_A5);
                            } else {
                                b.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                            }
                            b.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                            pm.print(jobName, ad, b.build());
                        }
                    });
                    pw.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
                }
            });
        }

        @JavascriptInterface
        public void shareText(final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, "Share"));
                }
            });
        }

        @JavascriptInterface
        public void saveFile(final String name, final String mime, String base64) {
            pendingSave = Base64.decode(base64, Base64.DEFAULT);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_TITLE, name);
                    startActivityForResult(i, REQ_CREATE);
                }
            });
        }

        @JavascriptInterface
        public void openFile() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(i, REQ_OPEN);
                }
            });
        }

        @JavascriptInterface
        public String btDevices() {
            try {
                BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
                if (ad == null) return "{\"error\":\"This phone has no Bluetooth\"}";
                if (!btAllowed()) return "{\"error\":\"perm\"}";
                if (!ad.isEnabled()) return "{\"error\":\"Turn on Bluetooth first\"}";
                Set<BluetoothDevice> set = ad.getBondedDevices();
                JSONArray arr = new JSONArray();
                for (BluetoothDevice d : set) {
                    JSONObject o = new JSONObject();
                    o.put("name", d.getName());
                    o.put("address", d.getAddress());
                    arr.put(o);
                }
                JSONObject r = new JSONObject();
                r.put("devices", arr);
                return r.toString();
            } catch (Exception e) {
                return "{\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}";
            }
        }

        @JavascriptInterface
        public void btPrint(final String address, final String base64) {
            if (!btAllowed()) { callJs("btprint", "Allow Bluetooth permission and try again"); return; }
            new Thread(new Runnable() {
                @Override
                public void run() {
                    BluetoothSocket sock = null;
                    try {
                        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
                        ad.cancelDiscovery();
                        BluetoothDevice dev = ad.getRemoteDevice(address);
                        sock = dev.createRfcommSocketToServiceRecord(SPP);
                        sock.connect();
                        OutputStream os = sock.getOutputStream();
                        os.write(Base64.decode(base64, Base64.DEFAULT));
                        os.flush();
                        Thread.sleep(800);
                        callJs("btprint", "ok");
                    } catch (Exception e) {
                        callJs("btprint", "Printer error: " + e.getMessage());
                    } finally {
                        try { if (sock != null) sock.close(); } catch (Exception e) { }
                    }
                }
            }).start();
        }
    }
}
