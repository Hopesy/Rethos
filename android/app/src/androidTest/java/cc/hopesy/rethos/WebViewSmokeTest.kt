package cc.hopesy.rethos

import android.content.Intent
import android.app.Activity
import android.app.Instrumentation
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.MotionEvent
import android.webkit.CookieManager
import android.widget.Button
import android.widget.TextView
import androidx.core.content.FileProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.Rule
import androidx.test.rule.GrantPermissionRule
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.io.File
import org.json.JSONArray

@RunWith(AndroidJUnit4::class)
class WebViewSmokeTest {
    @get:Rule val cameraPermission: GrantPermissionRule = GrantPermissionRule.grant(android.Manifest.permission.CAMERA)
    private fun launch(): ActivityScenario<MainActivity> {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val intent = Intent().setClassName(context, "cc.hopesy.rethos.FixtureActivity")
        return ActivityScenario.launch(intent)
    }
    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
        val done = CountDownLatch(1)
        val result = AtomicReference("")
        scenario.onActivity { it.browser.evaluateJavascript(script) { value -> result.set(value); done.countDown() } }
        assertTrue("JavaScript callback", done.await(10, TimeUnit.SECONDS))
        return result.get()
    }
    private fun waitFor(scenario: ActivityScenario<MainActivity>, script: String, expected: String) {
        val deadline = SystemClock.uptimeMillis() + 15_000
        while (SystemClock.uptimeMillis() < deadline) { if (js(scenario, script) == expected) return; SystemClock.sleep(100) }
        assertEquals(expected, js(scenario, script))
    }
    private fun waitForNative(scenario: ActivityScenario<MainActivity>, predicate: (MainActivity) -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 15_000
        while (SystemClock.uptimeMillis() < deadline) {
            var ready = false
            scenario.onActivity { ready = predicate(it) }
            if (ready) return
            SystemClock.sleep(100)
        }
        var state = ""
        scenario.onActivity { activity -> state = "url=${activity.browser.url}, progress=${activity.browser.progress}, history=${activity.browser.copyBackForwardList().size}, views=" + views(activity.window.decorView).filterIsInstance<TextView>().filter { it.isShown }.joinToString { it.text.toString() } }
        fail("Native state did not become ready: $state")
    }
    private fun views(view: View): Sequence<View> = sequence {
        yield(view)
        if (view is ViewGroup) for (index in 0 until view.childCount) yieldAll(views(view.getChildAt(index)))
    }
    private fun tap(scenario: ActivityScenario<MainActivity>, id: String) {
        waitForNative(scenario) { it.browser.progress == 100 }
        js(scenario, "document.getElementById('$id').scrollIntoView({block:'center'})")
        val bounds = JSONArray(js(scenario, "(()=>{const r=document.getElementById('$id').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth]})()"))
        var x = 0f
        var y = 0f
        scenario.onActivity {
            val location = IntArray(2)
            it.browser.getLocationOnScreen(location)
            val scale = it.browser.width / bounds.getDouble(2)
            x = (location[0] + bounds.getDouble(0) * scale).toFloat()
            y = (location[1] + bounds.getDouble(1) * scale).toFloat()
        }
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val time = SystemClock.uptimeMillis()
        MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, x, y, 0).also { instrumentation.sendPointerSync(it); it.recycle() }
        MotionEvent.obtain(time, time + 60, MotionEvent.ACTION_UP, x, y, 0).also { instrumentation.sendPointerSync(it); it.recycle() }
        instrumentation.waitForIdleSync()
    }
    @Test fun loadsIsolatedPagePreservesStorageAndNavigatesBack() {
        launch().use { scenario ->
            waitFor(scenario, "window.fixtureReady===true", "true")
            assertEquals("\"password\"", js(scenario, "document.getElementById('token').type"))
            tap(scenario, "login")
            waitFor(scenario, "document.getElementById('state').textContent", "\"signed-in\"")
            scenario.recreate()
            waitFor(scenario, "window.fixtureReady===true", "true")
            waitFor(scenario, "document.getElementById('state').textContent", "\"signed-in\"")
            tap(scenario, "next")
            waitFor(scenario, "location.pathname", "\"/next\"")
            waitForNative(scenario) { it.browser.canGoBack() }
            scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
            waitFor(scenario, "location.pathname", "\"/\"")
        }
    }
    @Test fun preservesHttpOnlyCookieAcrossActivityRecreation() {
        launch().use { scenario ->
            waitFor(scenario, "window.fixtureReady===true", "true")
            val saved = CountDownLatch(1)
            scenario.onActivity { CookieManager.getInstance().setCookie("https://fixture.rethos.test", "rethos-test=session; Path=/; Secure; HttpOnly; Max-Age=3600") { ok -> assertTrue(ok); CookieManager.getInstance().flush(); saved.countDown() } }
            assertTrue(saved.await(10, TimeUnit.SECONDS))
            assertFalse(js(scenario, "document.cookie").contains("rethos-test"))
            scenario.recreate()
            waitFor(scenario, "window.fixtureReady===true", "true")
            scenario.onActivity {
                assertTrue(CookieManager.getInstance().getCookie("https://fixture.rethos.test").contains("rethos-test=session"))
                assertFalse(it.browser.settings.allowFileAccess)
                assertFalse(it.browser.settings.allowContentAccess)
                assertEquals(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW, it.browser.settings.mixedContentMode)
            }
        }
    }
    @Test fun fileChooserReturnsSelectedContentToPage() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val directory = File(context.cacheDir, "fixture-uploads").apply { mkdirs() }
        val file = File(directory, "sample.txt").apply { writeText("rethos-upload-verified") }
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fixtures", file)
        val launched = CountDownLatch(1)
        val monitor = object : Instrumentation.ActivityMonitor() {
            override fun onStartActivity(intent: Intent): Instrumentation.ActivityResult? {
                if (intent.action != Intent.ACTION_OPEN_DOCUMENT) return null
                assertEquals("text/plain", intent.type)
                assertTrue(intent.hasCategory(Intent.CATEGORY_OPENABLE))
                launched.countDown()
                return Instrumentation.ActivityResult(Activity.RESULT_OK, Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
            }
        }
        instrumentation.addMonitor(monitor)
        try {
            launch().use { scenario ->
                waitFor(scenario, "window.fixtureReady===true", "true")
                tap(scenario, "file")
                assertTrue("System document picker launched", launched.await(10, TimeUnit.SECONDS))
                waitFor(scenario, "document.getElementById('upload').textContent", "\"rethos-upload-verified\"")
            }
        } finally { instrumentation.removeMonitor(monitor); file.delete() }
    }
    @Test fun showsConnectionFailureAndRetriesHome() {
        launch().use { scenario ->
            waitFor(scenario, "window.fixtureReady===true", "true")
            tap(scenario, "unavailable")
            waitForNative(scenario) { activity ->
                views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text == activity.getString(R.string.network_detail) }
            }
            scenario.onActivity { activity ->
                views(activity.window.decorView).filterIsInstance<Button>().single { it.isShown && it.text == activity.getString(R.string.retry) }.performClick()
            }
            waitFor(scenario, "location.pathname", "\"/\"")
            waitFor(scenario, "window.fixtureReady===true", "true")
            waitForNative(scenario) { activity ->
                views(activity.window.decorView).filterIsInstance<TextView>().none { it.isShown && it.text == activity.getString(R.string.network_detail) }
            }
        }
    }

    @Test fun phoneEntryLaunchesNativeCameraAndCancelReturnsToLogin() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val monitor = instrumentation.addMonitor(QrCaptureActivity::class.java.name, null, false)
        try {
            launch().use { scenario ->
                waitFor(scenario, "document.getElementById('scan').getAttribute('role')", "\"button\"")
                var scanTitle = ""
                scenario.onActivity { scanTitle = org.json.JSONObject.quote(it.getString(R.string.scan_login)) }
                assertEquals(scanTitle, js(scenario, "document.querySelector('#scan h2').textContent"))
                js(scenario, "document.getElementById('scan').click()")
                assertNull("Synthetic click should not launch camera", monitor.waitForActivityWithTimeout(400))
                tap(scenario, "scan")
                val camera = monitor.waitForActivityWithTimeout(10_000)
                assertNotNull("Trusted tap launches native QR scanner", camera)
                instrumentation.runOnMainSync { camera.finish() }
                waitFor(scenario, "window.fixtureReady===true", "true")
                assertEquals("\"\"", js(scenario, "window.signInAtLoad"))
            }
        } finally { instrumentation.removeMonitor(monitor) }
    }

    @Test fun scanningReloadsSignInBootstrapAndRejectsOtherServers() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val grant = "signin=omb_pair_" + "a".repeat(43)
        var scanResult = "https://other.example/pair#$grant"
        var launches = 0
        val launched = CountDownLatch(1)
        val monitor = object : Instrumentation.ActivityMonitor() {
            override fun onStartActivity(intent: Intent): Instrumentation.ActivityResult? {
                if (intent.component?.className != QrCaptureActivity::class.java.name) return null
                launches++
                launched.countDown()
                return Instrumentation.ActivityResult(Activity.RESULT_OK, Intent()
                    .putExtra("SCAN_RESULT", scanResult).putExtra("SCAN_RESULT_FORMAT", "QR_CODE"))
            }
        }
        instrumentation.addMonitor(monitor)
        try {
            launch().use { scenario ->
                waitFor(scenario, "document.getElementById('scan').getAttribute('role')", "\"button\"")
                tap(scenario, "scan")
                assertTrue("Scan intent dispatched", launched.await(10, TimeUnit.SECONDS))
                instrumentation.waitForIdleSync()
                assertEquals(1, launches)
                assertEquals("\"https://fixture.rethos.test\"", js(scenario, "location.origin"))
                assertEquals("\"\"", js(scenario, "window.signInAtLoad"))
                scanResult = "https://fixture.rethos.test/pair#$grant"
                repeat(2) {
                    tap(scenario, "scan")
                    waitFor(scenario, "window.signInAtLoad", "\"#$grant\"")
                    assertEquals("\"/pair\"", js(scenario, "location.pathname"))
                    js(scenario, "window.signInAtLoad='consumed';history.replaceState({},'','/pair')")
                }
                assertEquals(3, launches)
            }
        } finally { instrumentation.removeMonitor(monitor) }
    }
}
