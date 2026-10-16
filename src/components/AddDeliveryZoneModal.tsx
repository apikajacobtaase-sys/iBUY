// src/components/AddDeliveryZoneModal.tsx
"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Search, Check } from "lucide-react";

interface Locality {
  id: string;
  name: string;
  district: { name: string; region: { name: string } };
}

interface DeliveryZone {
  id: string;
  name: string;
  status: string;
  baseDeliveryFee: number;
  minOrderValue: number | null;
  codEnabled: boolean;
  estimatedDays: number | null;
  localities: { locality: Locality }[];
}

interface AddDeliveryZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: DeliveryZone | null; // 👈 Added for Edit mode
}

export default function AddDeliveryZoneModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialData = null // 👈 Default to null
}: AddDeliveryZoneModalProps) {
  const [loading, setLoading] = useState(false);
  const [allLocalities, setAllLocalities] = useState<Locality[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocalities, setSelectedLocalities] = useState<string[]>([]);

  const isEditing = !!initialData;

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    status: initialData?.status || "ACTIVE",
    baseDeliveryFee: initialData?.baseDeliveryFee?.toString() || "",
    minOrderValue: initialData?.minOrderValue?.toString() || "",
    codEnabled: initialData?.codEnabled ?? true,
    onlinePayEnabled: true, 
    estimatedDays: initialData?.estimatedDays?.toString() || "",
    notes: "", 
  });
     // Fetch all localities and reset/pre-fill form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      fetchAllLocalities();
      
      if (initialData) {
        // 👇 EDIT MODE: Pre-fill the form with existing data
        setFormData({
          name: initialData.name || "",
          status: initialData.status || "ACTIVE",
          baseDeliveryFee: initialData.baseDeliveryFee?.toString() || "",
          minOrderValue: initialData.minOrderValue?.toString() || "",
          codEnabled: initialData.codEnabled ?? true,
          onlinePayEnabled: true,
          estimatedDays: initialData.estimatedDays?.toString() || "",
          notes: "",
        });
        
        // Pre-select the localities that are already in this zone
        const initialSelected = initialData.localities.map((loc: any) => loc.locality.id);
        setSelectedLocalities(initialSelected);
      } else {
        // 👇 CREATE MODE: Completely reset the form
        setFormData({
          name: "",
          status: "ACTIVE",
          baseDeliveryFee: "",
          minOrderValue: "",
          codEnabled: true,
          onlinePayEnabled: true,
          estimatedDays: "",
          notes: "",
        });
        setSelectedLocalities([]);
      }
    }
  }, [isOpen, initialData]); // 👈 Crucial: depends on initialData
  const fetchAllLocalities = async () => {
    try {
      const regionsRes = await fetch("/api/locations/regions");
      const regionsData = await regionsRes.json();

      const allLocs: Locality[] = [];
      for (const region of regionsData.regions) {
        const districtsRes = await fetch(`/api/locations/districts?regionId=${region.id}`);
        const districtsData = await districtsRes.json();

        for (const district of districtsData.districts) {
          const localitiesRes = await fetch(`/api/locations/localities?districtId=${district.id}`);
          const localitiesData = await localitiesRes.json();

          const enriched = localitiesData.localities.map((loc: any) => ({
            ...loc,
            district: { name: district.name, region: { name: region.name } },
          }));

          allLocs.push(...enriched);
        }
      }

      setAllLocalities(allLocs);
    } catch (error) {
      console.error("Failed to fetch localities", error);
    }
  };

  const filteredLocalities = allLocalities.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.district.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.district.region.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleLocality = (id: string) => {
    setSelectedLocalities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedLocalities.length === 0) {
      alert("Please select at least one locality");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: formData.name,
        status: formData.status,
        baseDeliveryFee: parseFloat(formData.baseDeliveryFee),
        minOrderValue: formData.minOrderValue ? parseFloat(formData.minOrderValue) : null,
        codEnabled: formData.codEnabled,
        estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays) : null,
        localityIds: selectedLocalities,
      };

      // 👈 If editing, include the zoneId for the PATCH request
      if (isEditing) {
        payload.zoneId = initialData.id;
      }
          console.log("🔍 isEditing:", isEditing);
      console.log("🔍 initialData:", initialData);
      console.log("🔍 Final Payload being sent:", payload);
      const res = await fetch("/api/admin/delivery/zones", {
        method: isEditing ? "PATCH" : "POST", // 👈 Dynamic method
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(isEditing ? "Delivery zone updated successfully!" : "Delivery zone created successfully!");
        onSuccess();
        onClose();
        
        // 👈 Only reset form if we are creating a new one
        if (!isEditing) {
          setFormData({
            name: "",
            status: "ACTIVE",
            baseDeliveryFee: "",
            minOrderValue: "",
            codEnabled: true,
            onlinePayEnabled: true,
            estimatedDays: "",
            notes: "",
          });
          setSelectedLocalities([]);
          setSearchQuery("");
        }
      } else {
        const data = await res.json();
        alert(data.error || (isEditing ? "Failed to update zone" : "Failed to create zone"));
      }
    } catch (error) {
      alert(isEditing ? "Failed to update zone" : "Failed to create zone");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Delivery Zone" : "Add Delivery Zone"} {/* 👈 Dynamic Title */}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Zone Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Zone Details</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Zone Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Greater Accra Express"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="RESTRICTED">Restricted</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TEMPORARILY_UNAVAILABLE">Temporarily Unavailable</option>
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Pricing</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Base Delivery Fee (GH₵) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.baseDeliveryFee}
                  onChange={(e) => setFormData({ ...formData, baseDeliveryFee: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="15.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Minimum Order Value (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="50.00 (optional)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Estimated Delivery Time (days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimatedDays}
                onChange={(e) => setFormData({ ...formData, estimatedDays: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="2"
              />
            </div>
          </div>

          {/* Payment Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Payment Options</h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.codEnabled}
                  onChange={(e) => setFormData({ ...formData, codEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Cash on Delivery</p>
                  <p className="text-xs text-gray-500">Allow customers to pay when they receive their order</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.onlinePayEnabled}
                  onChange={(e) => setFormData({ ...formData, onlinePayEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Online Payment</p>
                  <p className="text-xs text-gray-500">Allow customers to pay via Paystack</p>
                </div>
              </label>
            </div>
          </div>

          {/* Locality Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Covered Areas <span className="text-red-500">*</span>
            </h3>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by locality, district, or region..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {filteredLocalities.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchQuery ? "No localities match your search" : "Loading localities..."}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredLocalities.map((loc) => (
                    <label
                      key={loc.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedLocalities.includes(loc.id) ? "bg-indigo-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLocalities.includes(loc.id)}
                        onChange={() => toggleLocality(loc.id)}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{loc.name}</p>
                        <p className="text-xs text-gray-500">
                          {loc.district.name}, {loc.district.region.name}
                        </p>
                      </div>
                      {selectedLocalities.includes(loc.id) && (
                        <Check className="w-5 h-5 text-indigo-600" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedLocalities.length > 0 && (
              <p className="text-sm text-indigo-600 font-medium">
                {selectedLocalities.length} localit{selectedLocalities.length === 1 ? "y" : "ies"} selected
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedLocalities.length === 0}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEditing ? "Update Delivery Zone" : "Create Delivery Zone" // 👈 Dynamic Button Text
            )}
          </button>
        </div>
      </div>
    </div>
  );
}