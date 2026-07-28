"use strict";

const fs = require("fs");
const zlib = require("zlib");

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return result;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(file) {
  const buffer = fs.readFileSync(file);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file}: firma PNG inválida`);
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const compressed = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") compressed.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(`${file}: solo se admiten PNG RGB/RGBA de 8 bits sin entrelazado`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(compressed));
  const rows = Buffer.alloc(height * stride);
  let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[input++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[input++];
      const left = x >= channels ? rows[rowOffset + x - channels] : 0;
      const up = y > 0 ? rows[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= channels ? rows[rowOffset - stride + x - channels] : 0;
      const reconstructed = filter === 0 ? value
        : filter === 1 ? value + left
        : filter === 2 ? value + up
        : filter === 3 ? value + Math.floor((left + up) / 2)
        : filter === 4 ? value + paeth(left, up, upperLeft)
        : NaN;
      if (Number.isNaN(reconstructed)) throw new Error(`${file}: filtro PNG ${filter} no admitido`);
      rows[rowOffset + x] = reconstructed & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgba[pixel * 4] = rows[pixel * channels];
    rgba[pixel * 4 + 1] = rows[pixel * channels + 1];
    rgba[pixel * 4 + 2] = rows[pixel * channels + 2];
    rgba[pixel * 4 + 3] = channels === 4 ? rows[pixel * channels + 3] : 255;
  }
  return { width, height, data: rgba };
}

function encodePng(file, image) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc(image.height * (1 + image.width * 4));
  for (let y = 0; y < image.height; y++) {
    const target = y * (1 + image.width * 4);
    rows[target] = 0;
    image.data.copy(rows, target + 1, y * image.width * 4, (y + 1) * image.width * 4);
  }
  fs.writeFileSync(file, Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0))
  ]));
}

function averageHash(image) {
  const samples = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sourceX = Math.min(image.width - 1, Math.floor((x + 0.5) * image.width / 8));
      const sourceY = Math.min(image.height - 1, Math.floor((y + 0.5) * image.height / 8));
      const offset = (sourceY * image.width + sourceX) * 4;
      samples.push(image.data[offset] * 0.2126 + image.data[offset + 1] * 0.7152 + image.data[offset + 2] * 0.0722);
    }
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return samples.map(value => value >= average ? "1" : "0").join("");
}

function comparePng(actualFile, expectedFile, diffFile, pixelThreshold = 24) {
  const actual = decodePng(actualFile);
  const expected = decodePng(expectedFile);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    return { comparable: false, differenceRatio: 1, hashDistance: 64, reason: "dimensiones diferentes" };
  }
  const diff = Buffer.alloc(actual.data.length);
  let changed = 0;
  let totalDelta = 0;
  for (let offset = 0; offset < actual.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(actual.data[offset] - expected.data[offset]),
      Math.abs(actual.data[offset + 1] - expected.data[offset + 1]),
      Math.abs(actual.data[offset + 2] - expected.data[offset + 2])
    );
    totalDelta += delta;
    if (delta > pixelThreshold) {
      changed++;
      diff[offset] = 255;
      diff[offset + 1] = Math.max(0, 255 - delta);
      diff[offset + 2] = 0;
      diff[offset + 3] = 255;
    } else {
      const gray = Math.round(expected.data[offset] * 0.2126 + expected.data[offset + 1] * 0.7152 + expected.data[offset + 2] * 0.0722);
      diff[offset] = diff[offset + 1] = diff[offset + 2] = gray;
      diff[offset + 3] = 80;
    }
  }
  if (diffFile) encodePng(diffFile, { width: actual.width, height: actual.height, data: diff });
  const actualHash = averageHash(actual);
  const expectedHash = averageHash(expected);
  const hashDistance = [...actualHash].filter((bit, index) => bit !== expectedHash[index]).length;
  return {
    comparable: true,
    differenceRatio: changed / (actual.width * actual.height),
    meanDelta: totalDelta / (actual.width * actual.height),
    hashDistance
  };
}

module.exports = { decodePng, encodePng, averageHash, comparePng };
