const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'assets', 'sounds');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function writeWav(filename, samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    // Clamp sample between -1 and 1
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.floor(intVal), 44 + i * 2);
  }

  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filename} (${(dataSize / 1024).toFixed(1)} KB)`);
}

const sampleRate = 44100;

// 1. Sirena de Cuartel (Wail clásico de bomberos)
{
  const duration = 4.0;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(totalSamples);
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Modulación sinusoidal de tono entre 650 Hz y 1150 Hz con ciclo de 1.8 segundos
    const mod = Math.sin(2 * Math.PI * (t / 1.8) - Math.PI / 2) * 0.5 + 0.5;
    const freq = 650 + mod * 500;
    phase += (2 * Math.PI * freq) / sampleRate;

    // Onda rica: fundamental + armónicos
    const val = 0.7 * Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
    // Envelope para inicio y final suaves
    const env = Math.min(1, t / 0.15) * Math.min(1, (duration - t) / 0.2);
    samples[i] = val * env * 0.9;
  }
  writeWav('sirena_cuartel.wav', samples, sampleRate);
}

// 2. Alarma Táctica / Evacuación (Hi-Lo pulsante rápido de advertencia)
{
  const duration = 3.2;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(totalSamples);
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Alterna cada 0.2 segundos entre 880 Hz y 1260 Hz
    const step = Math.floor(t / 0.2) % 2;
    const freq = step === 0 ? 880 : 1260;
    phase += (2 * Math.PI * freq) / sampleRate;

    const val = 0.75 * Math.sin(phase) + 0.25 * Math.sin(3 * phase);
    const subTime = t % 0.2;
    const env = Math.min(1, subTime / 0.02) * Math.min(1, (0.2 - subTime) / 0.02);
    samples[i] = val * env * 0.85;
  }
  writeWav('alarma_tactica.wav', samples, sampleRate);
}

// 3. Corneta de Emergencia (Doble bocinazo neumático pesado de autobomba)
{
  const duration = 3.0;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(totalSamples);
  let phase1 = 0, phase2 = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Dos toques de bocina: de 0s a 1.2s y de 1.5s a 2.7s
    const isBlast1 = t >= 0.05 && t <= 1.25;
    const isBlast2 = t >= 1.55 && t <= 2.75;
    const active = isBlast1 || isBlast2;

    if (active) {
      // Acorde bitonal de bocina de tren / camión de bomberos (Frecuencias 370 Hz y 465 Hz)
      phase1 += (2 * Math.PI * 370) / sampleRate;
      phase2 += (2 * Math.PI * 465) / sampleRate;

      const blastT = isBlast1 ? t - 0.05 : t - 1.55;
      const blastDur = 1.2;
      const env = Math.min(1, blastT / 0.05) * Math.min(1, (blastDur - blastT) / 0.08);

      const val = 0.5 * Math.sin(phase1) + 0.3 * Math.sin(phase2) + 0.15 * Math.sin(2 * phase1) + 0.05 * Math.sin(2 * phase2);
      samples[i] = val * env * 0.95;
    } else {
      samples[i] = 0;
    }
  }
  writeWav('corneta_emergencia.wav', samples, sampleRate);
}
