ObjC.import('PDFKit');
ObjC.import('Cocoa');

function run(argv) {
  var pdfPath = argv[0] || '/Users/harrymclaren/Projects/csc-website/dist/slides/2026-11-26-edinburgh-codebase.pdf';
  var outDir = argv[1] || '/Users/harrymclaren/Projects/csc-website/dist/slides/rendered';

  var fm = $.NSFileManager.defaultManager;
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(outDir, true, $(), null);

  var url = $.NSURL.fileURLWithPath(pdfPath);
  var doc = $.PDFDocument.alloc.initWithURL(url);
  if (!doc || doc.isNil()) {
    throw new Error('Failed to load PDF: ' + pdfPath);
  }
  var pageCount = doc.pageCount;

  for (var i = 0; i < pageCount; i++) {
    var page = doc.pageAtIndex(i);
    var box = page.boundsForBox($.kPDFDisplayBoxMediaBox);
    var scale = 1.5;
    var scaledSize = $.NSMakeSize(box.size.width * scale, box.size.height * scale);
    var img = $.NSImage.alloc.initWithSize(scaledSize);
    img.lockFocus;
    var ctx = $.NSGraphicsContext.currentContext.CGContext;
    $.CGContextScaleCTM(ctx, scale, scale);
    $.CGContextSetRGBFillColor(ctx, 1, 1, 1, 1);
    $.CGContextFillRect(ctx, box);
    page.drawWithBoxToContext($.kPDFDisplayBoxMediaBox, ctx);
    img.unlockFocus;
    
    var tiff = img.TIFFRepresentation;
    var rep = $.NSBitmapImageRep.imageRepWithData(tiff);
    var png = rep.representationUsingTypeProperties($.NSPNGFileType, $());
    var outPath = outDir + '/slide-' + (i + 1) + '.png';
    png.writeToFileAtomically(outPath, true);
  }
  return 'Rendered ' + pageCount + ' slides to ' + outDir;
}
