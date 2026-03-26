'use client';

import { useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Papa from 'papaparse';
import { Upload, Download, Loader2, CheckCircle, XCircle, Barcode, Trash2, Plus, ZoomIn, X, ChevronDown } from 'lucide-react';

const translations = {
  de: {
    appTitle: 'Barcode Scan Tool',
    appSubtitle: 'Client-seitiger Barcode-Scanner. Deine Bilder bleiben im Browser.',
    uploadTitle: 'Bilder hier ablegen oder tippen',
    uploadSubtitle: 'Unterstuetzt JPG, PNG, BMP und HEIC.',
    imagesLoaded: 'Bilder geladen',
    clearAll: 'Alles loeschen',
    startScan: 'Scan starten',
    scanning: 'Scanne...',
    removeImage: 'Bild entfernen',
    waiting: 'Wartet...',
    notFound: 'Nicht gefunden',
    foundCount: 'Codes gefunden',
    resultsTitle: 'Ergebnisse',
    addEntry: 'Hinzufuegen',
    tipTitle: 'Tipp:',
    tipCheckImages: 'Pruefe kurz die Bilder per Vorschau, ob alle Codes erfasst wurden.',
    tipEditTable: 'Dateinamen und Barcode-Inhalte koennen direkt in der Tabelle bearbeitet werden.',
    tipAddMissing: 'Fehlende Codes koennen ueber "Hinzufuegen" manuell ergaenzt werden.',
    tipDeleteWrong: 'Falsche Eintraege lassen sich ueber das Muelleimer-Symbol loeschen.',
    tableId: 'ID',
    tableFileName: 'Dateiname',
    tableContent: 'Inhalt',
    tableStatus: 'Status',
    noResults: 'Keine Ergebnisse.',
    statusFound: 'Gefunden',
    statusManual: 'Manuell',
    statusError: 'Fehler',
    manualFileName: 'Manuell',
    noBarcodeFound: 'Kein Barcode gefunden',
    modalFound: 'Barcodes gefunden',
    viewError: 'Fehler ansehen',
    errorTitle: 'Fehlerdetails',
    errorDescription: 'Zu diesem Eintrag konnten keine Codes erkannt werden.',
    errorMessage: 'Meldung',
    diagnosticTitle: 'Diagnose',
    diagnosticBrowser: 'Browser',
    diagnosticPath: 'Scan-Pfad',
    diagnosticAttempts: 'Versuche',
    openImagePreview: 'Bildvorschau oeffnen',
    close: 'Schliessen',
  },
  en: {
    appTitle: 'Barcode Scan Tool',
    appSubtitle: 'Client-side barcode scanner. Your images stay in the browser.',
    uploadTitle: 'Drop images here or tap to upload',
    uploadSubtitle: 'Supports JPG, PNG, BMP and HEIC.',
    imagesLoaded: 'images loaded',
    clearAll: 'Clear all',
    startScan: 'Start scan',
    scanning: 'Scanning...',
    removeImage: 'Remove image',
    waiting: 'Waiting...',
    notFound: 'Not found',
    foundCount: 'codes found',
    resultsTitle: 'Results',
    addEntry: 'Add entry',
    tipTitle: 'Tip:',
    tipCheckImages: 'Quickly review the images in preview mode to confirm all codes were captured.',
    tipEditTable: 'File names and barcode values can be edited directly in the table.',
    tipAddMissing: 'Missing codes can be added manually via "Add entry".',
    tipDeleteWrong: 'Incorrect rows can be removed with the trash icon.',
    tableId: 'ID',
    tableFileName: 'File name',
    tableContent: 'Content',
    tableStatus: 'Status',
    noResults: 'No results.',
    statusFound: 'Found',
    statusManual: 'Manual',
    statusError: 'Error',
    manualFileName: 'Manual',
    noBarcodeFound: 'No barcode found',
    modalFound: 'barcodes found',
    viewError: 'View error',
    errorTitle: 'Error details',
    errorDescription: 'No codes could be detected for this entry.',
    errorMessage: 'Message',
    diagnosticTitle: 'Diagnostics',
    diagnosticBrowser: 'Browser',
    diagnosticPath: 'Scan path',
    diagnosticAttempts: 'Attempts',
    openImagePreview: 'Open image preview',
    close: 'Close',
  }
};

export default function Home() {
  const [language, setLanguage] = useState('de');
  const [images, setImages] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const t = translations[language];

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Reset previous results if new upload
    const newImages = files.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending', // pending, scanning, success, failed
      result: null, // string summary
      detectedCodes: [], // array of { text, box }
      width: 0,
      height: 0,
      preview: URL.createObjectURL(file)
    }));

    setImages(prev => [...prev, ...newImages]);
  };

  const scanWithTiling = async (fileOrImage, detector) => {
      const allCodes = [];
      const uniqueTexts = new Set();
      
      const processSource = async (source, offsetX, offsetY) => {
          try {
              const detected = await detector.detect(source);
              detected.forEach(b => {
                 if (!uniqueTexts.has(b.rawValue)) {
                     uniqueTexts.add(b.rawValue);
                     allCodes.push({
                         text: b.rawValue,
                         box: b.boundingBox ? {
                             x: b.boundingBox.x + offsetX,
                             y: b.boundingBox.y + offsetY,
                             width: b.boundingBox.width,
                             height: b.boundingBox.height
                         } : null
                     });
                 }
              });
          } catch (e) {
              console.warn("Tile scan failed", e);
          }
      };

      try {
          // Determine if we have a file or an image element
          let imageSource = fileOrImage;
          let w, h;

          // If it's a File, convert to ImageBitmap or HTMLImageElement for dimensions
          if (fileOrImage instanceof File) {
             try {
                // Prefer ImageBitmap for performance if available
                imageSource = await createImageBitmap(fileOrImage);
                w = imageSource.width;
                h = imageSource.height;
             } catch (e) {
                // Fallback to HTMLImageElement
                const img = new Image();
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = URL.createObjectURL(fileOrImage);
                });
                imageSource = img;
                w = img.width;
                h = img.height;
             }
          } else {
             // Already an image element/bitmap
             w = imageSource.width || imageSource.videoWidth;
             h = imageSource.height || imageSource.videoHeight;
          }

          // 1. Full Scan
          await processSource(imageSource, 0, 0);
          
          // 2. Tiled Scan (Robustness)
          const tiles = [
              { x: 0, y: 0, w: w * 0.6, h: h * 0.6 }, // Top-Left
              { x: w * 0.4, y: 0, w: w * 0.6, h: h * 0.6 }, // Top-Right
              { x: 0, y: h * 0.4, w: w * 0.6, h: h * 0.6 }, // Bottom-Left
              { x: w * 0.4, y: h * 0.4, w: w * 0.6, h: h * 0.6 }, // Bottom-Right
              { x: w * 0.2, y: h * 0.2, w: w * 0.6, h: h * 0.6 } // Center
          ];

          // We need a canvas to crop (createImageBitmap clipping is flaky on some browsers)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          for (const tile of tiles) {
               canvas.width = tile.w;
               canvas.height = tile.h;
               ctx.drawImage(imageSource, tile.x, tile.y, tile.w, tile.h, 0, 0, tile.w, tile.h);
               
               // Some detectors accept canvas directly
               try {
                   await processSource(canvas, tile.x, tile.y);
               } catch (err) {
                   console.warn("Could not process tile", err);
               }
          }
          
          if (imageSource.close) imageSource.close(); // Clean up bitmap if used

      } catch (e) {
          console.error("Advanced scan error", e);
      }

      return allCodes;
  };

  /**
   * Pre-process file to handle HEIC images for mobile compatibility.
   * Converts HEIC to JPEG blob if detected.
   */
  const preProcessFile = async (file) => {
      // Check if file is HEIC
      if (file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith('.heic')) {
          try {
              // Dynamically import heic2any only on client side
              const heic2any = (await import('heic2any')).default;
              
              console.log(`Converting HEIC: ${file.name}`);
              const convertedBlob = await heic2any({
                  blob: file,
                  toType: "image/jpeg",
                  quality: 0.9
              });
              
              // heic2any can return a single blob or array of blobs (for live photos)
              // We take the first one if array
              const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
              
              return new File([finalBlob], file.name.replace(/\.heic$/i, ".jpg"), { 
                  type: "image/jpeg" 
              });
          } catch (e) {
              console.error("HEIC conversion failed", e);
              // Fallback to original if conversion fails
              return file;
          }
      }
      return file;
  };

  const loadImageElement = (file) => new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    image.src = objectUrl;
  });

  const canvasToFile = (canvas, fileName, mimeType) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed'));
        return;
      }

      resolve(new File([blob], fileName, { type: mimeType }));
    }, mimeType, 0.98);
  });

  const createRotatedFileVariants = async (file) => {
    const image = await loadImageElement(file);
    const rotations = [0, 90, 180, 270];
    const variants = [];
    const mimeType = file.type && file.type !== 'image/heic' && file.type !== 'image/heif'
      ? file.type
      : 'image/jpeg';

    for (const rotation of rotations) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) continue;

      if (rotation === 90 || rotation === 270) {
        canvas.width = image.height;
        canvas.height = image.width;
      } else {
        canvas.width = image.width;
        canvas.height = image.height;
      }

      context.save();

      if (rotation === 90) {
        context.translate(canvas.width, 0);
        context.rotate(Math.PI / 2);
      } else if (rotation === 180) {
        context.translate(canvas.width, canvas.height);
        context.rotate(Math.PI);
      } else if (rotation === 270) {
        context.translate(0, canvas.height);
        context.rotate(-Math.PI / 2);
      }

      context.drawImage(image, 0, 0);
      context.restore();

      variants.push({
        rotation,
        file: await canvasToFile(canvas, file.name, mimeType),
        width: canvas.width,
        height: canvas.height,
      });
    }

    return variants;
  };

  const getBrowserLabel = () => {
    if (typeof navigator === 'undefined') return 'Unknown';

    const userAgent = navigator.userAgent;

    if (userAgent.includes('Edg/')) return 'Edge';
    if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) return 'Chrome';
    if (userAgent.includes('Firefox/')) return 'Firefox';
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) return 'Safari';

    return navigator.userAgent;
  };

  const scanFileWithFallbacks = async (file, scanner) => {
    const diagnostics = {
      path: 'html5-qrcode',
      attempts: ['html5-qrcode: direct file scan'],
    };

    try {
      const directResult = await scanner.scanFile(file, false);
      const image = await loadImageElement(file);

      return {
        codes: [{ text: directResult, box: null }],
        width: image.width,
        height: image.height,
        diagnostics: {
          ...diagnostics,
          successPath: 'html5-qrcode: direct file scan',
        },
      };
    } catch (directError) {
      diagnostics.attempts.push(`html5-qrcode: direct scan failed (${directError?.message || directError})`);
      const variants = await createRotatedFileVariants(file);

      for (const variant of variants) {
        try {
          diagnostics.attempts.push(`html5-qrcode: rotated ${variant.rotation}deg scan`);
          const rotatedResult = await scanner.scanFile(variant.file, false);
          return {
            codes: [{ text: rotatedResult, box: null }],
            width: variant.width,
            height: variant.height,
            diagnostics: {
              ...diagnostics,
              successPath: `html5-qrcode: rotated ${variant.rotation}deg scan`,
            },
          };
        } catch (variantError) {
          diagnostics.attempts.push(`html5-qrcode: rotated ${variant.rotation}deg failed (${variantError?.message || variantError})`);
          console.warn(`Rotation ${variant.rotation} scan failed`, variantError);
        }
      }

      directError.scanDiagnostics = diagnostics;
      throw directError;
    }
  };

  const sortCodesByReadingOrder = (codes) => {
    const codesWithBoxes = codes.filter((code) => code.box);
    const codesWithoutBoxes = codes.filter((code) => !code.box);

    if (codesWithBoxes.length <= 1) {
      return [...codesWithBoxes, ...codesWithoutBoxes];
    }

    const averageHeight = codesWithBoxes.reduce((sum, code) => sum + code.box.height, 0) / codesWithBoxes.length;
    const rowThreshold = Math.max(averageHeight * 0.6, 24);

    const sortedByTop = [...codesWithBoxes].sort((left, right) => {
      if (left.box.y !== right.box.y) return left.box.y - right.box.y;
      return left.box.x - right.box.x;
    });

    const rows = [];

    sortedByTop.forEach((code) => {
      const centerY = code.box.y + (code.box.height / 2);
      const existingRow = rows.find((row) => Math.abs(row.centerY - centerY) <= rowThreshold);

      if (existingRow) {
        existingRow.codes.push(code);
        const centers = existingRow.codes.map((rowCode) => rowCode.box.y + (rowCode.box.height / 2));
        existingRow.centerY = centers.reduce((sum, value) => sum + value, 0) / centers.length;
        return;
      }

      rows.push({ centerY, codes: [code] });
    });

    const orderedCodes = rows
      .sort((left, right) => left.centerY - right.centerY)
      .flatMap((row) => row.codes.sort((left, right) => {
        const leftCenterX = left.box.x + (left.box.width / 2);
        const rightCenterX = right.box.x + (right.box.width / 2);
        return leftCenterX - rightCenterX;
      }));

    return [...orderedCodes, ...codesWithoutBoxes];
  };

  const startScanning = async () => {
    setIsScanning(true);
    setProgress(0);
    const newResults = [];
    
    // ... scanner initialization ...
    let html5QrCode;
    try { html5QrCode = new Html5Qrcode("reader-hidden"); } catch (e) {}
    
    let globalIdCounter = results.reduce((max, r) => Math.max(max, parseInt(r.ScanID) || 0), 0);

    for (let i = 0; i < images.length; i++) {
      const imgObj = images[i];
      if (imgObj.status === 'success' || imgObj.status === 'failed') continue;

      updateImageStatus(imgObj.id, { status: 'scanning' });

      try {
        let codes = [];
        let imgWidth = 0;
        let imgHeight = 0;
        const scanDiagnostics = {
          browser: getBrowserLabel(),
          path: 'unknown',
          attempts: [],
        };
        
        // 1. Pre-process for HEIC support
        const processingFile = await preProcessFile(imgObj.file);

        // Attempt 1: Native BarcodeDetector
        if ('BarcodeDetector' in window) {
           try {
             // ... logic from before ...
             const formats = await window.BarcodeDetector.getSupportedFormats();
             scanDiagnostics.attempts.push(`native barcode detector available (${formats.length} formats)`);
             if (formats && formats.length > 0) {
                 const detector = new window.BarcodeDetector({ formats });
                 codes = await scanWithTiling(processingFile, detector);
                 
                 if (codes.length > 0) {
                     scanDiagnostics.path = 'native-barcode-detector';
                     scanDiagnostics.attempts.push(`native barcode detector succeeded with ${codes.length} code(s)`);
                     // Get dimensions
                     const bmp = await createImageBitmap(processingFile);
                     imgWidth = bmp.width;
                     imgHeight = bmp.height;
                     bmp.close();
                 } else {
                     scanDiagnostics.attempts.push('native barcode detector found no codes');
                 }
             }
           } catch (e) {
             scanDiagnostics.attempts.push(`native barcode detector failed (${e?.message || e})`);
             console.warn("Native fallack", e);
           }
        } else {
          scanDiagnostics.attempts.push('native barcode detector unavailable');
        }

        // Attempt 2: Fallback to html5-qrcode
        if (codes.length === 0) {
             if (!html5QrCode) html5QrCode = new Html5Qrcode("reader-hidden");
             try {
               const fallbackResult = await scanFileWithFallbacks(processingFile, html5QrCode);
               codes = fallbackResult.codes;
               imgWidth = fallbackResult.width;
               imgHeight = fallbackResult.height;
               scanDiagnostics.path = fallbackResult.diagnostics.successPath || 'html5-qrcode';
               scanDiagnostics.attempts.push(...fallbackResult.diagnostics.attempts);
             } catch (e) {
                scanDiagnostics.path = 'html5-qrcode';
                if (e.scanDiagnostics?.attempts) {
                  scanDiagnostics.attempts.push(...e.scanDiagnostics.attempts);
                } else {
                  scanDiagnostics.attempts.push(`html5-qrcode failed (${e?.message || e})`);
                }
                // Last ditch effort for dimensions
                if (imgWidth === 0) {
                   try {
                     const img = new Image();
                     await new Promise((resolve) => {
                          img.onload = resolve; 
                          img.onerror = resolve;
                          img.src = URL.createObjectURL(processingFile);
                     });
                     if (img.width) { imgWidth = img.width; imgHeight = img.height; }
                   } catch(err) {} 
                }
                if (codes.length === 0) throw e; 
             }
        }
        
        if (codes.length === 0) throw new Error("No code found");

        // Sort results in reading order so ID labels match the table order.
        codes = sortCodesByReadingOrder(codes);

        // Assign IDs
        codes = codes.map((c) => {
             globalIdCounter++;
             return { ...c, id: globalIdCounter };
        });

        updateImageStatus(imgObj.id, { 
            status: 'success', 
          result: `${codes.length} ${t.foundCount}`,
            detectedCodes: codes,
            width: imgWidth,
            height: imgHeight
        });
        
        codes.forEach(code => {
            newResults.push({
              id: Math.random().toString(36).substr(2, 9),
              ImageID: imgObj.id,
              ScanID: code.id,
              Dateiname: imgObj.file.name,
              Inhalt: code.text,
              Typ: "Barcode/QR", 
              Status: "Gefunden",
              ScanDiagnostics: scanDiagnostics
            });
        });

      } catch (err) {
        console.warn(`Error scanning ${imgObj.file.name}:`, err);
        const failedDiagnostics = err.scanDiagnostics || {
          browser: getBrowserLabel(),
          path: 'unknown',
          attempts: [err instanceof Error ? err.message : String(err)],
        };
        updateImageStatus(imgObj.id, { status: 'failed' });
        newResults.push({
          id: Math.random().toString(36).substr(2, 9),
          ImageID: imgObj.id,
          Dateiname: imgObj.file.name,
          Inhalt: "-",
          Typ: "-",
          Status: t.noBarcodeFound,
          ErrorDetails: err instanceof Error ? err.message : String(err),
          ScanDiagnostics: failedDiagnostics
        });
      }

      setProgress(((i + 1) / images.length) * 100);
    }



    setResults(prev => [...prev, ...newResults]);
    setIsScanning(false);
  };

  const updateImageStatus = (id, updates) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, ...updates } : img
    ));
  };

  const updateResult = (id, field, value) => {
      setResults(prev => prev.map(res => 
          res.id === id ? { ...res, [field]: value } : res
      ));
  };

  const deleteResult = (id) => {
      setResults(prev => prev.filter(res => res.id !== id));
  };

  const deleteImage = (id) => {
      setImages(prev => prev.filter(img => img.id !== id));
      // Delete results associated with this image ID if we stored it
      setResults(prev => prev.filter(res => res.ImageID !== id));
  };

  const addResult = () => {
      setResults(prev => [
          ...prev, 
          {
              id: Math.random().toString(36).substr(2, 9),
              Dateiname: t.manualFileName,
              Inhalt: "",
              Typ: t.statusManual,
              Status: t.statusManual
          }
      ]);
  };

  const triggerBlobDownload = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportResults = async (format = exportFormat) => {
    const dataToExport = results.map(({ id, ImageID, ErrorDetails, ScanDiagnostics, ...rest }) => rest);

    if (dataToExport.length === 0) return;

    if (format === 'csv') {
      const csv = Papa.unparse(dataToExport);
      triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'barcode_liste.csv');
    }

    if (format === 'tsv') {
      const tsv = Papa.unparse(dataToExport, { delimiter: '\t' });
      triggerBlobDownload(new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' }), 'barcode_liste.tsv');
    }

    if (format === 'xlsx') {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Barcodes');
      XLSX.writeFile(workbook, 'barcode_liste.xlsx');
    }

    setExportFormat(format);
    setShowExportMenu(false);
  };


  const exportLabel = exportFormat.toUpperCase();

  const openErrorDetails = (row) => {
    const relatedImage = row.ImageID ? images.find(image => image.id === row.ImageID) : null;
    setErrorDetails({
      row,
      image: relatedImage || null,
    });
  };

  const clearAll = () => {
    setImages([]);
    setResults([]);
    setProgress(0);
    setIsScanning(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 md:mb-10">
          <div className="mb-2 flex flex-col items-center justify-center gap-3 md:flex-row md:gap-4">
            <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3">
            <Barcode className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />
            {t.appTitle}
            </h1>
            <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setLanguage('de')}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${language === 'de' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                DE
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${language === 'en' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                EN
              </button>
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-600">
            {t.appSubtitle}
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-6 md:p-10 text-center hover:border-blue-500 transition-colors cursor-pointer relative active:bg-gray-50">
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isScanning}
          />
          <div className="flex flex-col items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <Upload size={24} className="md:w-8 md:h-8" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-semibold text-gray-800">{t.uploadTitle}</h3>
              <p className="text-xs md:text-sm text-gray-500">{t.uploadSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Hidden div for html5-qrcode */}
        <div id="reader-hidden" className="hidden"></div>

        {/* Actions & Progress */}
        {images.length > 0 && (
          <div className="mt-6 md:mt-8 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="text-gray-700 font-medium text-sm md:text-base">
                {images.length} {t.imagesLoaded}
              </div>
              <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 w-full md:w-auto">
                 <button 
                  onClick={clearAll}
                  disabled={isScanning}
                  className="w-full md:w-auto px-4 py-3 md:py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 bg-gray-50 md:bg-transparent rounded-lg transition-colors text-sm font-medium"
                >
                  {t.clearAll}
                </button>
                <button 
                  onClick={startScanning}
                  disabled={isScanning}
                  className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 md:py-2 rounded-lg text-white font-medium transition-all ${
                    isScanning ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95'
                  }`}
                >
                  {isScanning ? <Loader2 className="animate-spin" size={20} /> : <Barcode size={20} />}
                  {isScanning ? t.scanning : t.startScan}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {isScanning && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* Image List / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {images.map((img) => (
                <div key={img.id} className="relative group bg-gray-50 rounded-lg overflow-hidden border border-gray-200">

                  {/* Image Preview */}
                  <div className="aspect-square relative bg-gray-200 cursor-zoom-in" onClick={() => setPreviewImage(img)}>
                    <img src={img.preview} alt="preview" className="object-contain w-full h-full bg-black/5" />
                    
                    {/* Barcode Overlays */}
                    {img.width > 0 && img.height > 0 && img.detectedCodes.length > 0 && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${img.width} ${img.height}`} preserveAspectRatio="xMidYMid meet">
                        {img.detectedCodes.map((code, idx) => {
                          if (!code.box) return null;
                          return (
                            <g key={idx}>
                                <rect
                                x={code.box.x}
                                y={code.box.y}
                                width={code.box.width}
                                height={code.box.height}
                                fill="none"
                                stroke="#ef4444" // red-500
                                strokeWidth={Math.max(5, Math.min(img.width, img.height) / 100)} 
                                />
                                <text 
                                    x={code.box.x} 
                                    y={code.box.y - (Math.min(img.width, img.height) / 100)} 
                                    fill="red" 
                                    fontWeight="bold" 
                                    fontSize={Math.max(20, Math.min(img.width, img.height) / 15)}
                                    className="drop-shadow-md shadow-white"
                                    style={{ textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff' }}
                                >
                                    #{code.id}
                                </text>
                            </g>
                          );
                        })}
                      </svg>
                    )}

                    {/* Status Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <ZoomIn className="text-white w-8 h-8 opacity-80" />
                    </div>

                    {/* Corner Status Icon */}
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                         <button 
                            onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                            className="bg-white/80 hover:bg-white text-gray-500 hover:text-red-500 rounded-full p-1 shadow-sm transition-all"
                             title={t.removeImage}
                         >
                             <Trash2 size={16} />
                         </button>
                    </div>

                    <div className="absolute top-2 left-2 z-10">
                       {img.status === 'pending' && <span className="w-5 h-5 bg-gray-400 rounded-full block border-2 border-white"></span>}
                       {img.status === 'scanning' && <Loader2 className="w-6 h-6 text-blue-400 animate-spin bg-white rounded-full p-0.5 shadow-sm" />}
                       {img.status === 'success' && <CheckCircle className="w-6 h-6 text-green-500 bg-white rounded-full shadow-sm" />}
                       {img.status === 'failed' && <XCircle className="w-6 h-6 text-red-500 bg-white rounded-full shadow-sm" />}
                    </div>
                  </div>
                  
                  {/* Filename & Result */}
                  <div className="p-3 text-sm">
                    <p className="truncate text-gray-700 font-medium" title={img.file.name}>{img.file.name}</p>
                    {img.result ? (
                      <p className="text-green-600 font-mono text-xs mt-1 truncate" title={img.result}>{img.result}</p>
                    ) : (
                      <p className="text-gray-400 text-xs mt-1 italic">
                        {img.status === 'failed' ? t.notFound : t.waiting}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results & CSV */}
        {(results.length > 0 || !isScanning) && (
          <div className="mt-8 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-3">
              <h2 className="text-xl font-bold text-gray-800 w-full md:w-auto text-center md:text-left">{t.resultsTitle}</h2>
               <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button 
                        onClick={addResult}
                        className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium shadow-sm transition-colors w-full sm:w-auto"
                    >
                        <Plus size={18} />
                        {t.addEntry}
                    </button>
                    <div className="relative w-full sm:w-auto">
                        <button 
                            onClick={() => setShowExportMenu(prev => !prev)}
                            disabled={results.length === 0}
                            className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        >
                            <Download size={18} />
                            {exportLabel}
                            <ChevronDown size={16} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                        </button>
                        {showExportMenu && results.length > 0 && (
                          <div className="absolute right-0 z-20 mt-2 w-full min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg sm:w-auto">
                            <button
                              onClick={() => exportResults('csv')}
                              className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              CSV
                            </button>
                            <button
                              onClick={() => exportResults('tsv')}
                              className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              TSV
                            </button>
                            <button
                              onClick={() => exportResults('xlsx')}
                              className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              XLSX
                            </button>
                          </div>
                        )}
                    </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex flex-col gap-1">
              <p><strong>{t.tipTitle}</strong> {t.tipCheckImages}</p>
                <ul className="list-disc list-inside opacity-80 pl-1 text-xs md:text-sm">
                <li>{t.tipEditTable}</li>
                <li>{t.tipAddMissing}</li>
                <li>{t.tipDeleteWrong}</li>
                </ul>
            </div>
            
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="min-w-full inline-block align-middle">
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">{t.tableId}</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[120px] md:max-w-xs">{t.tableFileName}</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableContent}</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">{t.tableStatus}</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.length === 0 ? (
                          <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic text-sm">
                              {t.noResults}
                              </td>
                          </tr>
                      ) : (
                          results.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3 md:px-6 text-xs text-gray-400 font-mono">
                                {row.ScanID ? `#${row.ScanID}` : '-'}
                              </td>
                              <td className="px-3 py-3 md:px-6 text-sm text-gray-900 max-w-[120px] md:max-w-xs truncate">
                                <input 
                                    type="text" 
                                    value={row.Dateiname}
                                    onChange={(e) => updateResult(row.id, 'Dateiname', e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm truncate"
                                />
                              </td>
                              <td className="px-3 py-3 md:px-6 text-sm text-blue-600 font-mono">
                                <input 
                                    type="text" 
                                    value={row.Inhalt}
                                    onChange={(e) => updateResult(row.id, 'Inhalt', e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-bold"
                                />
                              </td>
                              <td className="px-3 py-3 md:px-6 whitespace-nowrap">
                                {row.Status === "Gefunden" || row.Status === "Found" ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span>
                                ) : row.Status === "Manuell" || row.Status === "Manual" ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Man</span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">ERR</span>
                                )}
                              </td>
                              <td className="px-3 py-3 md:px-6 text-right whitespace-nowrap text-sm font-medium">
                                  {row.ErrorDetails && (
                                    <button 
                                      onClick={() => openErrorDetails(row)}
                                      className="text-gray-400 hover:text-blue-600 p-2"
                                      title={t.viewError}
                                    >
                                      <ZoomIn size={16} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => deleteResult(row.id)}
                                    className="text-gray-400 hover:text-red-600 p-2"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Image Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
            <div className="relative flex flex-col max-w-[90vw] max-h-[90vh] bg-white rounded-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="absolute top-2 right-2 z-20">
                   <button onClick={() => setPreviewImage(null)} className="bg-white/90 text-gray-800 p-2 rounded-full hover:bg-white hover:text-red-500 shadow-md transition-all">
                       <X size={20} />
                   </button>
               </div>
               
               <div className="relative flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-2">
                   <div className="relative inline-block">
                        <img src={previewImage.preview} alt="Full view" className="max-w-full max-h-[80vh] object-contain" />
                        
                        {/* SVGs must be absolutely positioned over the img */}
                        {previewImage.width > 0 && previewImage.height > 0 && previewImage.detectedCodes.length > 0 && (
                        <svg 
                            className="absolute inset-0 w-full h-full pointer-events-none" 
                            viewBox={`0 0 ${previewImage.width} ${previewImage.height}`} 
                            preserveAspectRatio="xMidYMid meet"
                        >
                            {previewImage.detectedCodes.map((code, idx) => {
                            if (!code.box) return null;
                            const fontSize = Math.max(14, Math.min(previewImage.width, previewImage.height) * 0.03);

                            return (
                                <g key={idx}>
                                    {/* Just the text ID, no Box */}
                                    <text 
                                        x={code.box.x + (code.box.width / 2)} 
                                        y={code.box.y + (code.box.height / 2)} 
                                        fill="red" 
                                        fontWeight="bold" 
                                        textAnchor="middle"
                                        alignmentBaseline="middle"
                                        stroke="#fff" 
                                        strokeWidth={fontSize / 5} 
                                        paintOrder="stroke"
                                        fontSize={fontSize}
                                    >
                                        #{code.id}
                                    </text>
                                </g>
                            );
                            })}
                        </svg>
                        )}
                   </div>
               </div>
               
               <div className="bg-white p-4 border-t border-gray-100 flex justify-between items-center shrink-0">
                   <div>
                       <h3 className="font-bold text-gray-800">{previewImage.file.name}</h3>
                     <p className="text-sm text-gray-500">{previewImage.detectedCodes.length} {t.modalFound}</p>
                   </div>
                   <div className="font-mono text-xs text-gray-600 max-w-md overflow-hidden text-ellipsis whitespace-nowrap">
                       {previewImage.result}
                   </div>
               </div>
            </div>
        </div>
      )}

      {errorDetails && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setErrorDetails(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 p-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t.errorTitle}</h3>
                <p className="mt-1 text-sm text-gray-500">{t.errorDescription}</p>
              </div>
              <button
                onClick={() => setErrorDetails(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title={t.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.tableFileName}</p>
                <p className="mt-1 break-words text-sm text-gray-800">{errorDetails.row.Dateiname}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.errorMessage}</p>
                <p className="mt-1 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorDetails.row.ErrorDetails}</p>
              </div>

              {errorDetails.row.ScanDiagnostics && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.diagnosticTitle}</p>
                  <div className="mt-1 space-y-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.diagnosticBrowser}</p>
                      <p className="mt-1 break-words">{errorDetails.row.ScanDiagnostics.browser || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.diagnosticPath}</p>
                      <p className="mt-1 break-words">{errorDetails.row.ScanDiagnostics.path || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.diagnosticAttempts}</p>
                      <ul className="mt-1 space-y-1">
                        {errorDetails.row.ScanDiagnostics.attempts?.map((attempt, index) => (
                          <li key={`${attempt}-${index}`} className="break-words text-xs text-gray-600">
                            {attempt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {errorDetails.image && (
                <button
                  onClick={() => {
                    setPreviewImage(errorDetails.image);
                    setErrorDetails(null);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <ZoomIn size={16} />
                  {t.openImagePreview}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
