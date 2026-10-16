// src/app/products/page.tsx
import { db } from "@/lib/db"; // Note: You might not even need this import if you are using the API
import ProductCard from "@/components/ProductCard";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Package } from "lucide-react";
import Link from "next/link";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search: query = "", page = "1" } = await searchParams;
  const pageNum = parseInt(page, 10) || 1;
  const limit = 20;

  // Fetch from our intelligent search API
  const apiUrl = new URL("/api/search", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  if (query) apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("page", pageNum.toString());
  apiUrl.searchParams.set("limit", limit.toString());

  const res = await fetch(apiUrl.toString(), { cache: "no-store" });
  const data = await res.json();
  
  const products = data.products || [];
  const total = data.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Breadcrumbs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-green-600 transition-colors">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 font-medium">
            {query ? `Search Results for "${query}"` : "All Products"}
          </span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <form action="/products" className="w-full">
                <input
                  type="search"
                  name="search"
                  defaultValue={query}
                  placeholder="Search by name, brand, or description..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent focus:bg-white transition-all"
                />
              </form>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors w-full md:w-auto justify-center">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
          
          {/* Active Search Indicator */}
          {query && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
              <span>Showing results for:</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-medium">
                "{query}"
              </span>
              <Link href="/products" className="text-green-600 hover:underline ml-2">
                Clear search
              </Link>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{products.length}</span> of{" "}
            <span className="font-semibold text-gray-900">{total}</span> products
          </p>
        </div>

        {/* Product Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {products.map((product: any) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                slug={product.slug}
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                imageUrl={product.imageUrl}
                sellerName={product.sellerName}
                stockQuantity={product.stockQuantity}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {query ? `No products found for "${query}"` : "No products available"}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              {query 
                ? "Try adjusting your search terms, checking for typos, or using more general keywords."
                : "Check back soon as we are constantly adding new products to our marketplace."}
            </p>
            {query && (
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                View All Products
              </Link>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <Link
              href={`/products?search=${encodeURIComponent(query)}&page=${Math.max(1, pageNum - 1)}`}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pageNum === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              aria-disabled={pageNum === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Link>

            <span className="px-4 py-2 text-sm font-medium text-gray-700">
              Page {pageNum} of {totalPages}
            </span>

            <Link
              href={`/products?search=${encodeURIComponent(query)}&page=${Math.min(totalPages, pageNum + 1)}`}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pageNum === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              aria-disabled={pageNum === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}