'use client';

import { useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Papa from 'papaparse';
import heic2any from 'heic2any'; // Import for HEIC conversion
import { Upload, Download, Loader2, CheckCircle, XCircle, Barcode, Trash2, Plus, ZoomIn, X } from 'lucide-react';

export default function Home() {
  const [images, setImages] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

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
        
        // 1. Pre-process for HEIC support
        const processingFile = await preProcessFile(imgObj.file);

        // Attempt 1: Native BarcodeDetector
        if ('BarcodeDetector' in window) {
           try {
             // ... logic from before ...
             const formats = await window.BarcodeDetector.getSupportedFormats();
             if (formats && formats.length > 0) {
                 const detector = new window.BarcodeDetector({ formats });
                 codes = await scanWithTiling(processingFile, detector);
                 
                 if (codes.length > 0) {
                     // Get dimensions
                     const bmp = await createImageBitmap(processingFile);
                     imgWidth = bmp.width;
                     imgHeight = bmp.height;
                     bmp.close();
                 }
             }
           } catch (e) { console.warn("Native fallack", e); }
        }

        // Attempt 2: Fallback to html5-qrcode
        if (codes.length === 0) {
             if (!html5QrCode) html5QrCode = new Html5Qrcode("reader-hidden");
             try {
                // Use the PROCESSED file (JPEG instead of HEIC)
                const result = await html5QrCode.scanFile(processingFile, false);
                
                if (imgWidth === 0) {
                   const img = new Image();
                   await new Promise((resolve) => {
                       img.onload = resolve;
                       img.src = URL.createObjectURL(processingFile);
                   });
                   imgWidth = img.width;
                   imgHeight = img.height;
                }
                codes = [{ text: result, box: null }];
             } catch (e) {
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

        // Sort results
        codes.sort((a, b) => {
            if (a.box && b.box) return a.box.y - b.box.y;
            return 0;
        });

        // Assign IDs
        codes = codes.map((c) => {
             globalIdCounter++;
             return { ...c, id: globalIdCounter };
        });

        updateImageStatus(imgObj.id, { 
            status: 'success', 
            result: `${codes.length} Codes gefunden`,
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
              Status: "Gefunden"
            });
        });

      } catch (err) {
        console.warn(`Error scanning ${imgObj.file.name}:`, err);
        updateImageStatus(imgObj.id, { status: 'failed' });
        newResults.push({
          id: Math.random().toString(36).substr(2, 9),
          Dateiname: imgObj.file.name,
          Inhalt: "-",
          Typ: "-",
          Status: "Kein Barcode gefunden"
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
              Dateiname: "Manuell",
              Inhalt: "",
              Typ: "Manuell",
              Status: "Manuell"
          }
      ]);
  };

  const downloadCSV = () => {
    // Exclude internal IDs from CSV
    const dataToExport = results.map(({ id, ImageID, ...rest }) => rest);
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'barcode_liste.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 mb-2">
            <Barcode className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />
            Niggis Barcode Tool (Web)
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Client-Side Barcode Scanner - Keine Daten verlassen deinen Browser! 🔒
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
              <h3 className="text-base md:text-lg font-semibold text-gray-800">Bilder hier ablegen oder tippen</h3>
              <p className="text-xs md:text-sm text-gray-500">Unterstützt JPG, PNG, BMP, etc.</p>
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
                {images.length} Bilder geladen
              </div>
              <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 w-full md:w-auto">
                 <button 
                  onClick={clearAll}
                  disabled={isScanning}
                  className="w-full md:w-auto px-4 py-3 md:py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 bg-gray-50 md:bg-transparent rounded-lg transition-colors text-sm font-medium"
                >
                  Alles löschen
                </button>
                <button 
                  onClick={startScanning}
                  disabled={isScanning}
                  className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 md:py-2 rounded-lg text-white font-medium transition-all ${
                    isScanning ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95'
                  }`}
                >
                  {isScanning ? <Loader2 className="animate-spin" size={20} /> : <Barcode size={20} />}
                  {isScanning ? 'Scanne...' : 'Scan starten'}
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
                            title="Bild entfernen"
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
                        {img.status === 'failed' ? 'Nicht gefunden' : 'Wartet...'}
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
              <h2 className="text-xl font-bold text-gray-800 w-full md:w-auto text-center md:text-left">Ergebnisse</h2>
               <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button 
                        onClick={addResult}
                        className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium shadow-sm transition-colors w-full sm:w-auto"
                    >
                        <Plus size={18} />
                        Hinzufügen
                    </button>
                    <button 
                        onClick={downloadCSV}
                        disabled={results.length === 0}
                        className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                    >
                        <Download size={18} />
                        CSV
                    </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex flex-col gap-1">
                <p><strong>💡 Tipp:</strong> Prüfe kurz die Bilder (einfach anklicken), ob alle Codes erkannt wurden.</p>
                <ul className="list-disc list-inside opacity-80 pl-1 text-xs md:text-sm">
                    <li>Du kannst Dateinamen und Barcode-Inhalte in der Tabelle direkt bearbeiten.</li>
                    <li>Fehlende Codes kannst du über "Hinzufügen" manuell ergänzen.</li>
                    <li>Falsche Einträge lassen sich über das Mülleimer-Icon löschen.</li>
                </ul>
            </div>
            
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="min-w-full inline-block align-middle">
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">ID</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[120px] md:max-w-xs">Dateiname</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inhalt</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Status</th>
                        <th scope="col" className="px-3 py-3 md:px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.length === 0 ? (
                          <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic text-sm">
                                  Keine Ergebnisse.
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
                                {row.Status === "Gefunden" ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span>
                                ) : row.Status === "Manuell" ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Man</span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">ERR</span>
                                )}
                              </td>
                              <td className="px-3 py-3 md:px-6 text-right whitespace-nowrap text-sm font-medium">
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
                       <p className="text-sm text-gray-500">{previewImage.detectedCodes.length} Barcodes gefunden</p>
                   </div>
                   <div className="font-mono text-xs text-gray-600 max-w-md overflow-hidden text-ellipsis whitespace-nowrap">
                       {previewImage.result}
                   </div>
               </div>
            </div>
        </div>
      )}
    </main>
  );
}
