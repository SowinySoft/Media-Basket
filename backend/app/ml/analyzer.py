import re


def analyze_text(text: str) -> dict:
    if not text:
        return {
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "spam_score": 0.0,
            "toxicity_score": 0.0,
            "language": "en",
            "tags": [],
        }

    sentiment_score = _vader_sentiment(text)
    spam_score = _spam_detect(text)
    language = _detect_language(text)
    tags = _extract_tags(text)

    if sentiment_score > 0.05:
        sentiment = "positive"
    elif sentiment_score < -0.05:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return {
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "spam_score": spam_score,
        "toxicity_score": 0.0,
        "language": language,
        "tags": tags,
    }


def _vader_sentiment(text: str) -> float:
    positive_words = {"great", "awesome", "love", "excellent", "good", "nice", "amazing", "best", "thank", "thanks", "helpful", "perfect", "wonderful", "fantastic", "brilliant", "superb", "outstanding", "impressive"}
    negative_words = {"bad", "terrible", "hate", "awful", "worst", "horrible", "poor", "ugly", "stupid", "damn", "sucks", "disappointing", "annoying", "boring", "useless", "trash"}

    words = set(re.findall(r'\w+', text.lower()))
    pos = len(words & positive_words)
    neg = len(words & negative_words)
    total = pos + neg
    if total == 0:
        return 0.0
    return (pos - neg) / total


def _spam_detect(text: str) -> float:
    spam_indicators = 0
    total_checks = 5

    if re.search(r'(buy now|click here|free money|limited time|act now|don\'t miss)', text, re.IGNORECASE):
        spam_indicators += 1
    if text.count('!') > 3:
        spam_indicators += 1
    if re.search(r'(https?://\S+)', text) and len(re.findall(r'https?://\S+', text)) > 2:
        spam_indicators += 1
    if text.isupper() and len(text) > 20:
        spam_indicators += 1
    if re.search(r'(\$|€|£)\d+', text):
        spam_indicators += 1

    return spam_indicators / total_checks


def _detect_language(text: str) -> str:
    common_english = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in", "with", "to", "for", "of", "this", "that", "it"}
    common_spanish = {"el", "la", "los", "las", "un", "una", "en", "y", "o", "pero", "con", "para", "de", "este", "esta", "eso"}
    common_arabic = {"في", "من", "على", "هذا", "التي", "الذي", "أن", "كان", "هو", "هي"}

    words = set(re.findall(r'\w+', text.lower()))
    if words & common_english:
        return "en"
    if words & common_spanish:
        return "es"
    if words & common_arabic:
        return "ar"
    return "en"


def _extract_tags(text: str) -> list[str]:
    tags = []
    tag_patterns = {
        "tech": r'\b(python|javascript|react|node|api|code|programming|developer|software|algorithm)\b',
        "business": r'\b(business|marketing|sales|revenue|startup|company|entrepreneur)\b',
        "question": r'\?|how|what|why|when|where|who|can you|could you',
        "request": r'\b(please|request|need|want|looking for|anyone know)\b',
        "positive": r'\b(great|awesome|love|excellent|amazing|perfect|best)\b',
    }
    text_lower = text.lower()
    for tag, pattern in tag_patterns.items():
        if re.search(pattern, text_lower):
            tags.append(tag)
    return tags
