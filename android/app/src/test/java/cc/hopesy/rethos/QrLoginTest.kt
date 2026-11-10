package cc.hopesy.rethos

import org.junit.Assert.*
import org.junit.Test

class QrLoginTest {
    private val origin = requireNotNull(ServerOrigin.parse("https://rethos.example.com"))
    private val fragment = "signin=omb_pair_" + "a".repeat(43)

    @Test fun acceptsCurrentServerGrant() {
        assertEquals("${origin.value}/pair#$fragment", QrLogin.parse("${origin.value}/pair#$fragment", origin))
        assertEquals("${origin.value}/pair#$fragment", QrLogin.parse("https://rethos.example.com:443/pair#$fragment", origin))
    }

    @Test fun rejectsOtherServersAndUnrelatedCodes() {
        for (value in listOf("https://other.example.com/pair#$fragment", "http://rethos.example.com/pair#$fragment", "https://user@rethos.example.com/pair#$fragment", "${origin.value}/download.apk", "${origin.value}/pair?secret=abc#$fragment", "${origin.value}/pair#$fragment&next=https://other.example.com", "${origin.value}/pair#signin=short", "${origin.value}/#$fragment", "javascript:alert(1)")) {
            assertNull(value, QrLogin.parse(value, origin))
        }
    }
}
