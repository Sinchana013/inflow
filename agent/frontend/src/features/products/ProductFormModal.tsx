import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Save,
  Loader2,
  Package,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Tag,
  DollarSign,
  Boxes,
  Building,
  Image as ImageIcon
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Product, ProductCreateInput } from '../../types';
import { AgentFormField } from './AgentFormField';

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: Product) => void;
  initialData?: Partial<ProductCreateInput>;
  isAgentControlled?: boolean;
  activeHighlightField?: string | null;
  completedFields?: string[];
  uncertainFields?: string[];
  statusMessage?: string | null;
  isSaving?: boolean;
}

const CATEGORIES = [
  'Electronics',
  'Furniture',
  'Office Supplies',
  'Apparel',
  'Fitness',
  'General'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData = {},
  isAgentControlled = false,
  activeHighlightField = null,
  completedFields = [],
  uncertainFields = [],
  statusMessage = null,
  isSaving: externalIsSaving = false
}) => {
  const [formData, setFormData] = useState<ProductCreateInput>({
    name: initialData.name || '',
    category: initialData.category || 'General',
    selling_price: initialData.selling_price ?? 0,
    unit_cost: initialData.unit_cost ?? 0,
    stock_quantity: initialData.stock_quantity ?? 0,
    reorder_threshold: initialData.reorder_threshold ?? 10,
    sku: initialData.sku || '',
    barcode: initialData.barcode || '',
    description: initialData.description || '',
    supplier: initialData.supplier || '',
    image_url: initialData.image_url || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Synchronize when initialData changes (e.g. progressive agent typing)
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData
      }));
    }
  }, [initialData]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Category is required';
    }

    if (isNaN(Number(formData.selling_price)) || Number(formData.selling_price) < 0) {
      newErrors.selling_price = 'Price must be a valid positive number';
    }

    if (isNaN(Number(formData.unit_cost)) || Number(formData.unit_cost) < 0) {
      newErrors.unit_cost = 'Cost must be a valid positive number';
    }

    if (isNaN(Number(formData.stock_quantity)) || Number(formData.stock_quantity) < 0) {
      newErrors.stock_quantity = 'Stock quantity cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    try {
      setSaving(true);
      const payload: ProductCreateInput = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        selling_price: Number(formData.selling_price),
        unit_cost: Number(formData.unit_cost),
        stock_quantity: Number(formData.stock_quantity || 0),
        reorder_threshold: Number(formData.reorder_threshold || 10),
        sku: formData.sku?.trim() || undefined,
        barcode: formData.barcode?.trim() || undefined,
        description: formData.description?.trim() || undefined,
        supplier: formData.supplier?.trim() || undefined,
        image_url: formData.image_url?.trim() || undefined
      };

      const created = await apiClient.createProduct(payload);
      setSuccessToast(`Product "${created.name}" created successfully!`);
      setTimeout(() => {
        onSuccess(created);
        onClose();
      }, 700);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save product.';
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  const isFieldActive = (field: string) => activeHighlightField === field;
  const isFieldCompleted = (field: string) => completedFields.includes(field);
  const isFieldUncertain = (field: string) => uncertainFields.includes(field);

  const isSaveActive = activeHighlightField === 'save' || externalIsSaving;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAgentControlled ? 'AI Agent Populating Product' : 'Add New Product'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAgentControlled
                  ? 'The agent is operating the live form through shared application state'
                  : 'Create a new product in the catalog with real-time validation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Agent Operational Banner */}
        {isAgentControlled && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="text-xs font-bold text-emerald-900">
                {statusMessage || 'Live Agent Interaction in Progress'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700">
              {completedFields.length} fields populated
            </span>
          </div>
        )}

        {/* Error / Success Banners */}
        {serverError && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {successToast && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Row 1: Product Name */}
          <AgentFormField
            label="Product Name"
            name="name"
            required
            isActive={isFieldActive('name')}
            isCompleted={isFieldCompleted('name')}
            isUncertain={isFieldUncertain('name')}
            hasError={errors.name}
            hint="Full commercial or descriptive product name"
          >
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ergonomic Bluetooth Mouse"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </AgentFormField>

          {/* Row 2: SKU and Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AgentFormField
              label="SKU (Stock Keeping Unit)"
              name="sku"
              isActive={isFieldActive('sku')}
              isCompleted={isFieldCompleted('sku')}
              isUncertain={isFieldUncertain('sku')}
              hasError={errors.sku}
              hint="Unique inventory identifier (e.g. #123, SKU-092)"
            >
              <input
                id="sku"
                type="text"
                value={formData.sku || ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. SKU-88219"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </AgentFormField>

            <AgentFormField
              label="Barcode / UPC / EAN"
              name="barcode"
              isActive={isFieldActive('barcode')}
              isCompleted={isFieldCompleted('barcode')}
              isUncertain={isFieldUncertain('barcode')}
              hasError={errors.barcode}
              hint="Optical barcode or standard UPC/EAN code"
            >
              <input
                id="barcode"
                type="text"
                value={formData.barcode || ''}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="e.g. 719284019283"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </AgentFormField>
          </div>

          {/* Row 3: Category & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AgentFormField
              label="Category"
              name="category"
              required
              isActive={isFieldActive('category')}
              isCompleted={isFieldCompleted('category')}
              isUncertain={isFieldUncertain('category')}
              hasError={errors.category}
              hint="Product classification"
            >
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </AgentFormField>

            <AgentFormField
              label="Supplier / Vendor"
              name="supplier"
              isActive={isFieldActive('supplier')}
              isCompleted={isFieldCompleted('supplier')}
              isUncertain={isFieldUncertain('supplier')}
              hasError={errors.supplier}
              hint="Identifiable manufacturer or distributor"
            >
              <input
                id="supplier"
                type="text"
                value={formData.supplier || ''}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="e.g. Apex Manufacturing Corp"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </AgentFormField>
          </div>

          {/* Row 4: Pricing & Quantities */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AgentFormField
              label="Selling Price ($)"
              name="selling_price"
              required
              isActive={isFieldActive('selling_price') || isFieldActive('price')}
              isCompleted={isFieldCompleted('selling_price') || isFieldCompleted('price')}
              isUncertain={isFieldUncertain('selling_price') || isFieldUncertain('price')}
              hasError={errors.selling_price}
              hint="Unit retail price"
            >
              <input
                id="selling_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </AgentFormField>

            <AgentFormField
              label="Unit Cost ($)"
              name="unit_cost"
              required
              isActive={isFieldActive('unit_cost') || isFieldActive('cost')}
              isCompleted={isFieldCompleted('unit_cost') || isFieldCompleted('cost')}
              isUncertain={isFieldUncertain('unit_cost') || isFieldUncertain('cost')}
              hasError={errors.unit_cost}
              hint="COGS per unit"
            >
              <input
                id="unit_cost"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </AgentFormField>

            <AgentFormField
              label="Initial Quantity"
              name="stock_quantity"
              isActive={isFieldActive('stock_quantity') || isFieldActive('quantity')}
              isCompleted={isFieldCompleted('stock_quantity') || isFieldCompleted('quantity')}
              isUncertain={isFieldUncertain('stock_quantity') || isFieldUncertain('quantity')}
              hasError={errors.stock_quantity}
              hint="Warehouse inventory on hand"
            >
              <input
                id="stock_quantity"
                type="number"
                step="1"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </AgentFormField>
          </div>

          {/* Row 5: Description & Image URL */}
          <AgentFormField
            label="Product Description"
            name="description"
            isActive={isFieldActive('description')}
            isCompleted={isFieldCompleted('description')}
            isUncertain={isFieldUncertain('description')}
            hasError={errors.description}
            hint="Optional detailed catalog copy or specifications"
          >
            <textarea
              id="description"
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. 100% combed cotton, regular fit..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none"
            />
          </AgentFormField>

          <AgentFormField
            label="Product Image URL"
            name="image_url"
            isActive={isFieldActive('image_url')}
            isCompleted={isFieldCompleted('image_url')}
            isUncertain={isFieldUncertain('image_url')}
            hasError={errors.image_url}
            hint="Optional link to hosted product image"
          >
            <input
              id="image_url"
              type="text"
              value={formData.image_url || ''}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://example.com/images/product.jpg"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </AgentFormField>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || externalIsSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="save-product-button"
              type="submit"
              disabled={saving || externalIsSaving}
              className={`inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg transition-all duration-300 shadow-sm cursor-pointer ${
                isSaveActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-300 scale-105'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saving || externalIsSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaveActive ? 'Agent Saving Product...' : 'Save Product'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
