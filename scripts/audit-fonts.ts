import { execFileSync } from 'child_process';

const targetId = process.argv[2] || '16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ';

const slidesRaw = execFileSync('gslides', ['readonly', 'list-slides', targetId, '--json'], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
const slides = JSON.parse(slidesRaw);

console.log(`Auditing ${slides.length} slides for font consistency in presentation ${targetId}...\n`);

interface FontIssue {
  slideId: string;
  slideIndex: number;
  objectId: string;
  text: string;
  fontFamily: string;
}

const issues: FontIssue[] = [];
const fontCounts: Record<string, number> = {};

for (let i = 0; i < slides.length; i++) {
  const slide = slides[i];
  const slideId = slide.objectId;
  const pageRaw = execFileSync('gslides', ['readonly', 'get-page', targetId, slideId, '--json'], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const page = JSON.parse(pageRaw);

  const elements = page.pageElements || [];
  for (const el of elements) {
    if (el.shape && el.shape.text && el.shape.text.textElements) {
      for (const te of el.shape.text.textElements) {
        if (te.textRun && te.textRun.content) {
          const content = te.textRun.content.trim();
          if (!content) continue;
          const font = te.textRun.style?.fontFamily || 'INHERIT/UNSET';
          fontCounts[font] = (fontCounts[font] || 0) + 1;
          if (font !== 'Plus Jakarta Sans') {
            issues.push({
              slideId,
              slideIndex: i + 1,
              objectId: el.objectId,
              text: content.replace(/\n/g, ' '),
              fontFamily: font,
            });
          }
        }
      }
    }
  }
}

console.log('Font distribution across all text runs:');
console.table(fontCounts);

console.log(`\nFound ${issues.length} text runs not using "Plus Jakarta Sans":\n`);
for (const issue of issues) {
  console.log(`Slide ${issue.slideIndex} (${issue.slideId}) | Element ${issue.objectId} | Font: [${issue.fontFamily}]`);
  console.log(`  "${issue.text.slice(0, 80)}${issue.text.length > 80 ? '...' : ''}"\n`);
}
