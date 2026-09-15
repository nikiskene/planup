import QRCode from 'qrcode';
import type { QRConfiguration } from './types';
export function options(config: QRConfiguration) {
  return { width: 1024, margin: config.margin, errorCorrectionLevel: config.errorCorrectionLevel, color: { dark: config.foreground, light: config.background } };
}
export const generateSvg = (payload: string, config: QRConfiguration) => QRCode.toString(payload, { ...options(config), type: 'svg' });
export async function generatePng(payload: string, config: QRConfiguration): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, payload, options(config));
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
}
export function contrast(config: QRConfiguration) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  return (luminance(config.background) + 0.05) / (luminance(config.foreground) + 0.05);
}
