package cc.hopesy.rethos

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

class FixtureActivity : MainActivity() {
    override fun initialOrigin() = requireNotNull(ServerOrigin.parse("https://fixture.rethos.test"))
    override fun intercept(request: WebResourceRequest): WebResourceResponse {
        val fixture = request.url.host == "fixture.rethos.test"
        val status = if (fixture && request.url.path != "/unavailable") 200 else 503
        val html = """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body><h1 id="title">Rethos isolated Android fixture</h1>
            <div id="scan" class="login-phone"><h2>在手机上继续</h2><p>Phone login</p></div>
            <label for="token">Token</label><input id="token" type="password" autocomplete="current-password">
            <button id="login" onclick="localStorage.setItem('signed-in','signed-in');document.getElementById('state').textContent='signed-in'">Login</button>
            <div id="state"></div><a id="next" href="/next">Next</a><p><a id="unavailable" href="/unavailable">Offline</a></p>
            <input id="file" type="file" accept="text/plain" onchange="this.files[0]?.text().then(text=>document.getElementById('upload').textContent=text)"><div id="upload"></div>
            <script>window.signInAtLoad=location.hash;document.getElementById('state').textContent=localStorage.getItem('signed-in')||'signed-out';window.addEventListener('load',()=>window.fixtureReady=true);</script>
            </body></html>""".trimIndent()
        return WebResourceResponse("text/html", "UTF-8", status, if (status == 200) "OK" else "Unavailable", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(html.toByteArray()))
    }
}
