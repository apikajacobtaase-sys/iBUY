// src/store/cartStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string; // This MUST be the database ID once synced
  productId: string;
  variantId?: string;
  offerId?: string | null;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  slug?: string;
  stockQuantity: number;
  sellerId: string;
  sellerName: string;
  isSelected: boolean;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id' | 'isSelected'>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  toggleSelect: (id: string) => Promise<void>;
  toggleSelectAll: () => void;
  clearCart: () => void;
  clearGuestCart: () => void;
  syncFromDB: (items: CartItem[]) => void;
  
  
  selectedItems: () => CartItem[];
  selectedTotalAmount: () => number;
  selectedTotalItems: () => number;
  totalItems: () => number;
  
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      selectedItems: () => get().items.filter((i) => i.isSelected && i.stockQuantity > 0),
      selectedTotalAmount: () => get().selectedItems().reduce((sum, item) => sum + item.price * item.quantity, 0),
      selectedTotalItems: () => get().selectedItems().reduce((sum, item) => sum + item.quantity, 0),
      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

           addItem: async (newItem) => {
        // 1. Optimistic UI update with a temporary UUID
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === newItem.productId && i.variantId === newItem.variantId && i.offerId === newItem.offerId
          );

          if (existing) {
            const maxStock = newItem.stockQuantity ?? 999;
            const newQuantity = Math.min(existing.quantity + (newItem.quantity || 1), maxStock);
            return {
              items: state.items.map((i) =>
                i.productId === newItem.productId && i.variantId === newItem.variantId && i.offerId === newItem.offerId
                  ? { ...i, quantity: newQuantity, isSelected: true }
                  : i
              ),
            };
          }

          const maxStock = newItem.stockQuantity ?? 999;
          const tempId = crypto.randomUUID(); // Temporary UUID
          return { 
            items: [
              ...state.items, 
              { ...newItem, id: tempId, quantity: Math.min(newItem.quantity || 1, maxStock), isSelected: true }
            ] 
          };
        });

        // 2. Sync to DB
        const state = get();
        const addedItem = state.items.find(
          i => i.productId === newItem.productId && i.variantId === newItem.variantId && i.offerId === newItem.offerId
        );
        
        if (addedItem?.variantId) {
          try {
            const res = await fetch("/api/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                variantId: addedItem.variantId, 
                offerId: addedItem.offerId,
                quantity: addedItem.quantity,
                isSelected: true
              }),
            });
            const data = await res.json();
            
            // 👇 BULLETPROOF ID EXTRACTION
            // The API might return { cartItem: {...} }, { item: {...} }, or just the item directly
            const realItem = data.cartItem || data.item || data;
            
            // Prisma IDs (cuid) do NOT have dashes. UUIDs DO have dashes.
            if (realItem && realItem.id && !realItem.id.includes("-")) {
              set((state) => ({
                items: state.items.map((i) => 
                  i.productId === addedItem.productId && i.variantId === addedItem.variantId && i.offerId === addedItem.offerId
                    ? { ...i, id: realItem.id } // Replace UUID with real DB ID
                    : i
                )
              }));
              console.log("✅ Cart synced with DB. Real ID:", realItem.id);
            } else {
              console.warn("⚠️ API did not return a valid DB ID. Are you logged in?", data);
            }
          } catch (error) {
            console.error("Failed to sync cart add to DB:", error);
          }
        }
      },
      removeItem: async (id) => {
        const item = get().items.find((i) => i.id === id);
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));

        if (item) {
          try {
            await fetch("/api/cart", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cartItemId: id }),
            });
          } catch (error) {
            console.error("Failed to sync cart remove to DB:", error);
          }
        }
      },

      updateQuantity: async (id, quantity) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;

        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const maxStock = item.stockQuantity ?? 999;
        const cappedQuantity = Math.min(quantity, maxStock);

        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity: cappedQuantity } : i
          ),
        }));

        try {
          await fetch("/api/cart", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cartItemId: id, 
              quantity: cappedQuantity 
            }),
          });
        } catch (error) {
          console.error("Failed to sync cart update to DB:", error);
        }
      },

      toggleSelect: async (id) => {
        const currentItem = get().items.find((i) => i.id === id);
        if (!currentItem) return;

        const newIsSelected = !currentItem.isSelected;

        // 1. Optimistic UI update
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, isSelected: newIsSelected } : i
          ),
        }));

        // 2. Sync to DB
        try {
          await fetch("/api/cart", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cartItemId: id, 
              isSelected: newIsSelected 
            }),
          });
        } catch (error) {
          console.error("Failed to sync selection to DB:", error);
        }
      },

      toggleSelectAll: () => {
        const state = get();
        const allSelected = state.items.every((i) => i.isSelected && i.stockQuantity > 0);
        const newSelectionState = !allSelected;
        
        set((state) => ({
          items: state.items.map((i) => 
            i.stockQuantity > 0 ? { ...i, isSelected: newSelectionState } : i
          ),
        }));
        
        // Note: For simplicity, toggleSelectAll doesn't bulk-sync to DB here, 
        // but individual toggles do. You can add bulk sync if needed.
      },

      clearCart: () => set({ items: [] }),
      syncFromDB: (items) => set({ items }),
      clearGuestCart: () => {
    set({ items: [] });
    // Also clear it from localStorage so it doesn't come back on refresh
    if (typeof window !== "undefined") {
      localStorage.removeItem("ibuy-cart"); // 👈 Change "ibuy-cart" to whatever your localStorage key is
    }
  },
    }),
    {
      name: "ibuy-cart-storage",
    }
  )
);