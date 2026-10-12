import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import {
  ExtractedProductItem,
  DuplicateCheckResult,
  DocumentExtractResponse,
  ProductCreateInput,
  Product
} from '../types';

export type AgentWorkflowStep =
  | 'idle'
  | 'upload'
  | 'extracting'
  | 'review'
  | 'filling'
  | 'complete'
  | 'error';

export interface ResultsSummary {
  added: Array<{ name: string; sku: string; price: number }>;
  skipped: Array<{ name: string; sku: string; reason: string }>;
  flagged: Array<{ name: string; sku: string; reason: string }>;
  errors: Array<{ name: string; error: string }>;
}

export interface ProductAgentContextType {
  // Window State
  isAgentWindowOpen: boolean;
  openAgentWindow: (file?: File) => void;
  closeAgentWindow: () => void;
  isMinimized: boolean;
  setIsMinimized: (val: boolean) => void;

  // Workflow State
  step: AgentWorkflowStep;
  uploadedFile: File | null;
  previewUrl: string | null;
  errorMessage: string | null;
  extractionResponse: DocumentExtractResponse | null;
  duplicateResults: DuplicateCheckResult[];
  confirmedIndices: number[];
  unrelatedData: Record<string, any>;

  // Form Automation State (Live Visual Form Filling)
  isFormModalOpen: boolean;
  openFormModal: () => void;
  closeFormModal: () => void;
  isAgentDrivingForm: boolean;
  activeFormField: string | null;
  completedFormFields: string[];
  activeFormData: Partial<ProductCreateInput>;
  currentProcessingIndex: number;
  resultsSummary: ResultsSummary;

  // Actions
  handleFileUpload: (file: File) => Promise<void>;
  toggleConfirmIndex: (index: number) => void;
  updateExtractedItem: (index: number, updated: Partial<ExtractedProductItem>) => void;
  runVisualFormFilling: (navigateFn: (path: string) => void) => Promise<void>;
  resetAgent: () => void;
  retrySaveCurrentItem: () => Promise<void>;
}

const ProductAgentContext = createContext<ProductAgentContextType | undefined>(undefined);

// Delay helper for sequential, visual typing action steps
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ProductAgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAgentWindowOpen, setIsAgentWindowOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [step, setStep] = useState<AgentWorkflowStep>('idle');

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [extractionResponse, setExtractionResponse] = useState<DocumentExtractResponse | null>(null);
  const [duplicateResults, setDuplicateResults] = useState<DuplicateCheckResult[]>([]);
  const [confirmedIndices, setConfirmedIndices] = useState<number[]>([]);
  const [unrelatedData, setUnrelatedData] = useState<Record<string, any>>({});

  // Form automation state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isAgentDrivingForm, setIsAgentDrivingForm] = useState(false);
  const [activeFormField, setActiveFormField] = useState<string | null>(null);
  const [completedFormFields, setCompletedFormFields] = useState<string[]>([]);
  const [activeFormData, setActiveFormData] = useState<Partial<ProductCreateInput>>({});
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);

  const [resultsSummary, setResultsSummary] = useState<ResultsSummary>({
    added: [],
    skipped: [],
    flagged: [],
    errors: []
  });

  const abortFillingRef = useRef(false);

  const openAgentWindow = useCallback((file?: File) => {
    setIsAgentWindowOpen(true);
    setIsMinimized(false);
    if (file) {
      handleFileUpload(file);
    } else if (step === 'idle') {
      setStep('upload');
    }
  }, [step]);

  const closeAgentWindow = useCallback(() => {
    setIsAgentWindowOpen(false);
  }, []);

  const openFormModal = useCallback(() => {
    setIsAgentDrivingForm(false);
    setActiveFormField(null);
    setCompletedFormFields([]);
    setActiveFormData({});
    setIsFormModalOpen(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setIsFormModalOpen(false);
    setIsAgentDrivingForm(false);
  }, []);

  const resetAgent = useCallback(() => {
    setStep('upload');
    setUploadedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setErrorMessage(null);
    setExtractionResponse(null);
    setDuplicateResults([]);
    setConfirmedIndices([]);
    setUnrelatedData({});
    setIsAgentDrivingForm(false);
    setIsFormModalOpen(false);
    setActiveFormField(null);
    setCompletedFormFields([]);
    setActiveFormData({});
    setCurrentProcessingIndex(0);
    setResultsSummary({ added: [], skipped: [], flagged: [], errors: [] });
  }, [previewUrl]);

  const handleFileUpload = async (file: File) => {
    try {
      setErrorMessage(null);
      setUploadedFile(file);
      setStep('extracting');
      setIsAgentWindowOpen(true);

      // Create preview URL if image or PDF
      if (file.type.startsWith('image/') || file.name.endsWith('.pdf')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      // Step 1: Call vision extraction endpoint
      const extractRes = await apiClient.extractProductsFromImage(file);
      setExtractionResponse(extractRes);

      if (!extractRes.success) {
        setErrorMessage(extractRes.error || 'Vision analysis could not be completed.');
        setStep('error');
        return;
      }

      if (!extractRes.extracted_items || extractRes.extracted_items.length === 0) {
        setErrorMessage('No product items could be extracted from this document.');
        setStep('error');
        return;
      }

      setUnrelatedData(extractRes.unrelated_data_detected || {});

      // Step 2: Check for existing products in database
      const dupRes = await apiClient.checkProductDuplicates(extractRes.extracted_items);
      setDuplicateResults(dupRes.results);

      // Auto-select items that are classified as "new_product"
      const defaultConfirmed: number[] = [];
      dupRes.results.forEach((r, idx) => {
        if (r.status === 'new_product') {
          defaultConfirmed.push(idx);
        }
      });
      setConfirmedIndices(defaultConfirmed);

      setStep('review');
    } catch (err: any) {
      console.error('File upload & extraction failed', err);
      const msg = err.response?.data?.detail || err.message || 'Failed to process document.';
      setErrorMessage(msg);
      setStep('error');
    }
  };

  const toggleConfirmIndex = useCallback((index: number) => {
    setConfirmedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }, []);

  const updateExtractedItem = useCallback((index: number, updated: Partial<ExtractedProductItem>) => {
    setDuplicateResults((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          item: {
            ...next[index].item,
            ...updated
          }
        };
      }
      return next;
    });
  }, []);

  // Visual Form Filling Workflow
  const runVisualFormFilling = async (navigateFn: (path: string) => void) => {
    if (confirmedIndices.length === 0) return;

    abortFillingRef.current = false;
    setStep('filling');
    setIsAgentDrivingForm(true);

    // 1. Ensure user is navigated to Products page
    navigateFn('/products');
    await delay(300);

    const summary: ResultsSummary = {
      added: [],
      skipped: [],
      flagged: [],
      errors: []
    };

    // Record skipped items
    duplicateResults.forEach((res, idx) => {
      if (!confirmedIndices.includes(idx)) {
        if (res.status === 'already_exists') {
          summary.skipped.push({
            name: res.item.name,
            sku: res.item.sku || 'N/A',
            reason: res.match_reason || 'Product already exists in catalog'
          });
        } else if (res.status === 'possible_duplicate') {
          summary.flagged.push({
            name: res.item.name,
            sku: res.item.sku || 'N/A',
            reason: res.match_reason || 'Possible duplicate flagged for review'
          });
        } else {
          summary.skipped.push({
            name: res.item.name,
            sku: res.item.sku || 'N/A',
            reason: 'Deselected by user'
          });
        }
      }
    });

    // 2. Sequentially fill each confirmed product into the real React form
    for (let cIdx = 0; cIdx < confirmedIndices.length; cIdx++) {
      if (abortFillingRef.current) break;

      const itemIdx = confirmedIndices[cIdx];
      setCurrentProcessingIndex(cIdx);
      const { item } = duplicateResults[itemIdx];

      // Open the actual controlled product form modal
      setIsFormModalOpen(true);
      setActiveFormData({
        name: '',
        category: 'General',
        selling_price: 0,
        unit_cost: 0,
        stock_quantity: 0,
        reorder_threshold: 10,
        sku: '',
        barcode: '',
        description: '',
        supplier: '',
        image_url: ''
      });
      setCompletedFormFields([]);
      await delay(400);

      // Define visual step sequence
      const fieldSequence: Array<{
        key: keyof ProductCreateInput;
        value: any;
        fieldLabel: string;
      }> = [
        { key: 'name', value: item.name, fieldLabel: 'Product Name' },
        { key: 'sku', value: item.sku || '', fieldLabel: 'SKU' },
        { key: 'category', value: item.category || 'Apparel', fieldLabel: 'Category' },
        { key: 'selling_price', value: item.price ?? 10.0, fieldLabel: 'Selling Price' },
        { key: 'unit_cost', value: item.cost ?? (item.price ? item.price * 0.5 : 5.0), fieldLabel: 'Unit Cost' },
        { key: 'stock_quantity', value: item.quantity ?? 1, fieldLabel: 'Initial Quantity' },
        { key: 'supplier', value: item.supplier || '', fieldLabel: 'Supplier' },
        { key: 'description', value: item.description || item.name, fieldLabel: 'Description' }
      ];

      const currentFormState: Partial<ProductCreateInput> = {};
      const completed: string[] = [];

      // Step through each field with visual green highlight
      for (const stepInfo of fieldSequence) {
        if (abortFillingRef.current) break;

        setActiveFormField(stepInfo.key as string);
        await delay(250);

        // Populate the value into React controlled state
        currentFormState[stepInfo.key] = stepInfo.value;
        setActiveFormData({ ...currentFormState });
        completed.push(stepInfo.key as string);
        setCompletedFormFields([...completed]);
        await delay(250);
      }

      // Highlight the Save button
      setActiveFormField('save');
      await delay(400);

      // Execute actual backend creation
      try {
        const payload: ProductCreateInput = {
          name: currentFormState.name || item.name,
          category: currentFormState.category || item.category || 'General',
          selling_price: Number(currentFormState.selling_price ?? item.price ?? 0),
          unit_cost: Number(currentFormState.unit_cost ?? item.cost ?? (item.price ? item.price * 0.5 : 0)),
          stock_quantity: Number(currentFormState.stock_quantity ?? item.quantity ?? 1),
          reorder_threshold: Number(currentFormState.reorder_threshold ?? 10),
          sku: currentFormState.sku || item.sku || undefined,
          barcode: currentFormState.barcode || item.barcode || undefined,
          description: currentFormState.description || item.description || undefined,
          supplier: currentFormState.supplier || item.supplier || undefined,
          image_url: currentFormState.image_url || item.image_url || undefined
        };

        const created = await apiClient.createProduct(payload);
        summary.added.push({
          name: created.name,
          sku: created.sku || 'N/A',
          price: created.selling_price
        });

        // Trigger catalog refresh custom event
        window.dispatchEvent(new CustomEvent('insightflow-refresh-data'));

        // If this is the last processed item, navigate and highlight with modal
        if (cIdx === confirmedIndices.length - 1) {
          navigateFn(`/products?highlight=${created.id}&modal=true`);
        }

        await delay(500);
      } catch (saveErr: any) {
        const errDetail = saveErr.response?.data?.detail || saveErr.message || 'Database save failed';
        summary.errors.push({
          name: item.name,
          error: errDetail
        });
        await delay(500);
      }

      // Close the modal before next item
      setIsFormModalOpen(false);
      setActiveFormField(null);
      await delay(300);
    }

    setResultsSummary(summary);
    setIsAgentDrivingForm(false);
    setStep('complete');
  };

  const retrySaveCurrentItem = async () => {
    // Retry current step if needed
    setStep('review');
  };

  return (
    <ProductAgentContext.Provider
      value={{
        isAgentWindowOpen,
        openAgentWindow,
        closeAgentWindow,
        isMinimized,
        setIsMinimized,
        step,
        uploadedFile,
        previewUrl,
        errorMessage,
        extractionResponse,
        duplicateResults,
        confirmedIndices,
        unrelatedData,
        isFormModalOpen,
        openFormModal,
        closeFormModal,
        isAgentDrivingForm,
        activeFormField,
        completedFormFields,
        activeFormData,
        currentProcessingIndex,
        resultsSummary,
        handleFileUpload,
        toggleConfirmIndex,
        updateExtractedItem,
        runVisualFormFilling,
        resetAgent,
        retrySaveCurrentItem
      }}
    >
      {children}
    </ProductAgentContext.Provider>
  );
};

export const useProductAgent = (): ProductAgentContextType => {
  const context = useContext(ProductAgentContext);
  if (!context) {
    throw new Error('useProductAgent must be used within a ProductAgentProvider');
  }
  return context;
};
