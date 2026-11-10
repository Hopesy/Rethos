package cc.hopesy.rethos

import org.junit.Assert.*
import org.junit.Test

class ServerOriginTest {
    @Test fun normalizesHttpsOrigin() {
        assertEquals("https://example.com", ServerOrigin.parse("  HTTPS://EXAMPLE.com:443/ ")?.value)
        assertEquals("https://example.com:8443", ServerOrigin.parse("https://example.com:8443")?.value)
    }
    @Test fun rejectsCredentialsPathsAndUnencryptedOrigins() {
        for (value in listOf("http://example.com", "javascript:alert(1)", "https://user:secret@example.com", "https://example.com/path", "https://example.com#token", "https://example.com?token=x", "https://example.com:0", "https://example.com:65536")) {
            assertNull(value, ServerOrigin.parse(value))
        }
    }
    @Test fun confinesCredentialsToExactOrigin() {
        val origin = ServerOrigin.parse("https://example.com")!!
        assertTrue(origin.contains("https://example.com:443/api/file?id=1"))
        for (value in listOf("http://example.com", "https://example.com.attacker.test", "https://example.com@attacker.test", "https://other@example.com", "https://example.com:8443", "file:///etc/passwd", "https://example.com\\@attacker.test")) {
            assertFalse(value, origin.contains(value))
        }
    }
    @Test fun sanitizesDownloadNames() {
        assertEquals(".._.._file.txt", ServerOrigin.safeFileName("../../file.txt"))
        assertEquals("a_b_.txt", ServerOrigin.safeFileName("a\\b\n.txt"))
        assertEquals("download", ServerOrigin.safeFileName("  "))
    }
}
