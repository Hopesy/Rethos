package cc.hopesy.rethos

import android.content.Intent
import android.os.SystemClock
import android.webkit.CookieManager
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class WebViewSmokeTest {
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
    @Test fun loadsIsolatedPagePreservesStorageAndNavigatesBack() {
        launch().use { scenario ->
            waitFor(scenario, "window.fixtureReady===true", "true")
            assertEquals("\"password\"", js(scenario, "document.getElementById('token').type"))
            js(scenario, "document.getElementById('login').click()")
            waitFor(scenario, "document.getElementById('state').textContent", "\"signed-in\"")
            scenario.recreate()
            waitFor(scenario, "window.fixtureReady===true", "true")
            waitFor(scenario, "document.getElementById('state').textContent", "\"signed-in\"")
            js(scenario, "document.getElementById('next').click()")
            waitFor(scenario, "location.pathname", "\"/next\"")
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
}
