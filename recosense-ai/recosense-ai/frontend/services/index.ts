import { api, json } from "@/lib/api";
import type {
  AnalyzeResult, Cart, Category, ChatMessage, CompareResult, Conversation, FeaturedReview, Order, Page, Preferences,
  Product, ProductDetail, ProductSentiment, RecommendationsResponse, RecommendedProduct, Review, ReviewSummary,
  Suggestion, User, WishlistItem,
} from "@/types";

export interface ProductQuery {
  q?: string; category?: string; brand?: string[]; min_price?: number; max_price?: number; min_rating?: number;
  min_sentiment?: number; in_stock?: boolean; sort?: string; page?: number; page_size?: number; include_inactive?: boolean;
}

export const authService = {
  login: (email: string, password: string) =>
    api<{ access_token: string; user: User }>("/api/auth/login", { method: "POST", body: json({ email, password }) }),
  register: (full_name: string, email: string, password: string) =>
    api<{ access_token: string; user: User }>("/api/auth/register", { method: "POST", body: json({ full_name, email, password }) }),
  me: () => api<User>("/api/auth/me"),
  updateMe: (data: { full_name?: string; phone?: string }) => api<User>("/api/auth/me", { method: "PUT", body: json(data) }),
  changePassword: (current_password: string, new_password: string) =>
    api<{ message: string }>("/api/auth/me/password", { method: "PUT", body: json({ current_password, new_password }) }),
  forgot: (email: string) =>
    api<{ message: string; dev_reset_link?: string }>("/api/auth/forgot-password", { method: "POST", body: json({ email }) }),
  reset: (token: string, new_password: string) =>
    api<{ message: string }>("/api/auth/reset-password", { method: "POST", body: json({ token, new_password }) }),
  preferences: () => api<Preferences>("/api/auth/preferences"),
  updatePreferences: (p: Partial<Preferences>) => api<Preferences>("/api/auth/preferences", { method: "PUT", body: json(p) }),
};

export const productService = {
  list: (query: ProductQuery) => api<Page<Product>>("/api/products", { query: { ...query } }),
  get: (id: number) => api<ProductDetail>(`/api/products/${id}`),
  facets: (category?: string) =>
    api<{ brands: string[]; min_price: number; max_price: number }>("/api/products/facets", { query: { category } }),
  suggest: (q: string) => api<Suggestion[]>("/api/products/suggest", { query: { q } }),
  categories: () => api<Category[]>("/api/categories"),
  highlights: (limit = 8) =>
    api<{ trending: Product[]; best_rated: Product[]; positive_sentiment: Product[]; new_arrivals: Product[] }>(
      "/api/recommendations/highlights", { query: { limit } }),
  track: (product_id: number, interaction_type: "view" | "click") =>
    api("/api/interactions", { method: "POST", body: json({ product_id, interaction_type }) }),
  recent: () => api<Product[]>("/api/interactions/recent"),
};

export const reviewService = {
  list: (productId: number, query: { page?: number; sentiment?: string; sort?: string }) =>
    api<Page<Review>>(`/api/products/${productId}/reviews`, { query }),
  create: (productId: number, data: { title?: string; body: string; rating: number }) =>
    api<Review>(`/api/products/${productId}/reviews`, { method: "POST", body: json(data) }),
  sentiment: (productId: number) => api<ProductSentiment>(`/api/products/${productId}/sentiment`),
  summary: (productId: number) => api<ReviewSummary>(`/api/products/${productId}/summary`),
  analyze: (text: string) => api<AnalyzeResult>("/api/sentiment/analyze", { method: "POST", body: json({ text }) }),
  featured: () => api<FeaturedReview[]>("/api/reviews/featured"),
};

export const recService = {
  forUser: (userId: number, algorithm = "hybrid", k = 12) =>
    api<RecommendationsResponse>(`/api/recommendations/${userId}`, { query: { algorithm, k } }),
  refresh: () => api<RecommendationsResponse>("/api/recommendations/refresh", { method: "POST" }),
  similar: (productId: number, k = 8) => api<RecommendedProduct[]>(`/api/recommendations/similar/${productId}`, { query: { k } }),
};

export const cartService = {
  get: () => api<Cart>("/api/cart"),
  add: (product_id: number, variant_id: number | null, quantity = 1) =>
    api<Cart>("/api/cart", { method: "POST", body: json({ product_id, variant_id, quantity }) }),
  update: (itemId: number, quantity: number) => api<Cart>(`/api/cart/${itemId}`, { method: "PUT", body: json({ quantity }) }),
  remove: (itemId: number) => api<Cart>(`/api/cart/${itemId}`, { method: "DELETE" }),
};

export const wishlistService = {
  get: () => api<WishlistItem[]>("/api/wishlist"),
  add: (product_id: number) => api("/api/wishlist", { method: "POST", body: json({ product_id }) }),
  remove: (product_id: number) => api(`/api/wishlist/${product_id}`, { method: "DELETE" }),
};

export interface CheckoutData {
  shipping_name: string; shipping_phone: string; shipping_address: string; shipping_city: string;
  shipping_postal_code: string; payment_method: "demo_card" | "demo_upi" | "demo_cod";
}

export const orderService = {
  create: (data: CheckoutData) => api<Order>("/api/orders", { method: "POST", body: json(data) }),
  list: () => api<Order[]>("/api/orders"),
  get: (id: number) => api<Order>(`/api/orders/${id}`),
  cancel: (id: number) => api<Order>(`/api/orders/${id}/cancel`, { method: "POST" }),
};

export const chatService = {
  send: (message: string, conversation_id?: number | null) =>
    api<{ conversation_id: number; user_message: ChatMessage; reply: ChatMessage }>("/api/chatbot/message", {
      method: "POST", body: json({ message, conversation_id: conversation_id ?? null }),
    }),
  history: () => api<Conversation[]>("/api/chatbot/history"),
  remove: (id: number) => api(`/api/chatbot/history/${id}`, { method: "DELETE" }),
};

export const compareService = {
  compare: (ids: number[]) => api<CompareResult>("/api/compare", { query: { ids: ids.join(",") } }),
};
