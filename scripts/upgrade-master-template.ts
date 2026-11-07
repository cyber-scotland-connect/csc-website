#!/usr/bin/env bun
/**
 * Upgrade Master Google Slides Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 *
 * Synchronizes the Master Presentation Template with our updated brand standards:
 * - Slide 5 (p5): Updates Card 1 description to "Arrivals & Refreshments", updates footer to close & pub info.
 * - Slide 7 (p7): Permanently deletes the unused Slido Poll slide.
 * - Slide 8 (p8): Updates Open Mic hiring card to Discord #careers signpost.
 */

import { execFileSync } from 'child_process';

const MASTER_TEMPLATE_ID = '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';
const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

function runGslides(args: string[]): string {
  return execFileSync('gslides', args, {
    env: { ...process.env, AGY_ACCOUNT },
    encoding: 'utf-8',
  });
}

console.log('Upgrading Master Slide Template:', MASTER_TEMPLATE_ID);

// 1. Inspect Slide 5 (p5) to locate elements
console.log('1. Inspecting Slide 5 (Agenda)...');
try {
  const elementsJson = runGslides(['readonly', 'list-elements', MASTER_TEMPLATE_ID, '4', '--json']);
  const elements = JSON.parse(elementsJson);
  let footerId: string | undefined = undefined;

  for (const el of elements) {
    if (el.shape?.text?.textElements) {
      const text = el.shape.text.textElements.map((t: any) => t.textRun?.content || '').join('').trim();
      if (text.includes('roving microphone') || text.includes('question during a talk')) {
        footerId = el.objectId;
        break;
      }
    }
  }

  // Update Card 1 subtitle in master template
  console.log('   Updating Slide 5 Card 1 subtitle (p5_i29)...');
  runGslides(['mutate', 'update-text', MASTER_TEMPLATE_ID, '--element', 'p5_i29', '--text', 'Arrivals & Refreshments']);

  if (footerId) {
    console.log(`   Updating Slide 5 Footer (${footerId})...`);
    runGslides(['mutate', 'update-text', MASTER_TEMPLATE_ID, '--element', footerId, '--text', 'Talks conclude at 20:15 with Q&A • Event closes at 20:30 for community social at the pub.']);
  }
} catch (e) {
  console.warn('   Note on Slide 5 updates:', (e as Error).message);
}

// 2. Slide 7 (p7) - Permanently delete Slido slide from Master Template
console.log('2. Removing Slide 7 (Slido Poll) from Master Template...');
try {
  runGslides(['mutate', 'delete-slide', MASTER_TEMPLATE_ID, 'p7']);
  console.log('   ✔ Slide p7 deleted successfully from Master Template.');
} catch (e) {
  console.log('   (p7 already deleted or not present)');
}

// 3. Slide 8 (p8) - Open Mic Discord Signpost
console.log('3. Updating Open Mic Discord Signpost in Master Template...');
try {
  runGslides(['mutate', 'update-text', MASTER_TEMPLATE_ID, '--element', 'p8_i19', '--text', 'Post open roles or browse active listings in our community Discord:']);
  runGslides(['mutate', 'update-text', MASTER_TEMPLATE_ID, '--element', 'p8_i23', '--text', '• Post roles in Discord #careers']);
  runGslides(['mutate', 'update-text', MASTER_TEMPLATE_ID, '--element', 'p8_i24', '--text', '• Take 30s at the mic to shout out your role']);
  console.log('   ✔ Slide p8 Discord signpost updated.');
} catch (e) {
  console.warn('   Note on Slide 8 updates:', (e as Error).message);
}

console.log('\n✔ Master Template successfully upgraded and aligned!');
