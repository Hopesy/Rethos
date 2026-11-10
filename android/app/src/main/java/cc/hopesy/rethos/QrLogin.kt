package cc.hopesy.rethos

import java.net.URI

object QrLogin {
    const val ACTION_URL = "rethos://scan-login"

    fun parse(value: String, origin: ServerOrigin): String? = runCatching {
        val uri = URI(value.trim())
        if (!origin.contains(uri.toString()) || uri.rawPath != "/pair" || uri.rawQuery != null) return null
        val fragment = uri.rawFragment ?: return null
        if (!Regex("signin=omb_pair_[A-Za-z0-9_-]{43}").matches(fragment)) return null
        origin.value + "/pair#" + fragment
    }.getOrNull()
}
