"""Sample fashion catalogue (fictional house brands, sample data — clearly flagged is_demo=True).

Each tuple: (name, brand, colour name, colour hex, material, price INR, discount %, illustration style, tags)
"""

CATEGORIES = [
    ("Dresses", "dresses", "Day-to-night dresses, maxis and occasion wear."),
    ("Tops", "tops", "Knits, tees and everyday tops."),
    ("Shirts", "shirts", "Blouses and button-down shirts."),
    ("Jeans", "jeans", "Denim in every fit."),
    ("Shoes", "shoes", "Sneakers, heels and flats."),
    ("Accessories", "accessories", "Bags, watches, sunglasses and scarves."),
]

# Dataset garment classes whose (held-out) reviews are associated with each category.
DATASET_CLASS_MAP = {
    "dresses": ["Dresses"],
    "tops": ["Knits", "Fine gauge", "Sweaters"],
    "shirts": ["Blouses"],
    "jeans": ["Jeans"],
}

SIZES = {
    "dresses": ["XS", "S", "M", "L", "XL"], "tops": ["XS", "S", "M", "L", "XL"],
    "shirts": ["XS", "S", "M", "L", "XL"], "jeans": ["26", "28", "30", "32", "34"],
    "shoes": ["UK 4", "UK 5", "UK 6", "UK 7", "UK 8"], "accessories": ["One Size"],
}

PRODUCTS = {
    "dresses": [
        ("Aurelle Floral Wrap Midi Dress", "Aurelle", "Rose", "#E11D48", "Viscose crepe", 2899, 20, "dress_wrap", ["floral", "midi", "wrap", "occasion"]),
        ("Linen Society Tiered Maxi Dress", "Linen Society", "Sand", "#D6B98C", "100% linen", 3499, 15, "dress_maxi", ["linen", "maxi", "summer", "breathable"]),
        ("Noir & Ivy Satin Slip Dress", "Noir & Ivy", "Midnight", "#1E293B", "Satin", 3999, 0, "dress_slip", ["satin", "evening", "party"]),
        ("Saffron Lane Smocked Sundress", "Saffron Lane", "Marigold", "#F59E0B", "Cotton poplin", 1799, 25, "dress_a", ["cotton", "sundress", "casual"]),
        ("Mira Studio Ribbed Bodycon Dress", "Mira Studio", "Charcoal", "#374151", "Ribbed knit", 1599, 10, "dress_bodycon", ["knit", "bodycon", "stretch"]),
        ("Halcyon Puff-Sleeve Mini Dress", "Halcyon", "Lilac", "#A78BFA", "Cotton blend", 1999, 30, "dress_a", ["mini", "puff sleeve", "brunch"]),
        ("Aurelle Pleated Chiffon Maxi", "Aurelle", "Sage", "#84A98C", "Chiffon", 4299, 20, "dress_maxi", ["pleated", "maxi", "wedding guest"]),
        ("Kora Basics T-Shirt Dress", "Kora Basics", "Heather Grey", "#9CA3AF", "Organic cotton jersey", 1199, 0, "dress_bodycon", ["jersey", "everyday", "relaxed"]),
        ("Indigo Thread Chambray Shirt Dress", "Indigo Thread", "Chambray Blue", "#6B8FB8", "Chambray cotton", 2299, 15, "dress_a", ["chambray", "shirt dress", "belted"]),
        ("Noir & Ivy Velvet Cocktail Dress", "Noir & Ivy", "Emerald", "#047857", "Velvet", 4999, 35, "dress_slip", ["velvet", "cocktail", "festive"]),
        ("Saffron Lane Block Print Kurta Dress", "Saffron Lane", "Indigo", "#3730A3", "Hand block-printed cotton", 1899, 10, "dress_maxi", ["block print", "ethnic", "cotton"]),
        ("Mira Studio Polka Dot Fit & Flare", "Mira Studio", "Black & White", "#111827", "Crepe", 2499, 20, "dress_wrap", ["polka dot", "fit and flare", "vintage"]),
    ],
    "tops": [
        ("Kora Basics Essential Crew Tee", "Kora Basics", "White", "#F1F5F9", "Organic cotton", 599, 0, "tee", ["basic", "cotton", "everyday"]),
        ("Mira Studio Cropped Cardigan", "Mira Studio", "Butter Yellow", "#FDE68A", "Soft knit", 1499, 20, "knit", ["cardigan", "cropped", "knit"]),
        ("Aurelle Cashmere-Blend Sweater", "Aurelle", "Camel", "#B08968", "Cashmere-wool blend", 2999, 25, "knit", ["sweater", "winter", "cashmere"]),
        ("Halcyon Ruffle Hem Top", "Halcyon", "Blush", "#F9A8D4", "Georgette", 999, 15, "blouse_v", ["ruffle", "feminine", "office"]),
        ("Urban Loom Striped Breton Top", "Urban Loom", "Navy Stripe", "#1E3A8A", "Cotton jersey", 899, 10, "tee", ["stripes", "breton", "classic"]),
        ("Kora Basics Ribbed Tank", "Kora Basics", "Black", "#0F172A", "Ribbed cotton", 499, 0, "tank", ["tank", "layering", "basic"]),
        ("Mira Studio Mock Neck Fine Knit", "Mira Studio", "Burgundy", "#7F1D1D", "Fine-gauge knit", 1299, 20, "knit", ["fine gauge", "mock neck", "office"]),
        ("Linen Society Boxy Linen Top", "Linen Society", "Oat", "#E7DCC8", "Linen", 1399, 10, "tee", ["linen", "boxy", "summer"]),
        ("Halcyon Off-Shoulder Top", "Halcyon", "Coral", "#FB7185", "Viscose", 1099, 30, "blouse_v", ["off shoulder", "party"]),
        ("Urban Loom Oversized Hoodie", "Urban Loom", "Olive", "#4D5B3A", "Fleece-back cotton", 1799, 15, "knit", ["hoodie", "oversized", "lounge"]),
        ("Aurelle Cable Knit Pullover", "Aurelle", "Cream", "#F5F0E6", "Wool blend", 2499, 20, "knit", ["cable knit", "winter"]),
        ("Kora Basics Long Sleeve Henley", "Kora Basics", "Dusty Blue", "#7DA0C4", "Waffle cotton", 799, 0, "tee", ["henley", "waffle", "casual"]),
    ],
    "shirts": [
        ("Indigo Thread Oxford Button-Down", "Indigo Thread", "Sky Blue", "#93C5FD", "Oxford cotton", 1499, 10, "shirt", ["oxford", "workwear", "classic"]),
        ("Linen Society Relaxed Linen Shirt", "Linen Society", "White", "#F8FAFC", "100% linen", 1899, 15, "shirt", ["linen", "relaxed", "summer"]),
        ("Aurelle Silk Pussy-Bow Blouse", "Aurelle", "Ivory", "#FAF3E0", "Mulberry silk", 2499, 20, "blouse_v", ["silk", "bow", "office"]),
        ("Halcyon Embroidered Peasant Blouse", "Halcyon", "Off White", "#F3EFE6", "Cotton voile", 1299, 25, "blouse_v", ["embroidery", "boho"]),
        ("Urban Loom Checked Flannel Shirt", "Urban Loom", "Red Check", "#B91C1C", "Brushed flannel", 1399, 10, "shirt", ["flannel", "check", "winter"]),
        ("Noir & Ivy Satin Button Shirt", "Noir & Ivy", "Champagne", "#E8D5B0", "Satin", 1999, 15, "shirt", ["satin", "evening"]),
        ("Mira Studio Puff Sleeve Blouse", "Mira Studio", "Mint", "#A7F3D0", "Poplin", 1199, 20, "blouse_v", ["puff sleeve", "poplin"]),
        ("Indigo Thread Denim Shirt", "Indigo Thread", "Mid Wash", "#4A6FA5", "Cotton denim", 1699, 0, "shirt", ["denim", "casual", "layering"]),
        ("Saffron Lane Printed Kaftan Blouse", "Saffron Lane", "Teal Print", "#0F766E", "Rayon", 999, 30, "blouse_v", ["print", "kaftan", "relaxed"]),
        ("Kora Basics Striped Poplin Shirt", "Kora Basics", "Blue Stripe", "#3B82F6", "Cotton poplin", 1099, 0, "shirt", ["stripes", "poplin", "office"]),
        ("Aurelle Ruffle Collar Blouse", "Aurelle", "Black", "#111827", "Georgette", 1799, 20, "blouse_v", ["ruffle", "collar", "office"]),
        ("Linen Society Cropped Camp Shirt", "Linen Society", "Terracotta", "#C2410C", "Linen blend", 1599, 15, "shirt", ["camp collar", "cropped", "linen"]),
    ],
    "jeans": [
        ("Indigo Thread High-Rise Skinny Jeans", "Indigo Thread", "Dark Indigo", "#1E3A5F", "Stretch denim", 2199, 15, "jeans_skinny", ["skinny", "high rise", "stretch"]),
        ("Urban Loom Wide-Leg Jeans", "Urban Loom", "Light Wash", "#9DB4D3", "Rigid cotton denim", 2499, 20, "jeans_wide", ["wide leg", "rigid", "vintage"]),
        ("Indigo Thread Straight Fit Jeans", "Indigo Thread", "Mid Blue", "#4F75A8", "Cotton denim", 1999, 10, "jeans_straight", ["straight", "classic"]),
        ("Mira Studio Mom Jeans", "Mira Studio", "Stone Wash", "#8AA4C8", "Cotton denim", 1899, 25, "jeans_straight", ["mom fit", "high rise", "relaxed"]),
        ("Kora Basics Bootcut Jeans", "Kora Basics", "Indigo", "#28456E", "Stretch denim", 1699, 0, "jeans_wide", ["bootcut", "stretch"]),
        ("Urban Loom Black Slim Jeans", "Urban Loom", "Washed Black", "#1F2937", "Stretch denim", 2099, 15, "jeans_skinny", ["slim", "black", "stretch"]),
        ("Indigo Thread Cropped Flare Jeans", "Indigo Thread", "Medium Wash", "#5B7FB1", "Comfort stretch denim", 2399, 20, "jeans_wide", ["flare", "cropped"]),
        ("Mira Studio Distressed Boyfriend Jeans", "Mira Studio", "Bleached Blue", "#AFC4DE", "Cotton denim", 1999, 30, "jeans_straight", ["boyfriend", "distressed"]),
        ("Halcyon White Straight Jeans", "Halcyon", "Optic White", "#F8FAFC", "Cotton denim", 2299, 10, "jeans_straight", ["white", "summer"]),
        ("Urban Loom Barrel Leg Jeans", "Urban Loom", "Ecru", "#EDE6D6", "Rigid denim", 2799, 15, "jeans_wide", ["barrel", "trend"]),
        ("Kora Basics Pull-On Jeggings", "Kora Basics", "Blue Black", "#1E293B", "Knit denim", 1299, 0, "jeans_skinny", ["jeggings", "pull on", "comfort"]),
        ("Indigo Thread Selvedge Straight Jeans", "Indigo Thread", "Raw Indigo", "#172554", "Selvedge denim", 3499, 10, "jeans_straight", ["selvedge", "premium"]),
    ],
    "shoes": [
        ("Stride Co. Classic White Sneakers", "Stride Co.", "White", "#F8FAFC", "Leather upper", 2999, 15, "sneaker", ["sneakers", "leather", "everyday"]),
        ("Stride Co. Knit Running Shoes", "Stride Co.", "Electric Blue", "#2563EB", "Engineered knit", 3499, 20, "sneaker", ["running", "knit", "sport"]),
        ("Noir & Ivy Block Heel Sandals", "Noir & Ivy", "Nude", "#D4A88C", "Faux suede", 2499, 25, "heel", ["block heel", "sandals", "party"]),
        ("Aurelle Pointed Stiletto Pumps", "Aurelle", "Black Patent", "#0F172A", "Patent leather", 3999, 10, "heel", ["stiletto", "pumps", "evening"]),
        ("Ember & Oak Chelsea Boots", "Ember & Oak", "Tan", "#A16207", "Suede", 4999, 20, "boot", ["chelsea", "boots", "winter"]),
        ("Kora Basics Canvas Slip-Ons", "Kora Basics", "Navy", "#1E3A8A", "Canvas", 1499, 0, "sneaker", ["slip on", "canvas", "casual"]),
        ("Halcyon Embellished Flats", "Halcyon", "Gold", "#CA8A04", "Faux leather", 1799, 30, "flat", ["flats", "embellished", "festive"]),
        ("Ember & Oak Leather Loafers", "Ember & Oak", "Cognac", "#92400E", "Leather", 3499, 15, "flat", ["loafers", "office"]),
        ("Stride Co. Chunky Platform Sneakers", "Stride Co.", "Cream", "#F5F0E6", "Leather & mesh", 3999, 20, "sneaker", ["platform", "chunky", "trend"]),
        ("Noir & Ivy Strappy Heeled Sandals", "Noir & Ivy", "Silver", "#CBD5E1", "Metallic faux leather", 2799, 25, "heel", ["strappy", "party"]),
        ("Ember & Oak Ankle Boots", "Ember & Oak", "Black", "#111827", "Leather", 4499, 10, "boot", ["ankle boots", "winter"]),
        ("Kora Basics Comfort Ballet Flats", "Kora Basics", "Blush", "#F9A8D4", "Soft faux leather", 1299, 0, "flat", ["ballet flats", "comfort"]),
    ],
    "accessories": [
        ("Ember & Oak Leather Tote Bag", "Ember & Oak", "Cognac", "#92400E", "Full-grain leather", 3999, 15, "bag", ["tote", "leather", "work"]),
        ("Lumen Minimal Mesh Watch", "Lumen", "Rose Gold", "#E8B4A0", "Stainless steel", 2999, 20, "watch", ["watch", "minimal"]),
        ("Lumen Cat-Eye Sunglasses", "Lumen", "Tortoise", "#7C4A1E", "Acetate", 1499, 25, "sunglasses", ["sunglasses", "uv400"]),
        ("Saffron Lane Printed Silk Scarf", "Saffron Lane", "Marigold Print", "#F59E0B", "Silk", 1299, 10, "scarf", ["scarf", "silk", "print"]),
        ("Noir & Ivy Quilted Crossbody Bag", "Noir & Ivy", "Black", "#111827", "Faux leather", 2499, 20, "bag", ["crossbody", "quilted", "evening"]),
        ("Kora Basics Canvas Shopper", "Kora Basics", "Natural", "#E7DCC8", "Organic canvas", 699, 0, "bag", ["tote", "canvas", "eco"]),
        ("Lumen Aviator Sunglasses", "Lumen", "Gold", "#CA8A04", "Metal frame", 1799, 15, "sunglasses", ["aviator", "polarised"]),
        ("Aurelle Pearl Drop Earrings", "Aurelle", "Pearl", "#F5F0E6", "Freshwater pearl", 999, 10, "earrings", ["earrings", "pearl", "occasion"]),
        ("Urban Loom Woven Leather Belt", "Urban Loom", "Brown", "#78350F", "Leather", 899, 0, "belt", ["belt", "leather"]),
        ("Lumen Classic Leather Strap Watch", "Lumen", "Tan", "#A16207", "Leather strap", 2499, 20, "watch", ["watch", "classic", "leather"]),
        ("Halcyon Embroidered Clutch", "Halcyon", "Emerald", "#047857", "Velvet", 1599, 30, "bag", ["clutch", "festive", "embroidery"]),
        ("Saffron Lane Wool Blend Stole", "Saffron Lane", "Rust", "#B45309", "Wool blend", 1199, 15, "scarf", ["stole", "winter", "wool"]),
    ],
}

DESCRIPTIONS = {
    "dresses": "Cut from {material}, this {colour} piece is designed to move with you — from long workdays to evening plans. Thoughtful details, a flattering silhouette and an easy-care finish make it a wardrobe staple.",
    "tops": "A {colour} {material} top built for everyday rotation. Easy to layer, simple to style and finished with clean seams for a polished look.",
    "shirts": "This {colour} shirt in {material} balances structure and ease. Wear it tucked for the office or open over a tee on weekends.",
    "jeans": "{material} jeans in a {colour} wash. Reinforced seams, five-pocket styling and a shape that keeps its fit wear after wear.",
    "shoes": "{colour} {material} footwear with a cushioned footbed for all-day comfort and a grippy outsole for city streets.",
    "accessories": "A {colour} accessory in {material} that finishes any outfit. Made to last and easy to pair with both casual and occasion looks.",
}

DEMO_PERSONAS = [
    # (preferred categories, price band) used to generate *synthetic* demo shopper interactions
    (["dresses"], "mid"), (["dresses", "accessories"], "premium"), (["tops", "jeans"], "budget"),
    (["shirts", "jeans"], "mid"), (["shoes"], "premium"), (["tops"], "budget"), (["dresses", "shoes"], "mid"),
    (["jeans"], "mid"), (["accessories", "tops"], "budget"), (["shirts"], "premium"),
]
