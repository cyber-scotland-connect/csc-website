#!/usr/bin/env bun
/**
 * Upgrade Master Google Slides Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 *
 * Synchronizes the Master Presentation Template with brand standards:
 * - Slide 5 (p5): Updates Card 1 description to "Arrivals & Refreshments", updates footer to close & pub info.
 * - Slide 7 (p7): Permanently deletes the unused Slido Poll slide.
 * - Slide 8 (p8): Updates Open Mic hiring card to Discord #careers signpost with Plus Jakarta Sans styling.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MASTER_TEMPLATE_ID = '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';
const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

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

console.log('Upgrading Master Slide Template:', MASTER_TEMPLATE_ID);

const ops: any[] = [];

// 1. Slide 5 (p5)
updateAndStyle(ops, 'p5_i29', 'Arrivals & Refreshments', 8.5, '#56548C', false, 'START');
updateAndStyle(ops, 'p5_i20', 'Talks conclude at 20:15 with Q&A • Event closes at 20:30 for community social at the pub.', 9.5, '#56548C', false, 'CENTER');

// 2. Slide 8 (p8 - Slide 10 in 12-slide template)
updateAndStyle(ops, 'p8_i19', 'Post open roles or browse active listings in our community Discord:', 10.5, '#382B5C', false, 'START');
updateAndStyle(ops, 'p8_i23', '• Post roles in Discord #careers', 9.75, '#21203A', true, 'START');
updateAndStyle(ops, 'p8_i24', '• Take 30s at the mic to shout out your role', 9.75, '#21203A', true, 'START');

const tmpFile = path.resolve(process.cwd(), 'dist/slides/master-upgrade-batch.json');
fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
fs.writeFileSync(tmpFile, JSON.stringify(ops, null, 2));

console.log('Applying batch updates to Master Template...');
runGslides(['mutate', 'batch', MASTER_TEMPLATE_ID, '--file', tmpFile]);
console.log('✔ Master Template batch applied successfully.');

// Permanently delete Slide p7 if present
try {
  runGslides(['mutate', 'delete-slide', MASTER_TEMPLATE_ID, 'p7']);
  console.log('✔ Slide p7 deleted.');
} catch {
  // Already deleted
}

console.log('\n✔ Master Template successfully upgraded and aligned!');
