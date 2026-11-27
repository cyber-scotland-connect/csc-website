ObjC.import('Cocoa');
ObjC.import('CoreImage');
ObjC.import('QuartzCore');

function hexToColor(hex, alpha = 1.0) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255.0;
  const g = parseInt(clean.substring(2, 4), 16) / 255.0;
  const b = parseInt(clean.substring(4, 6), 16) / 255.0;
  return $.NSColor.colorWithSRGBRedGreenBlueAlpha(r, g, b, alpha);
}

function generateStyledQR(url, outPath, outerBgHex, borderHex, moduleHex, ringHex, coreHex) {
  const filter = $.CIFilter.filterWithName('CIQRCodeGenerator');
  const data = $.NSString.alloc.initWithUTF8String(url).dataUsingEncoding($.NSUTF8StringEncoding);
  filter.setValueForKey(data, 'inputMessage');
  filter.setValueForKey($('M'), 'inputCorrectionLevel');
  const ciImage = filter.outputImage;
  const extent = ciImage.extent;
  const cols = Math.round(extent.size.width);
  const rows = Math.round(extent.size.height);

  const falseColor = $.CIFilter.filterWithName('CIFalseColor');
  falseColor.setValueForKey(ciImage, 'inputImage');
  falseColor.setValueForKey($.CIColor.colorWithRedGreenBlue(0, 0, 0), 'inputColor0');
  falseColor.setValueForKey($.CIColor.colorWithRedGreenBlue(1, 1, 1), 'inputColor1');
  const coloredCI = falseColor.outputImage;

  const ciRep = $.NSCIImageRep.imageRepWithCIImage(coloredCI);
  const rawImg = $.NSImage.alloc.initWithSize($.NSMakeSize(cols, rows));
  rawImg.lockFocus;
  $.NSGraphicsContext.currentContext.imageInterpolation = $.NSImageInterpolationNone;
  hexToColor('#FFFFFF').setFill;
  $.NSBezierPath.fillRect($.NSMakeRect(0, 0, cols, rows));
  ciRep.drawInRect($.NSMakeRect(0, 0, cols, rows));
  rawImg.unlockFocus;
  const rawTiff = rawImg.TIFFRepresentation;
  const rep = $.NSBitmapImageRep.imageRepWithData(rawTiff);

  let minR = rows, maxR = 0, minC = cols, maxC = 0;
  const rawGrid = [];
  for (let r = 0; r < rows; r++) {
    const rowArr = [];
    for (let c = 0; c < cols; c++) {
      const color = rep.colorAtXY(c, r);
      const isDark = color.redComponent < 0.5;
      rowArr.push(isDark);
      if (isDark) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
    rawGrid.push(rowArr);
  }

  const N = maxC - minC + 1;
  const matrix = [];
  for (let r = minR; r <= maxR; r++) {
    const rowArr = [];
    for (let c = minC; c <= maxC; c++) {
      rowArr.push(rawGrid[r][c]);
    }
    matrix.push(rowArr);
  }

  const SIZE = 1024;
  const img = $.NSImage.alloc.initWithSize($.NSMakeSize(SIZE, SIZE));
  img.lockFocus;

  // Seamless outer fill matching parent slide card surface
  hexToColor(outerBgHex).setFill;
  $.NSBezierPath.fillRect($.NSMakeRect(0, 0, SIZE, SIZE));

  // Rounded inner badge tile with soft lavender border
  const cardInset = 24;
  const cardSize = SIZE - cardInset * 2;
  const cardRadius = 116;
  const cardRect = $.NSMakeRect(cardInset, cardInset, cardSize, cardSize);
  const cardPath = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(cardRect, cardRadius, cardRadius);
  hexToColor('#FFFFFF').setFill;
  cardPath.fill;

  hexToColor(borderHex).setStroke;
  cardPath.setLineWidth(10);
  cardPath.stroke;

  const padding = 112;
  const qrArea = SIZE - padding * 2;
  const cell = qrArea / N;

  function isFinderZone(r, c) {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= N - 7) return true;
    if (r >= N - 7 && c < 7) return true;
    return false;
  }

  // Rounded dot modules
  hexToColor(moduleHex).setFill;
  const dotScale = 0.86;
  const dotSize = cell * dotScale;
  const dotOffset = (cell - dotSize) / 2;
  const dotRadius = dotSize * 0.36;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!matrix[r][c] || isFinderZone(r, c)) continue;
      const x = padding + c * cell + dotOffset;
      const y = SIZE - (padding + (r + 1) * cell) + dotOffset;
      const p = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(
        $.NSMakeRect(x, y, dotSize, dotSize),
        dotRadius,
        dotRadius
      );
      p.fill;
    }
  }

  // Smooth rounded squircle finder patterns
  function drawFinder(topRow, leftCol) {
    const fx = padding + leftCol * cell;
    const fy = SIZE - (padding + (topRow + 7) * cell);
    const fw = 7 * cell;

    const outerPath = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(
      $.NSMakeRect(fx, fy, fw, fw),
      cell * 1.85,
      cell * 1.85
    );
    hexToColor(ringHex).setFill;
    outerPath.fill;

    const midPath = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(
      $.NSMakeRect(fx + cell, fy + cell, 5 * cell, 5 * cell),
      cell * 1.25,
      cell * 1.25
    );
    hexToColor('#FFFFFF').setFill;
    midPath.fill;

    const innerPath = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(
      $.NSMakeRect(fx + 2 * cell, fy + 2 * cell, 3 * cell, 3 * cell),
      cell * 0.85,
      cell * 0.85
    );
    hexToColor(coreHex).setFill;
    innerPath.fill;
  }

  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  img.unlockFocus;

  const tiff = img.TIFFRepresentation;
  const outRep = $.NSBitmapImageRep.imageRepWithData(tiff);
  const pngData = outRep.representationUsingTypeProperties($.NSPNGFileType, $());
  pngData.writeToFileAtomically(outPath, true);

  // Verify decodability via CIDetectorTypeQRCode
  const verifyCI = $.CIImage.imageWithData(pngData);
  const detector = $.CIDetector.detectorOfTypeContextOptions(
    $.CIDetectorTypeQRCode,
    $(),
    $({ CIDetectorAccuracy: $.CIDetectorAccuracyHigh })
  );
  const features = detector.featuresInImage(verifyCI);
  const count = features.count;
  let decoded = '';
  if (count > 0) {
    decoded = ObjC.unwrap(features.objectAtIndex(0).messageString);
  }
  if (decoded !== url) {
    throw new Error('QR verification failed for ' + outPath + ': expected ' + url + ', got ' + decoded);
  }
}

function run(argv) {
  const outDir = argv[0] || '/Users/harrymclaren/Projects/csc-website/dist/slides';
  const fm = $.NSFileManager.defaultManager;
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(outDir, true, $(), null);

  generateStyledQR(
    'https://cyberscotlandconnect.com/discord',
    outDir + '/qr-discord.png',
    '#F5F3FA',
    '#D6CEEA',
    '#21203A',
    '#382B5C',
    '#895294'
  );

  generateStyledQR(
    'https://cyberscotlandconnect.com/support',
    outDir + '/qr-support.png',
    '#EDEAF5',
    '#C9BFE3',
    '#21203A',
    '#382B5C',
    '#895294'
  );

  return 'Generated and verified styled QR badges in ' + outDir;
}
