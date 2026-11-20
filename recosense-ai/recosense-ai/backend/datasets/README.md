# Datasets

`womens_clothing_reviews.csv` — **Women's E-Commerce Clothing Reviews** (23,486 real customer reviews,
CC0: Public Domain) by Nick Brooks: https://www.kaggle.com/datasets/nicapotato/womens-ecommerce-clothing-reviews

If the file is missing, download `Womens Clothing E-Commerce Reviews.csv` from Kaggle and save it here as
`womens_clothing_reviews.csv`, then run `python -m app.ml.sentiment.train`.

Columns used: `Clothing ID`, `Age`, `Title`, `Review Text`, `Rating`, `Recommended IND`,
`Positive Feedback Count`, `Class Name`. Labels: rating 4–5 → positive, 3 → neutral, 1–2 → negative.
The dataset has no timestamps, so imported reviews are given dates spread over the past year.
