import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Eye,
  X,
  FileCheck,
  ShieldCheck,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import { FloatingWindow } from '../../components/FloatingWindow';
import { useProductAgent } from '../../context/ProductAgentContext';

const CATEGORIES = [
  'Electronics',
  'Furniture',
  'Office Supplies',
  'Apparel',
  'Fitness',
  'General'
];

export const FloatingProductAgent: React.FC = () => {
  const {
    isAgentWindowOpen,
    closeAgentWindow,
    isMinimized,
    setIsMinimized,
    step,
    uploadedFile,
    previewUrl,
    errorMessage,
    duplicateResults,
    confirmedIndices,
    unrelatedData,
    toggleConfirmIndex,
    updateExtractedItem,
    runVisualFormFilling,
    resetAgent,
    handleFileUpload,
    currentProcessingIndex,
    resultsSummary,
    isAgentDrivingForm
  } = useProductAgent();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUnrelated, setShowUnrelated] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isAgentWindowOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Provide synthetic demo packing slip file creation for instant testing
  const handleLoadSamplePackingSlip = () => {
    const sampleText = `PACKING SLIP & INVOICE
Vendor: Apex Garments Co.
Order #: PO-88219
Tracking #: TRK-9872149
Customer: InsightFlow Enterprise
Date: Oct 11, 2026

LINE ITEMS:
SKU: #123
Description: Blue T-shirt
Quantity: 1
Price: $10.00

SKU: #124
Description: Red T-shirt
Quantity: 1
Price: $12.00

SUMMARY:
Shipping: $15.00
Grand Total: $37.00`;

    const blob = new Blob([sampleText], { type: 'text/plain' });
    const file = new File([blob], 'packing_slip_sample.txt', { type: 'text/plain' });
    handleFileUpload(file);
  };

  return (
    <FloatingWindow
      id="floating-product-agent"
      isOpen={isAgentWindowOpen}
      onClose={closeAgentWindow}
      isMinimized={isMinimized}
      onToggleMinimize={setIsMinimized}
      maxWidth="3xl"
      title={
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>AI Product Creation Agent</span>
        </div>
      }
      subtitle={
        step === 'upload'
          ? 'Upload documents to automatically extract & catalog products'
          : step === 'extracting'
          ? 'Extracting product line items & verifying catalog duplicates...'
          : step === 'review'
          ? 'Review extracted items and duplicate-check results before adding'
          : step === 'filling'
          ? 'Live form interaction: Populating Products page form'
          : step === 'complete'
          ? 'Extraction and catalog creation summary'
          : 'Document extraction error'
      }
      headerPrefix={
        <span className="flex h-2.5 w-2.5 relative">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              step === 'filling'
                ? 'bg-emerald-400'
                : step === 'error'
                ? 'bg-rose-400'
                : 'bg-blue-400'
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              step === 'filling'
                ? 'bg-emerald-600'
                : step === 'error'
                ? 'bg-rose-600'
                : 'bg-blue-600'
            }`}
          ></span>
        </span>
      }
    >
      {/* ---------------- STEP 1: UPLOAD ---------------- */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01]'
                : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Drag & Drop your Packing Slip or Product Document
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Supports packing slips, invoices, purchase orders, product labels, and bills of lading
              (PNG, JPEG, WEBP, PDF).
            </p>
            <div className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors">
              <FileText className="w-3.5 h-3.5" />
              <span>Browse Files from Computer</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">Need to test immediately?</span>
            <button
              type="button"
              onClick={handleLoadSamplePackingSlip}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Load sample packing slip (#123 Blue T-shirt, #124 Red T-shirt)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 2: EXTRACTING & VERIFYING ---------------- */}
      {step === 'extracting' && (
        <div className="py-8 text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin" />
            <Sparkles className="w-6 h-6 text-emerald-600 absolute inset-0 m-auto animate-pulse" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800">Analyzing Document with AI Vision</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Parsing line items, isolating product identifiers from shipping fees and order totals,
              and checking catalog uniqueness...
            </p>
          </div>

          {uploadedFile && (
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">{uploadedFile.name}</span>
              <span className="text-slate-400">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          {previewUrl && (
            <div className="mt-3 max-w-xs mx-auto border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <img
                src={previewUrl}
                alt="Document Preview"
                className="w-full max-h-40 object-cover"
              />
            </div>
          )}
        </div>
      )}

      {/* ---------------- STEP 3: REVIEW & DUPLICATE CHECK ---------------- */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Header banner with file details & preview toggle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-800">{uploadedFile?.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {duplicateResults.length} Items Detected
              </span>
            </div>

            <button
              type="button"
              onClick={resetAgent}
              className="text-xs text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Upload Different File
            </button>
          </div>

          {/* Unrelated Document Data Disclosure (Shipping, Totals, Addresses) */}
          {Object.keys(unrelatedData).length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 text-xs">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowUnrelated(!showUnrelated)}
              >
                <div className="flex items-center space-x-2 text-amber-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Unrelated Document Metadata Isolated</span>
                </div>
                {showUnrelated ? (
                  <ChevronUp className="w-4 h-4 text-amber-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-700" />
                )}
              </div>

              {showUnrelated && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-200/60 grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                  {unrelatedData.tracking_number && (
                    <div>
                      <span className="text-slate-400">Tracking #:</span>{' '}
                      <span className="font-semibold">{unrelatedData.tracking_number}</span>
                    </div>
                  )}
                  {unrelatedData.order_number && (
                    <div>
                      <span className="text-slate-400">Order/PO #:</span>{' '}
                      <span className="font-semibold">{unrelatedData.order_number}</span>
                    </div>
                  )}
                  {unrelatedData.shipping_charge !== undefined && (
                    <div>
                      <span className="text-slate-400">Shipping Fee:</span>{' '}
                      <span className="font-semibold">${unrelatedData.shipping_charge} (Ignored)</span>
                    </div>
                  )}
                  {unrelatedData.invoice_total !== undefined && (
                    <div>
                      <span className="text-slate-400">Invoice Total:</span>{' '}
                      <span className="font-semibold">${unrelatedData.invoice_total} (Ignored)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* List of Extracted Product Items with Duplicate Classifications */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Extracted Line Items & Catalog Check
            </h5>

            {duplicateResults.map((result, idx) => {
              const isConfirmed = confirmedIndices.includes(idx);
              const { item, status, match_reason } = result;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    status === 'already_exists'
                      ? 'border-slate-200 bg-slate-50/60 opacity-80'
                      : status === 'possible_duplicate'
                      ? 'border-amber-200 bg-amber-50/30'
                      : isConfirmed
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      {/* Checkbox for user confirmation */}
                      <input
                        type="checkbox"
                        checked={isConfirmed}
                        onChange={() => toggleConfirmIndex(idx)}
                        disabled={status === 'already_exists'}
                        className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                      />

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{item.name}</span>

                          {/* Status Badge */}
                          {status === 'already_exists' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                              Already Exists (Skipped)
                            </span>
                          )}
                          {status === 'new_product' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Ready to Add
                            </span>
                          )}
                          {status === 'possible_duplicate' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Possible Duplicate
                            </span>
                          )}
                          {status === 'insufficient_info' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Insufficient Info
                            </span>
                          )}
                        </div>

                        {/* Match Reason explanation */}
                        {match_reason && (
                          <p className="text-[11px] text-slate-500 mt-0.5 italic">
                            {match_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Extracted Price & Quantity */}
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-slate-900">
                        ${item.price?.toFixed(2) ?? '0.00'}
                      </span>
                      <p className="text-[11px] text-slate-500">Qty: {item.quantity ?? 1}</p>
                    </div>
                  </div>

                  {/* Editable Field Attributes (Full Add Product Schema) */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Product Name *</span>
                        <input
                          type="text"
                          value={item.name || ''}
                          onChange={(e) => updateExtractedItem(idx, { name: e.target.value })}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Product Name..."
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Category *</span>
                        <select
                          value={item.category || 'General'}
                          onChange={(e) => updateExtractedItem(idx, { category: e.target.value })}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Selling Price ($) *</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price ?? 0}
                          onChange={(e) =>
                            updateExtractedItem(idx, { price: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Unit Cost ($) *</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.cost ?? (item.price ? item.price * 0.5 : 0)}
                          onChange={(e) =>
                            updateExtractedItem(idx, { cost: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Initial Qty</span>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity ?? 1}
                          onChange={(e) =>
                            updateExtractedItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Reorder Threshold</span>
                        <input
                          type="number"
                          min="0"
                          value={(item as any).reorder_threshold ?? 10}
                          onChange={(e) =>
                            updateExtractedItem(idx, { ...(item as any), reorder_threshold: parseInt(e.target.value, 10) || 10 })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">SKU</span>
                        <input
                          type="text"
                          value={item.sku || ''}
                          onChange={(e) => updateExtractedItem(idx, { sku: e.target.value })}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Auto-generated if blank..."
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Barcode</span>
                        <input
                          type="text"
                          value={item.barcode || ''}
                          onChange={(e) => updateExtractedItem(idx, { barcode: e.target.value })}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          placeholder="UPC / EAN..."
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-medium">Supplier</span>
                        <input
                          type="text"
                          value={item.supplier || ''}
                          onChange={(e) => updateExtractedItem(idx, { supplier: e.target.value })}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Vendor Name..."
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-medium">Description</span>
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => updateExtractedItem(idx, { description: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Product specifications / description..."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {confirmedIndices.length} product{confirmedIndices.length === 1 ? '' : 's'} ready
              to add
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={resetAgent}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={confirmedIndices.length === 0}
                onClick={() => runVisualFormFilling(navigate)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Correct — Create Product{confirmedIndices.length > 1 ? `s (${confirmedIndices.length})` : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STEP 4: LIVE FORM FILLING ---------------- */}
      {step === 'filling' && (
        <div className="py-6 space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-600 text-white rounded-lg animate-pulse">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  Visual Form Interaction in Progress
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Populating confirmed product {currentProcessingIndex + 1} of{' '}
                  {confirmedIndices.length} on the Products Page
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-emerald-900">
                {Math.round(((currentProcessingIndex + 1) / confirmedIndices.length) * 100)}%
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Products Page form opened and synchronized</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Green highlights tracking active field data population</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Backend validation and database uniqueness checks active</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            You can move this window freely or interact with the background dashboard while the agent
            works.
          </p>
        </div>
      )}

      {/* ---------------- STEP 5: COMPLETE REPORT ---------------- */}
      {step === 'complete' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-emerald-950">Workflow Completed Successfully</h4>
            <p className="text-xs text-emerald-800">
              All confirmed products were populated and saved to the live catalog.
            </p>
          </div>

          {/* Breakdown summary */}
          <div className="space-y-2 text-xs">
            {/* Added */}
            {resultsSummary.added.length > 0 && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-emerald-700">
                  Added to Catalog ({resultsSummary.added.length})
                </span>
                {resultsSummary.added.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-slate-700">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-slate-500 font-mono text-[11px]">SKU: {item.sku}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Skipped */}
            {resultsSummary.skipped.length > 0 && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                  Skipped (Existing / Deselected) ({resultsSummary.skipped.length})
                </span>
                {resultsSummary.skipped.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-slate-600">
                    <span>{item.name}</span>
                    <span className="text-[11px] text-slate-400 italic">{item.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Flagged */}
            {resultsSummary.flagged.length > 0 && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-amber-700">
                  Flagged for Review ({resultsSummary.flagged.length})
                </span>
                {resultsSummary.flagged.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-slate-600">
                    <span>{item.name}</span>
                    <span className="text-[11px] text-amber-600">{item.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Errors */}
            {resultsSummary.errors.length > 0 && (
              <div className="p-3 bg-white border border-rose-200 rounded-xl space-y-1">
                <span className="font-bold text-rose-700 text-[11px] uppercase tracking-wider">
                  Save Failures ({resultsSummary.errors.length})
                </span>
                {resultsSummary.errors.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-rose-700">
                    <span>{item.name}</span>
                    <span className="text-[11px]">{item.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={resetAgent}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Process Another Document
            </button>
            <button
              type="button"
              onClick={closeAgentWindow}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ---------------- STEP 6: ERROR ---------------- */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-xs text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-rose-950">Document Analysis Error</h5>
              <p className="mt-1 leading-relaxed">{errorMessage}</p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={handleLoadSamplePackingSlip}
              className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              Test with Sample Document
            </button>
            <button
              type="button"
              onClick={resetAgent}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Try Again / Choose Another File
            </button>
            <button
              type="button"
              onClick={closeAgentWindow}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </FloatingWindow>
  );
};
