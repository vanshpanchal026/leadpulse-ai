import fs from 'fs';
import path from 'path';

function runSvgSafetyTest() {
  console.log('Running SVG and CSS Safety Regression Test...');

  const leadCardPath = path.resolve('components/LeadCard.tsx');
  const leadCardContent = fs.readFileSync(leadCardPath, 'utf8');

  const pagePath = path.resolve('app/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Check 1: LeadCard InstagramIcon and WhatsAppIcon must define explicit width/height
  if (!leadCardContent.includes('width="14"') || !leadCardContent.includes('height="14"')) {
    throw new Error('LeadCard.tsx SVG icons do not specify explicit width/height fallback attributes!');
  }

  // Check 2: LeadCard InstagramIcon and WhatsAppIcon must define style maxWidth/maxHeight constraint
  if (!leadCardContent.includes("maxWidth: '14px'")) {
    throw new Error('LeadCard.tsx SVG icons do not enforce inline maxWidth constraint!');
  }

  // Check 3: app/page.tsx InstagramIcon and WhatsAppIcon must define explicit width/height
  if (!pageContent.includes('width="16"') || !pageContent.includes('height="16"')) {
    throw new Error('app/page.tsx SVG icons do not specify explicit width/height fallback attributes!');
  }

  // Check 4: app/page.tsx InstagramIcon and WhatsAppIcon must define style maxWidth/maxHeight constraint
  if (!pageContent.includes("maxWidth: '16px'")) {
    throw new Error('app/page.tsx SVG icons do not enforce inline maxWidth constraint!');
  }

  // Check 5: app/globals.css must exist and contain @import "tailwindcss"
  const cssPath = path.resolve('app/globals.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  if (!cssContent.includes('@import "tailwindcss"') && !cssContent.includes('@tailwind')) {
    throw new Error('app/globals.css is missing tailwindcss import directive!');
  }

  console.log('✅ SVG and CSS Safety Regression Test PASSED!');
}

runSvgSafetyTest();
