package cc.hopesy.rethos

import java.net.URI
import java.util.Locale

class ServerOrigin private constructor(val value: String) {
    override fun equals(other: Any?): Boolean = other is ServerOrigin && value == other.value
    override fun hashCode(): Int = value.hashCode()

    fun contains(url: String): Boolean = runCatching {
        val candidate = URI(url)
        candidate.rawUserInfo == null && fromUri(candidate)?.value == value
    }.getOrDefault(false)

    companion object {
        fun parse(input: String): ServerOrigin? = runCatching {
            val uri = URI(input.trim())
            if (uri.rawQuery != null || uri.rawFragment != null || uri.rawPath !in listOf("", "/")) null
            else fromUri(uri)
        }.getOrNull()

        private fun fromUri(uri: URI): ServerOrigin? {
            if (!uri.scheme.equals("https", true) || uri.rawUserInfo != null) return null
            val host = uri.host?.lowercase(Locale.ROOT)?.takeIf { it.isNotBlank() } ?: return null
            if (uri.port != -1 && uri.port !in 1..65535) return null
            val port = if (uri.port == -1 || uri.port == 443) "" else ":${uri.port}"
            return ServerOrigin("https://$host$port")
        }

        fun safeFileName(name: String): String = name.replace(Regex("[\\\\/\\p{Cntrl}]"), "_").trim().take(128).ifBlank { "download" }
    }
}
