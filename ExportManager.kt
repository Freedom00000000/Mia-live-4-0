package com.example.signalvoid

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

object ExportManager {
    enum class Format { TXT, MD }

    fun exportAll(context: Context, sessions: List<Session>, format: Format): File {
        val sdf = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault())
        val name = "signal_void_export_${sdf.format(Date())}"

        val file = File(
            context.getExternalFilesDir(null),
            when (format) {
                Format.TXT -> "$name.txt"
                Format.MD -> "$name.md"
            }
        )

        val content = when (format) {
            Format.TXT -> buildTxt(sessions)
            Format.MD -> buildMarkdown(sessions)
        }

        file.writeText(content)
        return file
    }

    private fun buildTxt(sessions: List<Session>): String =
        buildString {
            append("SIGNAL // VOID — Export\n\n")
            sessions.forEach {
                append("-----\n")
                append("Tid: ${Date(it.tsMillis)}\n")
                append("Mode: ${it.mode}\n\n")
                append("[TALE]\n${it.speechText}\n\n")
                append("[FREKVENS]\n${it.frequencyText}\n\n")
                append("[META]\n${it.metaText}\n\n")
                append("[FUSION]\n${it.fusionText}\n\n")
            }
        }

    private fun buildMarkdown(sessions: List<Session>): String =
        buildString {
            append("# SIGNAL // VOID — Export\n\n")
            sessions.forEach {
                append("## ${Date(it.tsMillis)}\n")
                append("**Mode:** ${it.mode}\n\n")
                append("### TALE\n${it.speechText}\n\n")
                append("### FREKVENS\n${it.frequencyText}\n\n")
                append("### META\n${it.metaText}\n\n")
                append("### FUSION\n${it.fusionText}\n\n---\n\n")
            }
        }
}
