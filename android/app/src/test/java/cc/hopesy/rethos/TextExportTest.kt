package cc.hopesy.rethos

import org.junit.Assert.*
import org.junit.Test

class TextExportTest {
    @Test fun preservesChineseMarkdownAndSanitizesFilename() {
        val text = "# 对话\n\n你好，世界 🌍"
        val export = requireNotNull(TextExport.create("../聊天记录", text, "text/markdown"))
        assertFalse(export.filename.contains('/'))
        assertTrue(export.filename.endsWith(".md"))
        assertEquals(text, export.bytes.toString(Charsets.UTF_8))
    }
    @Test fun rejectsOtherFormatsAndOversizedUtf8() {
        assertNull(TextExport.create("page.html", "<script></script>", "text/html"))
        assertNull(TextExport.create("", "text", "text/markdown"))
        assertNull(TextExport.create("chat.md", "中".repeat(TextExport.MAX_BYTES / 3 + 1), "text/markdown"))
    }
}
