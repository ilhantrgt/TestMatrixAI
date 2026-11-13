import React, { useMemo, useRef, useState } from 'react';
import { Upload, GitBranch, Trash2, ClipboardPaste, Code2 } from 'lucide-react';
import { DiagramCoverageStrategy } from '../types';
import { SAMPLE_ACTIVITY_DIAGRAMS, SampleDiagramDoc } from '../data/sampleDiagrams';
import { parseDiagramForPreview } from '../utils/diagramClientParser';
import { DiagramFlowPreview } from './DiagramFlowPreview';

export interface DiagramImagePayload {
  base64: string;
  mimeType: string;
  fileName: string;
  dataUrl: string;
}

interface ActivityDiagramPanelProps {
  diagramText: string;
  onChangeDiagramText: (text: string) => void;
  diagramImage: DiagramImagePayload | null;
  onChangeDiagramImage: (img: DiagramImagePayload | null) => void;
  coverageStrategy: DiagramCoverageStrategy;
  onChangeCoverageStrategy: (strategy: DiagramCoverageStrategy) => void;
  isEn?: boolean;
}

async function compressRasterImage(file: File | Blob, fileName: string): Promise<DiagramImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Görsel formatı çözümlenemedi.'));
      img.onload = () => {
        const MAX_DIM = 1800;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width || 1200;
        canvas.height = height || 800;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            base64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
            mimeType: file.type || 'image/png',
            fileName,
            dataUrl,
          });
          return;
        }

        // White background preserves dark diagram text on transparent PNG/SVG exports
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const targetMime = file.type === 'image/jpeg' || file.type === 'image/jpg' ? 'image/jpeg' : 'image/png';
        const outDataUrl = canvas.toDataURL(targetMime, 0.9);
        resolve({
          base64: outDataUrl.replace(/^data:[^;]+;base64,/, ''),
          mimeType: targetMime,
          fileName,
          dataUrl: outDataUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ActivityDiagramPanel: React.FC<ActivityDiagramPanelProps> = ({
  diagramText,
  onChangeDiagramText,
  diagramImage,
  onChangeDiagramImage,
  coverageStrategy,
  onChangeCoverageStrategy,
  isEn = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const parsedDiagram = useMemo(() => {
    return parseDiagramForPreview(diagramText);
  }, [diagramText]);

  const processUploadedFile = async (file: File) => {
    setUploadNotice(null);
    const lower = file.name.toLowerCase();

    // Image files (PNG, JPG, WebP, SVG)
    if (
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|svg)$/i.test(lower)
    ) {
      try {
        const imgPayload = await compressRasterImage(file, file.name);
        onChangeDiagramImage(imgPayload);
      } catch (err: any) {
        setUploadNotice(err?.message || (isEn ? 'Could not load image.' : 'Görsel yüklenemedi.'));
      }
      return;
    }

    // Text / Mermaid / PlantUML / BPMN / Draw.io XML
    const reader = new FileReader();
    reader.onload = (ev) => {
      const textContent = String(ev.target?.result || '');
      if (textContent.trim()) {
        onChangeDiagramImage(null);
        onChangeDiagramText(textContent.trim());
      } else {
        setUploadNotice(isEn ? 'Uploaded file is empty.' : 'Yüklenen dosya boş görünüyor.');
      }
    };
    reader.readAsText(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          try {
            const payload = await compressRasterImage(blob, `pasted-diagram-${Date.now()}.png`);
            onChangeDiagramImage(payload);
            setUploadNotice(null);
          } catch {
            setUploadNotice(isEn ? 'Could not read pasted image.' : 'Yapıştırılan görsel okunamadı.');
          }
          return;
        }
      }
    }
  };

  const handleSelectSample = (sample: SampleDiagramDoc) => {
    onChangeDiagramImage(null);
    onChangeDiagramText(sample.content);
    setUploadNotice(null);
  };

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Top Strategy & Sample Quick Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400">
            {isEn ? 'Samples:' : 'Hazır Süreçler:'}
          </span>
          {SAMPLE_ACTIVITY_DIAGRAMS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => handleSelectSample(sample)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 text-xs text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              title={sample.description}
            >
              {sample.title.split('&')[0].trim()}
            </button>
          ))}
        </div>

        {/* Coverage Strategy Segmented Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
            {isEn ? 'Coverage:' : 'Kapsam Stratejisi:'}
          </span>
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => onChangeCoverageStrategy('branch')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                coverageStrategy === 'branch'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isEn ? 'Branch & Decision' : 'Dal & Karar'}
            </button>
            <button
              type="button"
              onClick={() => onChangeCoverageStrategy('basis_path')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                coverageStrategy === 'basis_path'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isEn ? 'Basis Paths' : 'Temel Yollar'}
            </button>
            <button
              type="button"
              onClick={() => onChangeCoverageStrategy('full_e2e')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                coverageStrategy === 'full_e2e'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isEn ? 'Full E2E + Loops' : 'Tam Uçtan Uca + Döngü'}
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Split: Left Input (Image Dropzone + Notation Editor) / Right Visual Flow Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: Diagram Image Upload + Notation Input */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Image / Diagram File Upload & Clipboard Paste Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) processUploadedFile(file);
            }}
            className={`border border-dashed rounded-xl p-3.5 transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-950/20'
                : 'border-slate-700 hover:border-slate-500 bg-[#07090E]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,.mmd,.mermaid,.puml,.plantuml,.bpmn,.drawio,.xml,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processUploadedFile(f);
                e.target.value = '';
              }}
              className="hidden"
            />

            {diagramImage ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg border border-white/10 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                    <img
                      src={diagramImage.dataUrl}
                      alt={diagramImage.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{diagramImage.fileName}</p>
                    <p className="text-[11px] text-slate-400">
                      {isEn ? 'Diagram image ready for multimodal analysis' : 'Görsel çok modlu AI analizine hazır'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors whitespace-nowrap"
                  >
                    {isEn ? 'Replace' : 'Değiştir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDiagramImage(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title={isEn ? 'Remove image' : 'Görseli Kaldır'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {isEn
                        ? 'Upload Activity Diagram Image or File'
                        : 'Süreç / Activity Diagram Görseli veya Dosyası Yükle'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      PNG, JPG, SVG, Mermaid (.mmd), PlantUML (.puml), BPMN/Draw.io XML
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                  <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ctrl+V</span>
                </span>
              </div>
            )}
          </div>

          {uploadNotice && (
            <p className="text-xs text-rose-400 px-1">{uploadNotice}</p>
          )}

          {/* Diagram Syntax / Flow Text Editor */}
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {isEn
                    ? 'Mermaid / PlantUML / Process Flow Text (Optional if image uploaded)'
                    : 'Mermaid / PlantUML / Akış Notasyonu (Görsel varsa opsiyonel)'}
                </span>
              </label>
              {diagramText && (
                <button
                  type="button"
                  onClick={() => onChangeDiagramText('')}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                >
                  {isEn ? 'Clear' : 'Temizle'}
                </button>
              )}
            </div>
            <textarea
              value={diagramText}
              onChange={(e) => onChangeDiagramText(e.target.value)}
              rows={9}
              placeholder={
                isEn
                  ? 'flowchart TD\n  Start([Start]) --> Check{Valid Input?}\n  Check -->|Yes| Save[Save Record]\n  Check -->|No| Error([Show Error])\n\nOr paste PlantUML / BPMN XML / arrow steps (A -> B -> C)...'
                  : 'flowchart TD\n  Başla([Başla]) --> Kontrol{Girdi Geçerli mi?}\n  Kontrol -->|Evet| Kaydet[İşlemi Kaydet]\n  Kontrol -->|Hayır| Hata([Bitiş: Hata Göster])\n\nVeya PlantUML, BPMN/Draw.io XML ya da ok notasyonu (Adım 1 -> Adım 2) yapıştırın...'
              }
              className="w-full flex-1 min-h-[210px] bg-[#07090E] border border-white/10 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-y transition-colors"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 px-0.5 tabular-nums">
              <span>
                {diagramText.trim()
                  ? `${isEn ? 'Detected format' : 'Algılanan format'}: ${parsedDiagram.formatDetected.toUpperCase()}`
                  : isEn
                  ? 'Supports Mermaid, PlantUML, BPMN, Draw.io & arrows'
                  : 'Mermaid, PlantUML, BPMN, Draw.io ve ok gösterimi desteklenir'}
              </span>
              {parsedDiagram.nodes.length > 0 && (
                <span className="text-slate-400">
                  {parsedDiagram.nodes.length} {isEn ? 'nodes' : 'düğüm'} · {parsedDiagram.decisionCount}{' '}
                  {isEn ? 'decisions' : 'karar'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Flow Preview */}
        <div className="lg:col-span-6 flex flex-col">
          <DiagramFlowPreview
            parsedDiagram={parsedDiagram}
            imageDataUrl={diagramImage?.dataUrl || null}
            imageFileName={diagramImage?.fileName || null}
            isEn={isEn}
          />
        </div>
      </div>
    </div>
  );
};
