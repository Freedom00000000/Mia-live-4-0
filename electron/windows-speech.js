const { spawn } = require("node:child_process");

// Text travels through stdin, never through executable PowerShell code.
const COMMAND = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled })
  $voice = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq 'da-DK' -and $_.VoiceInfo.Gender -eq 'Female' } | Select-Object -First 1
  if (-not $voice) { $voice = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq 'da-DK' } | Select-Object -First 1 }
  if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
  $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd()))
  $synth.SetOutputToDefaultAudioDevice()
  $synth.Speak($text)
} finally { $synth.Dispose() }
`;

function createWindowsSpeech(launch = spawn, platform = process.platform) {
  let active = null;
  function stop() {
    const previous = active;
    active = null;
    if (previous) { previous.finish(false); previous.child.kill(); }
  }
  function speak(text) {
    stop();
    if (platform !== "win32" || !text.trim()) return Promise.resolve(false);
    return new Promise(resolve => {
      let child;
      try {
        child = launch("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(COMMAND, "utf16le").toString("base64")], { windowsHide: true, stdio: ["pipe", "ignore", "ignore"] });
      } catch (_) { resolve(false); return; }
      let done = false;
      const job = { child, finish(ok) {
        if (done) return;
        done = true;
        if (active === job) active = null;
        resolve(ok);
      } };
      active = job;
      child.on("error", () => job.finish(false));
      child.on("close", code => job.finish(code === 0));
      child.stdin.on("error", () => job.finish(false));
      child.stdin.end(Buffer.from(text, "utf8").toString("base64"));
    });
  }
  return { speak, stop };
}
module.exports = { createWindowsSpeech };
