/** Transcripción de audio vía OpenAI Whisper (requiere OPENAI_API_KEY en edge). */
export async function transcribeAudioWav(
  audioBytes: ArrayBuffer,
  filename = 'audio.wav',
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY no configurada' };
  }

  const form = new FormData();
  form.append('file', new Blob([audioBytes], { type: 'audio/wav' }), filename);
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('response_format', 'json');

  try {
    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const text = await resp.text();
    if (!resp.ok) {
      return { ok: false, error: `Whisper HTTP ${resp.status}: ${text.slice(0, 200)}` };
    }
    let parsed: { text?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'Whisper respondió sin JSON válido' };
    }
    const transcript = (parsed.text ?? '').trim();
    if (!transcript) return { ok: false, error: 'Transcripción vacía' };
    return { ok: true, text: transcript };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error transcribiendo' };
  }
}
