export type Role = "customer" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  is_demo: boolean;
  phone: string | null;
  created_at: string;
}

export interface Preferences {
  preferred_categories: string[];
  preferred_brands: string[];
  preferred_sizes: string[];
  min_price: number | null;
  max_price: number | null;
  onboarding_completed: boolean;
  email_notifications: boolean;
  theme: "light" | "dark" | "system";
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
}

export interface ProductImage { id: number; url: string; alt: string; position: number }
export interface Variant { id: number; size: string; color: string; sku: string; stock: number }

export interface Product {
  id: number;
  name: string;
  slug: string;
  brand: string;
  price: number;
  discount_percent: number;
  final_price: number;
  color: string | null;
  stock: number;
  in_stock: boolean;
  rating_avg: number;
  review_count: number;
  sentiment_score: number | null;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
  popularity: number;
  is_active: boolean;
  category: Category;
  images: ProductImage[];
  image_url: string | null;
}

export interface ProductDetail extends Product {
  description: string;
  material: string | null;
  tags: string[];
  variants: Variant[];
  is_demo: boolean;
  created_at: string;
}

export interface Page<T> { items: T[]; total: number; page: number; page_size: number; pages: number }

export interface Suggestion { type: "product" | "category" | "brand"; label: string; href: string }

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface Aspect { aspect: string; sentiment: SentimentLabel; score: number; snippet: string }

export interface Review {
  id: number;
  product_id: number;
  user_id: number | null;
  title: string | null;
  body: string;
  rating: number;
  source: string;
  reviewer_name: string | null;
  reviewer_age: number | null;
  recommended: boolean | null;
  helpful_count: number;
  created_at: string;
  sentiment: {
    label: SentimentLabel; is_mixed: boolean; confidence: number; score: number;
    prob_positive: number; prob_neutral: number; prob_negative: number; model_name: string; model_version: string;
  } | null;
  aspects: Aspect[];
  product_name?: string | null;
  is_hidden?: boolean;
}

export interface AspectStat {
  aspect: string; positive: number; negative: number; neutral: number; total: number; positive_pct: number;
}
export interface TrendPoint { period: string; positive: number; neutral: number; negative: number; avg_score: number }

export interface ProductSentiment {
  product_id: number;
  review_count: number;
  analysed_count: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  mixed_count: number;
  sentiment_score: number | null;
  rating_avg: number;
  distribution: Record<SentimentLabel, number>;
  aspects: AspectStat[];
  top_positive_aspects: string[];
  top_negative_aspects: string[];
  trend: TrendPoint[];
}

export interface AnalyzeResult {
  text: string;
  label: SentimentLabel;
  overall: SentimentLabel | "mixed";
  confidence: number;
  score: number;
  probabilities: Record<SentimentLabel, number>;
  positive_aspects: string[];
  negative_aspects: string[];
  aspects: Aspect[];
  model_name: string;
  model_version: string;
  latency_ms: number;
}

export interface SummaryPoint { aspect: string; mentions: number; total_mentions: number; customer_quote: string | null }
export interface ReviewSummary {
  product_id: number;
  generated: boolean;
  method: string;
  review_count: number;
  sufficient_data: boolean;
  overall_opinion: string;
  positive_points: SummaryPoint[];
  negative_points: SummaryPoint[];
  most_appreciated: string[];
  frequent_complaints: string[];
  recommendation_summary: string;
  positive_pct: number;
  negative_pct: number;
}

export type Components = { content: number; collaborative: number; sentiment: number; rating: number };

export interface RecommendedProduct {
  product: Product;
  score: number;
  rank: number;
  components: Components;
  reasons: string[];
  algorithm: string;
}

export interface RecommendationsResponse {
  user_id: number;
  algorithm: string;
  cold_start: boolean;
  generated_at: string;
  items: RecommendedProduct[];
}

export interface CartItem {
  id: number;
  quantity: number;
  product: Product;
  variant: Variant | null;
  available: boolean;
  issue: string | null;
  line_total: number;
}

export interface Cart {
  items: CartItem[];
  item_count: number;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  has_unavailable: boolean;
}

export interface OrderItem {
  id: number; product_id: number | null; product_name: string; image_url: string | null;
  size: string | null; color: string | null; unit_price: number; quantity: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  payment_method: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  created_at: string;
  items: OrderItem[];
}

export interface WishlistItem { id: number; product: Product; created_at: string }

export interface ChatProduct { product: Product; reasons: string[] }
export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  payload: {
    intent?: string;
    products?: ChatProduct[];
    suggestions?: string[];
    notes?: string[];
    compare?: { ids: number[]; best_for: BestFor[]; overall: { product_id: number; text: string } | null };
    parsed?: Record<string, unknown>;
  };
  created_at: string;
}
export interface Conversation { id: number; title: string; created_at: string; updated_at: string; messages: ChatMessage[] }

export interface BestFor { attribute: string; product_id: number; value: string }
export interface CompareRow {
  product: Product;
  aspects: Record<string, { label: string; positive_pct: number | null; mentions: number }>;
  pros: string[];
  cons: string[];
  summary: string;
}
export interface CompareResult {
  products: CompareRow[];
  best_for: BestFor[];
  overall: { product_id: number; wins: number; text: string } | null;
  note: string;
}

export interface FeaturedReview {
  id: number; title: string | null; body: string; rating: number; product_id: number; product_name: string;
  source: string; reviewer_name: string | null; reviewer_age: number | null;
}
