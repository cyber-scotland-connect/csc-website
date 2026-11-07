#!/usr/bin/env bun
/**
 * Upgrade Master Google Slides Template (16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ)
 *
 * Runs sequentially without shell chaining to eliminate permission prompts.
 */

import { execFileSync } from 'child_process';

const MASTER_TEMPLATE_ID = '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';
const AGY_ACCOUNT = 'harry.mclaren.uk@gmail.com';

function runGslides(args: string[]) {
  return execFileSync('gslides', args, {
    env: { ...process.env, AGY_ACCOUNT },
    stdio: 'inherit',
  });
}

console.log('Upgrading Master Slide Template:', MASTER_TEMPLATE_ID);

// 1. Slide 7 (p7) - Slido
console.log('1. Updating Slide 7 (Slido QR)...');
try {
  runGslides(['mutate', 'delete-element', MASTER_TEMPLATE_ID, 'p7_i11']);
} catch (e) {
  console.log('   (p7_i11 already deleted or not present)');
}
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p7',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fsli.do%2FCSC-SCOTLAND',
  '--x',
  '112',
  '--y',
  '238',
  '--width',
  '120',
  '--height',
  '120',
]);

// 2. Slide 8 (p8) - Open Mic CFP
console.log('2. Updating Slide 8 (Call for Speakers CFP QR)...');
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p8',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https%3A%2F%2Fcyberscotlandconnect.com%2Fspeak%2F',
  '--x',
  '430',
  '--y',
  '330',
  '--width',
  '90',
  '--height',
  '90',
]);

// 3. Slide 9 (p9) - BuyMeACoffee
console.log('3. Updating Slide 9 (BuyMeACoffee QR)...');
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p9',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https%3A%2F%2Fbuymeacoffee.com%2Fcyberscotlandconnect',
  '--x',
  '780',
  '--y',
  '410',
  '--width',
  '85',
  '--height',
  '85',
]);

// 4. Slide 10 (p10) - 4 Community QRs
console.log('4. Updating Slide 10 (Community QR Matrix)...');
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p10',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fwww.meetup.com%2Fcyberscotconnect%2F',
  '--x',
  '180',
  '--y',
  '370',
  '--width',
  '75',
  '--height',
  '75',
]);
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p10',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Fcyber-scotland-connect%2F',
  '--x',
  '355',
  '--y',
  '370',
  '--width',
  '75',
  '--height',
  '75',
]);
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p10',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fdiscord.gg%2Fcyberscotlandconnect',
  '--x',
  '530',
  '--y',
  '370',
  '--width',
  '75',
  '--height',
  '75',
]);
runGslides([
  'mutate',
  'add-image',
  MASTER_TEMPLATE_ID,
  '--slide',
  'p10',
  '--url',
  'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https%3A%2F%2Fcyberscotlandconnect.com',
  '--x',
  '710',
  '--y',
  '370',
  '--width',
  '75',
  '--height',
  '75',
]);

console.log('✔ Master Template successfully upgraded!');
