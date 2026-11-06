// Technical checks cannot identify the speaker or confirm distribution rights.
export const MIN_AUDIO_BYTES = 256;
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 15;

export function validateMp3Structure(bytes) {
  if (bytes.length < MIN_AUDIO_BYTES)
    throw new Error("Tệp rỗng hoặc quá nhỏ (tối thiểu 256 byte).");
  if (bytes.length > MAX_AUDIO_BYTES)
    throw new Error("Tệp vượt giới hạn 2 MiB cho một số đếm.");
  let offset = 0;
  if (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) {
    if (
      bytes[3] < 2 ||
      bytes[3] > 4 ||
      [...bytes.slice(6, 10)].some((n) => n > 127)
    )
      throw new Error("ID3 tag không hợp lệ.");
    offset =
      10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
    if (bytes[3] === 4 && bytes[5] & 16) offset += 10;
  }
  let frames = 0,
    expectedRate;
  const mpeg1 = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
  ];
  const mpeg2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  while (offset < bytes.length) {
    const remaining = bytes.length - offset;
    if (
      remaining === 128 &&
      bytes[offset] === 84 &&
      bytes[offset + 1] === 65 &&
      bytes[offset + 2] === 71
    ) {
      offset += 128;
      break;
    }
    if (remaining <= 2048 && bytes.slice(offset).every((n) => n === 0)) {
      offset = bytes.length;
      break;
    }
    const a = bytes[offset],
      b = bytes[offset + 1],
      c = bytes[offset + 2];
    const version = (b >> 3) & 3,
      layer = (b >> 1) & 3,
      bitrateIndex = c >> 4,
      rateIndex = (c >> 2) & 3;
    if (
      remaining < 4 ||
      a !== 255 ||
      (b & 224) !== 224 ||
      version === 1 ||
      layer !== 1 ||
      !bitrateIndex ||
      bitrateIndex === 15 ||
      rateIndex === 3
    )
      throw new Error("Không phải chuỗi frame MP3 Layer III hoàn chỉnh.");
    const rate =
      [44100, 48000, 32000][rateIndex] /
      (version === 3 ? 1 : version === 2 ? 2 : 4);
    if (expectedRate && expectedRate !== rate)
      throw new Error("Sample rate thay đổi giữa các frame.");
    expectedRate = rate;
    const length =
      Math.floor(
        ((version === 3 ? 144000 : 72000) *
          (version === 3 ? mpeg1 : mpeg2)[bitrateIndex]) /
          rate,
      ) +
      ((c >> 1) & 1);
    if (offset + length > bytes.length)
      throw new Error("MP3 bị cắt giữa frame.");
    offset += length;
    frames++;
    if ((frames * (version === 3 ? 1152 : 576)) / rate > MAX_AUDIO_SECONDS + 1)
      throw new Error("Tệp quá dài cho một số đếm.");
  }
  if (frames < 2 || offset !== bytes.length)
    throw new Error("Không có đủ frame âm thanh MP3.");
  return { frames, sampleRate: expectedRate };
}

export function validateDecodedAudio(channels, sampleRate, errors = []) {
  if (
    errors.length ||
    !channels.length ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  )
    throw new Error("Không giải mã được MP3 hoàn chỉnh.");
  const samples = channels[0].length;
  const duration = samples / sampleRate;
  if (duration < 0.1 || duration > MAX_AUDIO_SECONDS)
    throw new Error("Thời lượng phải từ 0,1 đến 15 giây.");
  let energy = 0,
    peak = 0,
    total = 0;
  for (const channel of channels)
    for (const sample of channel) {
      if (!Number.isFinite(sample))
        throw new Error("Dữ liệu âm thanh không hợp lệ.");
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
      total++;
    }
  const rms = Math.sqrt(energy / total);
  if (peak < 0.0001 || rms < 0.00001)
    throw new Error("Tệp chỉ chứa im lặng hoặc âm lượng quá thấp.");
  return {
    duration: Number(duration.toFixed(4)),
    sampleRate,
    channels: channels.length,
    peak: Number(peak.toFixed(5)),
    rms: Number(rms.toFixed(5)),
  };
}
