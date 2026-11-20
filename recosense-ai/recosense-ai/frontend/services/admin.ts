import { api, json } from "@/lib/api";
import type { Category, Page, Product, ProductDetail, Review, User } from "@/types";

export interface Dashboard {
  totals: {
    users: number; real_users: number; demo_users: number; products: number; reviews: number; orders: number;
    revenue: number; average_rating: number | null; analysed_reviews: number;
  };
  sentiment: { positive: number; neutral: number; negative: number };
  most_recommended: { product: Product; count: number }[];
  top_categories: { category: string; interactions: number; purchases: number }[];
  recent_orders: { id: number; order_number: string; total: number; status: string; created_at: string }[];
  data_notice: string;
}

export interface Analytics {
  sentiment_trend: { period: string; positive: number; neutral: number; negative: number; avg_score: number }[];
  review_volume: { period: string; reviews: number; avg_rating: number }[];
  category_popularity: ({ category: string } & Record<string, number | string>)[];
  product_performance: { id: number; name: string; category: string; popularity: number; rating: number; reviews: number; positive_pct: number; negative_pct: number }[];
  recommendation_activity: { date: string; recommendations: number; users: number }[];
  customer_interactions: ({ date: string } & Record<string, number | string>)[];
  aspects: { aspect: string; positive: number; negative: number; neutral: number; total: number; positive_pct: number }[];
  most_appreciated: string[];
  most_complained: string[];
}

export interface SentimentReportRow {
  id: number; name: string; category: string; reviews: number; rating: number; positive_pct: number;
  neutral_pct: number; negative_pct: number; sentiment_score: number | null; top_praise: string[]; top_complaints: string[];
}

export interface ModelRow {
  id?: number; model_name: string; model_version?: string; status: string; metrics: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  dataset_size?: number; latency_ms?: number | null; is_active: boolean; notes?: string | null; trained_at?: string;
}
export interface ModelMetrics {
  sentiment: ModelRow[]; sentiment_status: string; dataset: string | null; recommendation: ModelRow[];
  recommendation_status: string; history: { model_type: string; model_name: string; trained_at: string; status: string; is_active: boolean }[];
}
export interface Job {
  id: string; target: string; status: "queued" | "running" | "completed" | "failed"; step: string; started_at: string;
  finished_at: string | null; error: string | null; result: Record<string, unknown>;
}
export type Weights = { content: number; collaborative: number; sentiment: number; rating: number };

export interface ProductInput {
  name: string; description: string; brand: string; category_id: number; price: number; discount_percent: number;
  material?: string | null; color?: string | null; tags: string[]; image_urls: string[];
  variants: { size: string; color: string; stock: number }[]; is_active: boolean;
}

export const adminService = {
  dashboard: () => api<Dashboard>("/api/admin/dashboard"),
  analytics: (days = 90) => api<Analytics>("/api/admin/analytics", { query: { days } }),
  sentimentReport: () => api<SentimentReportRow[]>("/api/admin/sentiment-report"),
  users: (query: { q?: string; page?: number }) => api<Page<User>>("/api/admin/users", { query }),
  updateUser: (id: number, data: { is_active?: boolean; role?: string }) =>
    api<User>(`/api/admin/users/${id}`, { method: "PATCH", body: json(data) }),
  reviews: (query: { q?: string; sentiment?: string; source?: string; page?: number }) =>
    api<Page<Review>>("/api/admin/reviews", { query }),
  moderateReview: (id: number, is_hidden: boolean) =>
    api(`/api/admin/reviews/${id}`, { method: "PATCH", body: json({ is_hidden }) }),
  deleteReview: (id: number) => api(`/api/admin/reviews/${id}`, { method: "DELETE" }),
  createProduct: (data: ProductInput) => api<ProductDetail>("/api/products", { method: "POST", body: json(data) }),
  updateProduct: (id: number, data: ProductInput) => api<ProductDetail>(`/api/products/${id}`, { method: "PUT", body: json(data) }),
  deleteProduct: (id: number) => api(`/api/products/${id}`, { method: "DELETE" }),
  createCategory: (data: { name: string; description?: string }) =>
    api<Category>("/api/categories", { method: "POST", body: json(data) }),
  updateCategory: (id: number, data: { name: string; description?: string | null; image_url?: string | null }) =>
    api<Category>(`/api/categories/${id}`, { method: "PUT", body: json(data) }),
  deleteCategory: (id: number) => api(`/api/categories/${id}`, { method: "DELETE" }),
  modelMetrics: () => api<ModelMetrics>("/api/admin/model-metrics"),
  train: (target: "sentiment" | "recommendation" | "all", quick = true) =>
    api<Job>("/api/admin/models/train", { method: "POST", body: json({ target, reanalyze: true, quick }) }),
  job: (id: string) => api<Job>(`/api/admin/models/jobs/${id}`),
  jobs: () => api<Job[]>("/api/admin/models/jobs"),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api<Record<string, number | string>>("/api/admin/dataset/upload", { method: "POST", body: fd });
  },
  recOverview: (user_id?: number) =>
    api<{
      weights: Weights; total_generated: number; users_served: number; by_algorithm: Record<string, number>;
      engine: { built_at: string | null; products: number; users: number };
      preview: { user: { id: number; email: string; full_name: string }; items: { product: Product; score: number; components: Weights; reasons: string[]; algorithm: string }[] } | null;
    }>("/api/admin/recommendations", { query: { user_id } }),
  saveWeights: (w: Weights) => api<{ weights: Weights }>("/api/admin/recommendations/config", { method: "PUT", body: json(w) }),
  rebuild: () => api<{ message: string }>("/api/admin/recommendations/rebuild", { method: "POST" }),
};
