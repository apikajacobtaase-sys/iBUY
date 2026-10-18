 // src/store/cartStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
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
        // ✅ SAFETY CHECK: Ensure stockQuantity exists
        const availableStock = newItem.stockQuantity ?? 0;
        if (availableStock === 0) {
          alert("This item is out of stock.");
          return;
        }

        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === newItem.productId && i.variantId === newItem.variantId && i.offerId === newItem.offerId
          );

          if (existing) {
            // ✅ HARD CAP: Do not allow adding more than available stock
            const newQuantity = Math.min(existing.quantity + (newItem.quantity || 1), availableStock);
            
            if (newQuantity <= existing.quantity) {
              alert(`Sorry, only ${availableStock} items are available.`);
              return state; // Prevent update
            }

            return {
              items: state.items.map((i) =>
                i.productId === newItem.productId && i.variantId === newItem.variantId && i.offerId === newItem.offerId
                  ? { ...i, quantity: newQuantity, isSelected: true }
                  : i
              ),
            };
          }

          return { 
            items: [
              ...state.items, 
              { 
                ...newItem, 
                id: crypto.randomUUID(), 
                quantity: Math.min(newItem.quantity || 1, availableStock), 
                isSelected: true,
                stockQuantity: availableStock // Ensure this is saved
              } 
            ] 
          };
        });

        // Sync to DB
        const state = get();
        const addedItem = state.items.find(
          i => i.productId === newItem.productId && i.variantId === newItem.variantId && i.offerId === newItem.offerId
        );
        
        if (addedItem?.variantId) {
          try {
             // Inside addItem in cartStore.ts
const res = await fetch("/api/cart", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    variantId: addedItem.variantId, 
    offerId: addedItem.offerId || null, // ✅ Ensure null is sent if undefined
    quantity: addedItem.quantity,
    isSelected: true
  }),
});
            const data = await res.json();
            const realItem = data.cartItem || data.item || data;
            
            if (realItem && realItem.id && !realItem.id.includes("-")) {
              set((state) => ({
                items: state.items.map((i) => 
                  i.productId === addedItem.productId && i.variantId === addedItem.variantId && i.offerId === addedItem.offerId
                    ? { ...i, id: realItem.id }
                    : i
                )
              }));
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

        // ✅ HARD CAP: Do not allow updating to more than available stock
        const maxStock = item.stockQuantity ?? 999;
        const cappedQuantity = Math.min(quantity, maxStock);

        if (cappedQuantity < quantity) {
           alert(`Sorry, only ${maxStock} items are available.`);
        }

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

        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, isSelected: newIsSelected } : i
          ),
        }));

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
      },

      clearCart: () => set({ items: [] }),
      syncFromDB: (items) => set({ items }),
      clearGuestCart: () => {
        set({ items: [] });
        if (typeof window !== "undefined") {
          localStorage.removeItem("ibuy-cart-storage");
        }
      },
    }),
    {
      name: "ibuy-cart-storage",
    }
  )
);