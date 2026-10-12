"""Shared wording patterns for LinkedIn evidence extraction; no resume scoring."""
import re
ACTION = re.compile(r'\b(built|created|developed|implemented|analyzed|analysed|designed|led|improved|reduced|automated|delivered|managed|optimized|optimised|contributed|worked)\b', re.I)
MEASURE = re.compile(r'\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent\b|users\b|records\b|customers\b|hours\b|minutes\b|seconds\b|reports\b|projects\b|students\b|requests\b|transactions\b|dollars\b)', re.I)
