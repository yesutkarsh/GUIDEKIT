"""Unified LLM Brain and Intent Detection Service for GuideKit.

Powered by Inception Labs Mercury 2.5 (OpenAI-compatible chat completions)
with an offline heuristic disambiguator fallback for unit tests and zero-key environments.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("guidekit.llm")

# Informational / policy query keywords that trigger RAG answers rather than launching UI tours
_POLICY_KEYWORDS = {
    "policy", "cancel", "cancellation", "refund", "fee", "cost", "charge",
    "price", "pricing", "privacy", "terms", "condition", "conditions",
    "rule", "rules", "faq", "how much", "safe", "safety", "security",
    "document", "documents", "requirement", "requirements", "eligibility",
    "commission", "percent", "percentage", "support", "help desk", "payout"
}

_WORKFLOW_ACTION_KEYWORDS = {
    "how do i", "how can i", "guide me", "take me to", "show me how",
    "show me where", "start tour", "step by step", "want to book", "book taxi",
    "book a taxi", "withdraw", "sign up as", "become driver", "register as driver",
    "sign in", "login"
}

_GREETINGS = {"hi", "hello", "hey", "namaste", "good morning", "good evening", "thanks", "thank you"}


def _heuristic_disambiguate(
    user_message: str,
    locale: str,
    available_features: list[dict[str, Any]],
    retrieved_chunks: list[dict[str, Any]],
    project_name: str = "GuideKit",
) -> dict[str, Any]:
    """Smart offline intent disambiguator for unit tests and zero-key environments."""
    msg_lower = user_message.lower().strip()

    # 1. Check smalltalk
    if any(msg_lower == g or msg_lower.startswith(f"{g} ") for g in _GREETINGS):
        reply = (
            f"नमस्ते! मैं {project_name} का एआई सहायक हूँ। मैं आपकी क्या मदद कर सकता हूँ?"
            if locale == "hi"
            else f"Hello! I am the {project_name} AI assistant. How can I help you today?"
        )
        return {
            "intent": "smalltalk",
            "matched_feature_slug": None,
            "suggested_tour_slug": None,
            "reply": reply,
        }

    # 2. Check for Policy / Informational questions (RAG Answer Priority)
    has_policy_kw = any(re.search(rf"\b{re.escape(kw)}\b", msg_lower) for kw in _POLICY_KEYWORDS)
    if has_policy_kw and retrieved_chunks:
        top_chunk = retrieved_chunks[0]
        content_text = top_chunk.get("content", "")
        # Find matching feature if mentioned
        suggested_slug = None
        for feat in available_features:
            f_slug = feat.get("slug", "")
            f_title = feat.get("title", "").lower()
            slug_words = [w for w in f_slug.replace("-", " ").split() if len(w) > 2]
            if f_slug in msg_lower or (f_title and f_title in msg_lower) or any(w in msg_lower for w in slug_words):
                suggested_slug = f_slug
                break

        reply = (
            f"दस्तावेज़ों के अनुसार: {content_text}"
            if locale == "hi"
            else f"According to documentation: {content_text}"
        )
        return {
            "intent": "rag_answer",
            "matched_feature_slug": None,
            "suggested_tour_slug": suggested_slug,
            "reply": reply,
        }

    # 3. Check for UI Workflow Action -> Launch Tour
    matched_slug = None
    for feat in available_features:
        f_slug = feat.get("slug", "")
        f_title = feat.get("title", "").lower()
        if f_slug in msg_lower or (f_title and f_title in msg_lower):
            matched_slug = f_slug
            break

    # Also check action patterns
    if not matched_slug:
        if "book" in msg_lower or "ride" in msg_lower or "taxi" in msg_lower:
            matched_slug = "book-taxi"
        elif "withdraw" in msg_lower or "payout" in msg_lower or "money" in msg_lower:
            matched_slug = "ask-money-on-the-go"
        elif "driver" in msg_lower and ("register" in msg_lower or "join" in msg_lower or "partner" in msg_lower):
            matched_slug = "become-driver"

    if matched_slug:
        feat_obj = next((f for f in available_features if f.get("slug") == matched_slug), None)
        title = feat_obj.get("title", matched_slug) if feat_obj else matched_slug
        reply = (
            f"'{title}' टूर शुरू कर रहे हैं।"
            if locale == "hi"
            else f"Starting '{title}' tour."
        )
        return {
            "intent": "launch_tour",
            "matched_feature_slug": matched_slug,
            "suggested_tour_slug": None,
            "reply": reply,
        }

    # 4. If policy keyword exists without retrieved chunks
    if has_policy_kw:
        reply = (
            f"क्षमा करें, मुझे {project_name} के ज्ञानकोष में इस नीति के बारे में विस्तृत जानकारी नहीं मिली।"
            if locale == "hi"
            else f"I could not find specific policy documentation for your question in {project_name}."
        )
        return {
            "intent": "rag_answer",
            "matched_feature_slug": None,
            "suggested_tour_slug": None,
            "reply": reply,
        }

    # 5. Out of scope
    reply = (
        f"मैं केवल {project_name} से संबंधित प्रक्रियाओं और सवालों में सहायता कर सकता हूँ।"
        if locale == "hi"
        else f"I can only assist with workflows and documentation related to {project_name}."
    )
    return {
        "intent": "out_of_scope",
        "matched_feature_slug": None,
        "suggested_tour_slug": None,
        "reply": reply,
    }


async def classify_intent_and_answer_with_llm(
    user_message: str,
    locale: str,
    auth_state: dict[str, Any],
    available_features: list[dict[str, Any]],
    retrieved_chunks: list[dict[str, Any]],
    project_name: str = "GuideKit",
) -> dict[str, Any]:
    """Classify user query intent and synthesize grounded responses using Mercury 2.5 / LLM.

    Returns dict matching schema:
    {
      "intent": "launch_tour" | "rag_answer" | "smalltalk" | "out_of_scope",
      "matched_feature_slug": str | None,
      "suggested_tour_slug": str | None,
      "reply": str
    }
    """
    api_key = (
        settings.llm_api_key
        or os.getenv("LLM_API_KEY")
        or os.getenv("INCEPTION_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )

    # If no LLM key configured, run deterministic heuristic disambiguator (great for pytest & offline)
    if not api_key:
        return _heuristic_disambiguate(
            user_message=user_message,
            locale=locale,
            available_features=available_features,
            retrieved_chunks=retrieved_chunks,
            project_name=project_name,
        )

    # Format context for LLM
    features_desc = "\n".join(
        f"- Slug: {f.get('slug')} | Title: {f.get('title')} | Auth: {f.get('requires_auth')} | Desc: {f.get('intent_description') or f.get('title')}"
        for f in available_features
    )
    chunks_desc = "\n\n".join(
        f"[Source: {c.get('source_title', 'Doc')}]\n{c.get('content', '')}"
        for c in retrieved_chunks[:5]
    )

    system_prompt = f"""You are the intelligent runtime assistant for {project_name}.
Your job is to classify the user's intent and respond accurately in strict JSON format.

AVAILABLE INTERACTIVE UI TOURS:
{features_desc or "(No tours registered)"}

RETRIEVED KNOWLEDGE BASE DOCUMENTATION (RAG):
{chunks_desc or "(No matching documents found)"}

USER CONTEXT:
- Requested Locale: {locale}
- Logged in: {auth_state.get('is_authenticated', False)}
- Role: {auth_state.get('role', 'none')}

DECISION RULES:
1. "launch_tour": Choose ONLY when the user wants to PERFORM AN ACTION or NAVIGATE THE UI or BE SHOWN WHERE/HOW to do something on the website (e.g. "How do I book a taxi?", "Take me to withdraw cash", "Guide me to register").
   - Set "matched_feature_slug" to the matching tour slug.
   - Set "suggested_tour_slug" to null.
   - Reply briefly in {locale} confirming the start of the tour.

2. "rag_answer": Choose when the user is asking an INFORMATIONAL, POLICY, CANCELLATION, REFUND, PRICING, TERMS, PRIVACY, or GENERAL QUESTION — even if it mentions a tour keyword (e.g. "What is the cancellation policy if I book a taxi?", "What are driver commission rates?").
   - Synthesize a concise, accurate answer strictly from the RETRIEVED KNOWLEDGE BASE DOCUMENTATION.
   - Set "matched_feature_slug" to null (DO NOT launch the spotlight tour automatically!).
   - If a related UI workflow exists (e.g. book-taxi), set "suggested_tour_slug" to that slug so an optional button can be offered.

3. "smalltalk": Greetings, thanks, or friendly conversation.
   - Set "matched_feature_slug": null, "suggested_tour_slug": null.

4. "out_of_scope": The question has nothing to do with {project_name}, its tours, or its documentation.
   - Set "matched_feature_slug": null, "suggested_tour_slug": null.

OUTPUT REQUIREMENT:
Respond with ONLY valid JSON with keys:
"intent" ("launch_tour" | "rag_answer" | "smalltalk" | "out_of_scope")
"matched_feature_slug" (string or null)
"suggested_tour_slug" (string or null)
"reply" (string in {locale})
"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "max_tokens": 1000,
        "reasoning_effort": "instant",
    }

    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_content = data["choices"][0]["message"]["content"]
                parsed = json.loads(raw_content)
                return {
                    "intent": parsed.get("intent", "out_of_scope"),
                    "matched_feature_slug": parsed.get("matched_feature_slug"),
                    "suggested_tour_slug": parsed.get("suggested_tour_slug"),
                    "reply": parsed.get("reply", ""),
                }
    except Exception as exc:
        logger.warning("LLM API call failed (%s), falling back to heuristic disambiguator", exc)

    # Fallback if API fails
    return _heuristic_disambiguate(
        user_message=user_message,
        locale=locale,
        available_features=available_features,
        retrieved_chunks=retrieved_chunks,
        project_name=project_name,
    )
