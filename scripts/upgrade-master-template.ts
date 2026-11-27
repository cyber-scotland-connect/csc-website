#!/usr/bin/env bun
/**
 * Upgrade Master Google Slides Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 *
 * Synchronizes the Master Presentation Template with brand standards:
 * - Slide 4 (p4): Recording & Livestream notice.
 * - Slide 5 (p5): Updates Card 1 description to "Arrivals & Refreshments", updates footer to close & pub info.
 * - Slide 7 (p7): Permanently deletes the unused Slido Poll slide.
 * - Slide 10 (p8): Expands 3-card Open Mic layout and integrates custom-styled Discord QR badge in Card 1.
 * - Slide 11 (p9): Integrates full-width Pay-It-Forward Spotlight Banner with custom-styled Support QR badge.
 * - Slide 12 (p10): Updates Discord social card URL to cyberscotlandconnect.com/discord.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MASTER_TEMPLATE_ID = '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';
const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';
const BASE_DIM_PT = 3000000 / 12700; // 236.22047244 pt

function runGslides(args: string[]): string {
  return execFileSync('gslides', args, {
    env: { ...process.env, AGY_ACCOUNT },
    encoding: 'utf-8',
  });
}

function updateAndStyle(ops: any[], element: string, text: string, fontSize?: number, color?: string, bold?: boolean, alignment?: string) {
  ops.push({ op: 'update-text', element, text });
  const styleOp: any = {
    op: 'style-text',
    element,
    font_family: 'Plus Jakarta Sans',
  };
  if (fontSize) styleOp.font_size = fontSize;
  if (color) styleOp.color = color;
  if (bold !== undefined) styleOp.bold = bold;
  ops.push(styleOp);
  if (alignment) {
    ops.push({ op: 'style-paragraph', element, alignment });
  }
}

function resizeBox(ops: any[], element: string, x: number, y: number, wPt: number, hPt: number) {
  ops.push({
    op: 'resize-element',
    element,
    x,
    y,
    width: Number((wPt / BASE_DIM_PT).toFixed(6)),
    height: Number((hPt / BASE_DIM_PT).toFixed(6)),
  });
}

function moveIcon(ops: any[], element: string, x: number, y: number, scaleX: number, scaleY: number) {
  ops.push({
    op: 'resize-element',
    element,
    x,
    y,
    width: scaleX,
    height: scaleY,
  });
}

console.log('Upgrading Master Slide Template:', MASTER_TEMPLATE_ID);

// 0. Clean up any previously inserted SLIDES_API* QR images on p8, p9, p10, or master p11 for idempotency
for (const slideIdx of ['9', '10', '11']) {
  try {
    const out = runGslides(['readonly', 'list-elements', MASTER_TEMPLATE_ID, slideIdx]);
    for (const line of out.split('\n')) {
      const match = line.trim().match(/^(SLIDES_API\S+)\s+image\b/);
      if (match) {
        console.log(`Removing old QR image element ${match[1]} on slide index ${slideIdx}...`);
        runGslides(['mutate', 'delete-element', MASTER_TEMPLATE_ID, match[1]]);
      }
    }
  } catch {
    // Ignore if slide index not present
  }
}

const ops: any[] = [];

// 1. Slide 4 (p4) - Recording & Livestream notice
updateAndStyle(ops, 'p4_i28', 'Recording & Livestream', 11.25, '#21203A', true, 'START');
updateAndStyle(ops, 'p4_i29', 'Sessions are recorded and livestreamed, with cameras focused on the speaker and front of the room only.', 9.5, '#56548C', false, 'START');

// 2. Slide 5 (p5)
updateAndStyle(ops, 'p5_i29', 'Arrivals & Refreshments', 8.5, '#56548C', false, 'START');
updateAndStyle(ops, 'p5_i20', 'Talks conclude at 20:15 with Q&A • Event closes at 20:30 for community social at the pub.', 9.5, '#56548C', false, 'CENTER');

// 3. Slide 10 (p8 - Open Mic: Announcements, Jobs & Opportunities)
// Expand all 3 cards symmetrically (y=222, h=232) so Card 1 houses a dedicated Discord QR zone
resizeBox(ops, 'p8_i3', 48.0, 222.0, 275.5, 232.0);
resizeBox(ops, 'p8_i4', 341.5, 222.0, 277.0, 232.0);
resizeBox(ops, 'p8_i5', 636.5, 222.0, 275.5, 232.0);

moveIcon(ops, 'p8_i7', 65.3, 242.0, 381, 381);
moveIcon(ops, 'p8_i8', 359.5, 242.5, 357.1875, 381);
moveIcon(ops, 'p8_i9', 653.7, 242.0, 381, 381);

resizeBox(ops, 'p8_i22', 87.8, 240.5, 160.0, 18.0);
resizeBox(ops, 'p8_i25', 378.2, 241.0, 170.0, 18.0);
resizeBox(ops, 'p8_i28', 674.7, 240.5, 180.0, 18.0);

resizeBox(ops, 'p8_i19', 65.3, 266.0, 242.0, 28.0);
updateAndStyle(ops, 'p8_i19', 'Post open roles or browse active listings in our community Discord:', 9.5, '#382B5C', false, 'START');
resizeBox(ops, 'p8_i20', 359.5, 266.0, 242.0, 28.0);
resizeBox(ops, 'p8_i21', 653.7, 266.0, 242.0, 28.0);

resizeBox(ops, 'p8_i23', 65.3, 300.0, 242.0, 14.0);
updateAndStyle(ops, 'p8_i23', '• Post roles in Discord #careers', 9.5, '#21203A', true, 'START');
resizeBox(ops, 'p8_i24', 65.3, 317.0, 242.0, 14.0);
updateAndStyle(ops, 'p8_i24', '• Take 30s at the mic to shout out your role', 9.5, '#21203A', true, 'START');

resizeBox(ops, 'p8_i26', 359.5, 304.0, 242.0, 14.0);
resizeBox(ops, 'p8_i27', 359.5, 323.0, 242.0, 14.0);
resizeBox(ops, 'p8_i29', 653.7, 304.0, 242.0, 14.0);
resizeBox(ops, 'p8_i30', 653.7, 323.0, 242.0, 14.0);

// Card 1 bottom-left action label paired with bottom-right QR badge
resizeBox(ops, 'p8_i16', 62.0, 376.0, 162.0, 44.0);
updateAndStyle(ops, 'p8_i16', 'Scan to join Discord:\ncyberscotlandconnect.com/discord', 8.25, '#895294', true, 'START');

// Card 2 & Card 3 aligned bottom footers
resizeBox(ops, 'p8_i17', 359.5, 420.0, 242.0, 14.0);
updateAndStyle(ops, 'p8_i17', 'CFP always open: cyberscotlandconnect.com/speak', 9.0, '#56548C', true, 'START');
resizeBox(ops, 'p8_i18', 653.7, 420.0, 242.0, 14.0);
updateAndStyle(ops, 'p8_i18', 'Live calendar: cyberscotlandconnect.com/calendar', 9.0, '#21203A', true, 'START');

// 4. Slide 11 (p9 - Community Heroes & Pay It Forward Spotlight Banner)
resizeBox(ops, 'p9_i4', 48.0, 216.0, 204.4, 126.0);
resizeBox(ops, 'p9_i5', 267.4, 216.0, 205.9, 126.0);
resizeBox(ops, 'p9_i6', 488.3, 216.0, 204.4, 126.0);
resizeBox(ops, 'p9_i7', 707.6, 216.0, 204.4, 126.0);

moveIcon(ops, 'p9_i9', 142.7, 232.0, 362.857143, 381);
moveIcon(ops, 'p9_i10', 357.9, 232.0, 369.794118, 381);
moveIcon(ops, 'p9_i11', 580.7, 232.0, 366.888889, 381);
moveIcon(ops, 'p9_i12', 800.1, 232.0, 366.888889, 381);

resizeBox(ops, 'p9_i20', 48.0, 261.0, 204.4, 16.5);
resizeBox(ops, 'p9_i22', 267.4, 261.0, 205.9, 16.5);
resizeBox(ops, 'p9_i24', 488.3, 261.0, 204.4, 16.5);
resizeBox(ops, 'p9_i26', 707.6, 261.0, 204.4, 16.5);

resizeBox(ops, 'p9_i21', 56.0, 281.0, 188.4, 44.0);
resizeBox(ops, 'p9_i23', 275.4, 281.0, 189.9, 44.0);
resizeBox(ops, 'p9_i25', 496.3, 281.0, 188.4, 44.0);
resizeBox(ops, 'p9_i27', 715.6, 281.0, 188.4, 44.0);

// Full-width Pay-It-Forward Spotlight Banner (p9_i2)
resizeBox(ops, 'p9_i2', 48.0, 368.0, 864.0, 120.0);
resizeBox(ops, 'p9_i17', 74.0, 392.0, 680.0, 20.0);
updateAndStyle(ops, 'p9_i17', 'Pay It Forward — Support the Community at cyberscotlandconnect.com/support', 13.0, '#21203A', true, 'START');
resizeBox(ops, 'p9_i18', 74.0, 418.0, 680.0, 46.0);
updateAndStyle(
  ops,
  'p9_i18',
  "Established in your career? Scan the QR code to buy the community a coffee and keep tickets 100% free for students and job seekers — and let's give tonight's speakers, venue staff, and volunteers a huge round of applause!",
  10.0,
  '#56548C',
  false,
  'START'
);

// 5. Slide 12 (p10 - Closing & Socials)
updateAndStyle(ops, 'p10_i25', 'cyberscotlandconnect.com/discord', 8.5, '#BDACCF', false, 'CENTER');

const slidesDir = path.resolve(process.cwd(), 'dist/slides');
fs.mkdirSync(slidesDir, { recursive: true });
const tmpFile = path.join(slidesDir, 'master-upgrade-batch.json');
fs.writeFileSync(tmpFile, JSON.stringify(ops, null, 2));

console.log('Applying batch updates to Master Template...');
runGslides(['mutate', 'batch', MASTER_TEMPLATE_ID, '--file', tmpFile]);
console.log('✔ Master Template batch applied successfully.');

// Generate and verify custom brand-styled QR badge PNGs
console.log('Generating custom brand-styled QR badges...');
execFileSync('osascript', ['-l', 'JavaScript', path.resolve(process.cwd(), 'scripts/generate-qr-badges.js'), slidesDir], {
  encoding: 'utf-8',
});

// Insert styled Discord QR badge onto Slide 10 (p8, Card 1 bottom-right zone)
console.log('Inserting custom Discord QR badge onto Slide 10 (p8)...');
runGslides([
  'mutate',
  'insert-image-from-file',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p8',
  '--file',
  path.join(slidesDir, 'qr-discord.png'),
  '--x',
  '221.5',
  '--y',
  '352',
  '--width',
  '86',
  '--height',
  '86',
]);

// Insert styled Pay-It-Forward QR badge onto Slide 11 (p9, Spotlight Banner right zone)
console.log('Inserting custom Pay-It-Forward QR badge onto Slide 11 (p9)...');
runGslides([
  'mutate',
  'insert-image-from-file',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p9',
  '--file',
  path.join(slidesDir, 'qr-support.png'),
  '--x',
  '792',
  '--y',
  '380',
  '--width',
  '96',
  '--height',
  '96',
]);

// Permanently delete Slide p7 if present
try {
  runGslides(['mutate', 'delete-slide', MASTER_TEMPLATE_ID, 'p7']);
  console.log('✔ Slide p7 deleted.');
} catch {
  // Already deleted
}

console.log('\n✔ Master Template successfully upgraded and aligned!');
