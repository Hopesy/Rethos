package cc.hopesy.rethos

data class TextExport(val filename: String, val bytes: ByteArray) {
    companion object {
        const val MAX_BYTES = 8 * 1024 * 1024
        fun create(filename: String, content: String, mime: String): TextExport? {
            if (mime != "text/markdown" || filename.isBlank() || content.length > MAX_BYTES) return null
            val bytes = content.toByteArray(Charsets.UTF_8)
            if (bytes.size > MAX_BYTES) return null
            val safeName = ServerOrigin.safeFileName(filename)
            return TextExport(if (safeName.endsWith(".md", ignoreCase = true)) safeName else "$safeName.md", bytes)
        }
    }
}
