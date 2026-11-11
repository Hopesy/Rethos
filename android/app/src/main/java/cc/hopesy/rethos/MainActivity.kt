package cc.hopesy.rethos

import android.annotation.SuppressLint
import android.Manifest
import android.content.pm.PackageManager
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.edit
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.UUID
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject

open class MainActivity : ComponentActivity() {
    internal lateinit var browser: WebView
        private set
    private lateinit var origin: ServerOrigin
    private lateinit var progress: ProgressBar
    private lateinit var failure: LinearLayout
    private lateinit var detail: TextView
    private var failed = false
    private var failedNavigationUrl: String? = null
    private var clearHistoryAfterLoad = false
    private var picker: ValueCallback<Array<Uri>>? = null
    private var pickerOrigin: String? = null
    private data class Download(val url: String, val origin: ServerOrigin, val cookie: String?, val userAgent: String)
    private var download: Download? = null
    private var textExport: Pair<ServerOrigin, TextExport>? = null
    private val downloads = Executors.newSingleThreadExecutor()
    private val preferences by lazy { getSharedPreferences("connection", MODE_PRIVATE) }
    private var scanningOrigin: String? = null
    private val scanner = registerForActivityResult(ScanContract()) { result ->
        val source = scanningOrigin
        scanningOrigin = null
        val contents = result.contents ?: return@registerForActivityResult
        if (source != origin.value) { toast(R.string.scan_expired_context); return@registerForActivityResult }
        val target = QrLogin.parse(contents, origin)
        if (target == null) toast(R.string.scan_invalid)
        else {
            failed = false
            failedNavigationUrl = null
            // The web sign-in bootstrap reads the fragment on document load, including repeated scans from the root URL.
            browser.loadUrl(target.toUri().buildUpon().appendQueryParameter("scan", UUID.randomUUID().toString()).build().toString())
        }
    }
    private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted && scanningOrigin == origin.value) launchScanner()
        else { scanningOrigin = null; toast(R.string.scan_permission) }
    }

    private val chooseFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val files = if (pickerOrigin == origin.value && origin.contains(browser.url.orEmpty()))
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data) else null
        picker?.onReceiveValue(files)
        picker = null
        pickerOrigin = null
    }
    private val saveFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val pending = download
        download = null
        val uri = result.data?.data
        if (result.resultCode == RESULT_OK && uri != null && pending != null && pending.origin == origin) {
            toast(R.string.download_started)
            downloads.execute {
                val ok = runCatching { saveDownload(pending, uri) }.isSuccess
                runOnUiThread { if (!isDestroyed) toast(if (ok) R.string.download_done else R.string.download_failed) }
            }
        }
    }

    private val saveText = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val pending = textExport
        textExport = null
        val uri = result.data?.data
        if (result.resultCode == RESULT_OK && uri != null && pending?.first == origin) {
            toast(R.string.download_started)
            downloads.execute {
                val ok = runCatching { requireNotNull(contentResolver.openOutputStream(uri)).use { it.write(pending.second.bytes) } }.isSuccess
                runOnUiThread { if (!isDestroyed) toast(if (ok) R.string.download_done else R.string.download_failed) }
            }
        }
    }

    private fun installTextDownloads() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.removeWebMessageListener(browser, "RethosDownloads")
        WebViewCompat.addWebMessageListener(browser, "RethosDownloads", setOf(origin.value)) { view, message, sourceOrigin, isMainFrame, _ ->
            if (!isMainFrame || !origin.contains(sourceOrigin.toString()) || !origin.contains(view.url.orEmpty()) || textExport != null) return@addWebMessageListener
            val export = runCatching {
                val raw = message.data ?: return@runCatching null
                if (raw.length > TextExport.MAX_BYTES + 1024) return@runCatching null
                val data = JSONObject(raw)
                if (data.optString("type") != "save-text") return@runCatching null
                TextExport.create(data.getString("filename"), data.getString("content"), data.getString("mime"))
            }.getOrNull()
            if (export == null) { toast(R.string.download_failed); return@addWebMessageListener }
            textExport = origin to export
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "text/markdown"
                putExtra(Intent.EXTRA_TITLE, export.filename)
            }
            try { saveText.launch(intent) } catch (_: ActivityNotFoundException) { textExport = null; toast(R.string.download_failed) }
        }
    }

    protected open fun initialOrigin(): ServerOrigin = ServerOrigin.parse(preferences.getString("server", null).orEmpty())
        ?: requireNotNull(ServerOrigin.parse(getString(R.string.default_server)))
    protected open fun intercept(request: WebResourceRequest): WebResourceResponse? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        origin = initialOrigin()
        scanningOrigin = savedInstanceState?.getString("scanning-origin")
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val lightTheme = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK != Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightTheme
            isAppearanceLightNavigationBars = lightTheme
        }
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(getColor(R.color.surface)) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val edges = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(edges.left, edges.top, edges.right, edges.bottom)
            WindowInsetsCompat.CONSUMED
        }
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; contentDescription = getString(R.string.loading) }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(2)))
        val content = FrameLayout(this)
        browser = WebView(this)
        configureBrowser()
        installTextDownloads()
        content.addView(browser, FrameLayout.LayoutParams(-1, -1))
        failure = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(dp(32), dp(32), dp(32), dp(32)); setBackgroundColor(getColor(R.color.surface)); visibility = View.GONE }
        failure.addView(ImageView(this).apply { setImageResource(R.drawable.app_icon) }, LinearLayout.LayoutParams(dp(56), dp(56)))
        failure.addView(TextView(this).apply { setText(R.string.network_title); textSize = 20f; setTextColor(getColor(R.color.ink)); setPadding(0, dp(20), 0, dp(10)) })
        detail = TextView(this).apply { textSize = 13f; gravity = Gravity.CENTER; setTextColor(getColor(R.color.secondary)) }
        failure.addView(detail)
        failure.addView(Button(this).apply { setText(R.string.retry); setOnClickListener { loadHome() } }, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(20) })
        failure.addView(Button(this, null, android.R.attr.borderlessButtonStyle).apply { setText(R.string.server); setOnClickListener { editServer() } })
        content.addView(failure, FrameLayout.LayoutParams(-1, -1))
        root.addView(content, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (browser.canGoBack()) browser.goBack()
                else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
        if (savedInstanceState == null || browser.restoreState(savedInstanceState) == null) loadHome()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureBrowser() {
        browser.setBackgroundColor(getColor(R.color.surface))
        browser.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled = true
            userAgentString += " RethosAndroid/${BuildConfig.VERSION_NAME}"
            mediaPlaybackRequiresUserGesture = true
            setSupportMultipleWindows(false)
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(browser, false) }
        browser.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = intercept(request)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.toString() == QrLogin.ACTION_URL) {
                    if (request.isForMainFrame && request.hasGesture() && origin.contains(view.url.orEmpty())) scanLogin()
                    return true
                }
                if (!request.isForMainFrame || origin.contains(request.url.toString())) return false
                if (request.hasGesture()) openExternal(request.url)
                return true
            }
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                // WebView can deliver HTTP errors before onPageStarted for the same navigation.
                failed = url != null && url == failedNavigationUrl
                failedNavigationUrl = null
                if (::failure.isInitialized) failure.visibility = if (failed) View.VISIBLE else View.GONE
                progress.visibility = if (failed) View.GONE else View.VISIBLE
            }
            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
                CookieManager.getInstance().flush()
                if (clearHistoryAfterLoad && origin.contains(url.orEmpty())) { browser.clearHistory(); clearHistoryAfterLoad = false }
                if (!failed) failure.visibility = View.GONE
                if (failedNavigationUrl == url) failedNavigationUrl = null
                if (!failed && origin.contains(url.orEmpty())) installScanEntry()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showFailure(R.string.network_detail, request.url.toString())
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame && errorResponse.statusCode >= 500) showFailure(R.string.network_detail, request.url.toString())
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                showFailure(R.string.certificate_detail, view.url)
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, value: Int) { progress.progress = value }
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                if (!origin.contains(view.url.orEmpty())) return false
                picker?.onReceiveValue(null)
                picker = callback
                pickerOrigin = origin.value
                val types = params.acceptTypes.flatMap { it.split(',') }.map { it.trim() }.filter { it.contains('/') }.distinct()
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = types.singleOrNull() ?: "*/*"
                    if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                }
                try { chooseFiles.launch(intent) } catch (_: ActivityNotFoundException) { picker?.onReceiveValue(null); picker = null; toast(R.string.upload_missing) }
                return true
            }
        }
        browser.setDownloadListener { url, userAgent, disposition, mime, _ ->
            if (origin.contains(url)) {
                download = Download(url, origin, CookieManager.getInstance().getCookie(url), userAgent.orEmpty())
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mime?.takeIf { it.contains('/') } ?: "application/octet-stream"
                    putExtra(Intent.EXTRA_TITLE, ServerOrigin.safeFileName(URLUtil.guessFileName(url, disposition, mime)))
                }
                try { saveFile.launch(intent) } catch (_: ActivityNotFoundException) { download = null; toast(R.string.download_failed) }
            } else if (url.startsWith("https://")) openExternal(url.toUri())
            else toast(R.string.download_browser)
        }
    }

    private fun saveDownload(item: Download, target: Uri) {
        var url = item.url
        repeat(6) {
            check(item.origin.contains(url))
            val connection = URL(url).openConnection() as HttpURLConnection
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 20_000
                connection.readTimeout = 30_000
                connection.setRequestProperty("User-Agent", item.userAgent)
                item.cookie?.let { connection.setRequestProperty("Cookie", it) }
                val status = connection.responseCode
                if (status in listOf(301, 302, 303, 307, 308)) {
                    url = URL(URL(url), requireNotNull(connection.getHeaderField("Location"))).toString()
                } else {
                    check(status == 200)
                    connection.inputStream.use { input -> requireNotNull(contentResolver.openOutputStream(target)).use { output -> input.copyTo(output) } }
                    return
                }
            } finally { connection.disconnect() }
        }
        error("Too many redirects")
    }

    private fun scanLogin() {
        if (scanningOrigin != null) return
        scanningOrigin = origin.value
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) launchScanner()
        else cameraPermission.launch(Manifest.permission.CAMERA)
    }

    private fun launchScanner() {
        scanner.launch(ScanOptions().setCaptureActivity(QrCaptureActivity::class.java).setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt(getString(R.string.scan_prompt)).setBeepEnabled(false).setOrientationLocked(false))
    }

    private fun installScanEntry() {
        // Rethos Web 0.1.154 renders .login-phone as explanatory text; retain compatibility with deployed servers.
        val title = JSONObject.quote(getString(R.string.scan_login))
        val hint = JSONObject.quote(getString(R.string.scan_prompt))
        browser.evaluateJavascript("""(()=>{
            if(window.rethosScanEntryInstalled)return;window.rethosScanEntryInstalled=true;
            const update=()=>{for(const entry of document.querySelectorAll('.login-phone')){
                if(entry.dataset.rethosScanReady)continue;entry.dataset.rethosScanReady='true';
                entry.setAttribute('role','button');entry.setAttribute('tabindex','0');entry.setAttribute('aria-label',$title);
                entry.style.cursor='pointer';const h=entry.querySelector('h2');if(h)h.textContent=$title;
                const p=entry.querySelector('p');if(p)p.textContent=$hint;
                const scan=e=>{if(!e.isTrusted)return;e.preventDefault();location.href='${QrLogin.ACTION_URL}';};
                entry.addEventListener('click',scan);entry.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')scan(e);});
            }};update();new MutationObserver(update).observe(document.documentElement,{subtree:true,childList:true});
        })()""", null)
    }

    private fun editServer() {
        val input = EditText(this).apply { setSingleLine(); inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI; setText(origin.value); hint = getString(R.string.server_hint); setSelectAllOnFocus(true) }
        val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(12), dp(24), 0); addView(input); addView(TextView(context).apply { setText(R.string.server_change_note); textSize = 12f; setPadding(0, dp(12), 0, 0) }) }
        val dialog = AlertDialog.Builder(this).setTitle(R.string.server).setView(form).setNegativeButton(R.string.cancel, null).setPositiveButton(R.string.connect, null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val next = ServerOrigin.parse(input.text.toString())
                if (next == null) { input.error = getString(R.string.server_error); return@setOnClickListener }
                dialog.dismiss()
                if (next == origin) { loadHome(); return@setOnClickListener }
                browser.stopLoading()
                picker?.onReceiveValue(null); picker = null; download = null; textExport = null
                CookieManager.getInstance().removeAllCookies {
                    if (isDestroyed) return@removeAllCookies
                    WebStorage.getInstance().deleteAllData()
                    clearHistoryAfterLoad = true
                    browser.clearCache(true)
                    origin = next
                    installTextDownloads()
                    preferences.edit { putString("server", next.value) }
                    loadHome()
                }
            }
        }
        dialog.show()
    }

    private fun openExternal(uri: Uri) {
        if (uri.scheme !in listOf("http", "https", "mailto", "tel")) return
        try { startActivity(Intent(if (uri.scheme == "tel") Intent.ACTION_DIAL else Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: ActivityNotFoundException) { toast(R.string.external_missing) }
    }
    private fun showFailure(message: Int, url: String?) { failed = true; failedNavigationUrl = url; progress.visibility = View.GONE; detail.setText(message); failure.visibility = View.VISIBLE }
    private fun loadHome() { failed = false; failedNavigationUrl = null; failure.visibility = View.GONE; browser.loadUrl(origin.value + "/") }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun toast(message: Int) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    override fun onSaveInstanceState(outState: Bundle) { outState.putString("scanning-origin", scanningOrigin); browser.saveState(outState); super.onSaveInstanceState(outState) }
    override fun onPause() { browser.onPause(); CookieManager.getInstance().flush(); super.onPause() }
    override fun onResume() {
        super.onResume()
        browser.onResume()
        if (origin.contains(browser.url.orEmpty())) browser.evaluateJavascript("window.dispatchEvent(new Event('omb:retry-live-events'))", null)
    }
    override fun onDestroy() { picker?.onReceiveValue(null); picker = null; browser.stopLoading(); browser.destroy(); downloads.shutdownNow(); super.onDestroy() }
}
